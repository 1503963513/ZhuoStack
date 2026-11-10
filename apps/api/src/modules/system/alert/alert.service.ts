import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { RedisService } from '../../../database/redis.service';

import * as crypto from 'crypto';

export interface AlertPayload {
  method: string;
  url: string;
  statusCode: number;
  message: string;
  requestId?: string;
  user?: string;
  ip?: string;
  stack?: string;
}

const ALERT_THROTTLE_PREFIX = 'alert:throttle:';

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * 触发接口或系统异常告警（自动执行决策过滤与 Redis 节流）
   */
  async trigger(payload: AlertPayload): Promise<boolean> {
    try {
      // 1. 检查总开关
      const enabledVal = await this.configService.getValueByKey('sys.alert.enabled');
      if (enabledVal !== 'true') return false;

      // 2. 检查 Webhook 地址
      const webhookUrl = await this.configService.getValueByKey('sys.alert.webhook_url');
      if (!webhookUrl || !webhookUrl.startsWith('http')) return false;

      // 3. 检查最低触发状态码
      const minStatusVal = await this.configService.getValueByKey('sys.alert.min_status');
      const minStatus = parseInt(minStatusVal || '500', 10);
      if (payload.statusCode < minStatus) return false;

      // 4. Redis 指纹节流防轰炸
      const fingerprintSource = `${payload.method}:${payload.url.split('?')[0]}:${payload.statusCode}:${payload.message.slice(0, 50)}`;
      const fingerprint = crypto.createHash('md5').update(fingerprintSource).digest('hex');
      const throttleKey = `${ALERT_THROTTLE_PREFIX}${fingerprint}`;

      const throttleSecondsVal = await this.configService.getValueByKey('sys.alert.throttle_seconds');
      const throttleSeconds = parseInt(throttleSecondsVal || '300', 10);

      const exists = await this.redisService.exists(throttleKey);
      if (exists) {
        this.logger.debug(`告警已节流降噪，跳过推送: [${fingerprint}] ${payload.url}`);
        return false;
      }

      // 写入节流标记
      await this.redisService.set(throttleKey, '1', throttleSeconds);

      // 5. 格式化并发送
      const platform = (await this.configService.getValueByKey('sys.alert.platform')) || 'wecom';
      const secret = (await this.configService.getValueByKey('sys.alert.secret')) || '';

      await this.sendToWebhook(webhookUrl, platform, payload, secret);
      this.logger.log(`异常告警已发送: [${payload.statusCode}] ${payload.method} ${payload.url}`);
      return true;
    } catch (error) {
      this.logger.warn(`告警处理异常: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * 手动发送测试告警（供管理后台配置测试）
   */
  async sendTestAlert(): Promise<{ success: boolean; message: string }> {
    const webhookUrl = await this.configService.getValueByKey('sys.alert.webhook_url');
    if (!webhookUrl) {
      return { success: false, message: '请先在系统参数中配置 sys.alert.webhook_url' };
    }

    const platform = (await this.configService.getValueByKey('sys.alert.platform')) || 'wecom';
    const secret = (await this.configService.getValueByKey('sys.alert.secret')) || '';

    try {
      await this.sendToWebhook(
        webhookUrl,
        platform,
        {
          method: 'GET',
          url: '/api/system/alert/test',
          statusCode: 200,
          message: '这是一条来自 ZhuoStack 管理系统的机器人连通性测试消息',
          requestId: `test_${Date.now()}`,
          user: 'SystemAdmin',
          ip: '127.0.0.1',
        },
        secret,
      );
      return { success: true, message: '测试告警发送成功' };
    } catch (error) {
      return {
        success: false,
        message: `发送失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 按照不同平台规范构建消息载荷并推送
   */
  private async sendToWebhook(
    url: string,
    platform: string,
    payload: AlertPayload,
    secret?: string,
  ): Promise<void> {
    const timeStr = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    let body: Record<string, unknown>;

    switch (platform.toLowerCase()) {
      case 'feishu': {
        body = {
          msg_type: 'interactive',
          card: {
            header: {
              title: { tag: 'plain_text', content: '🚨 ZhuoStack 系统异常告警' },
              template: payload.statusCode >= 500 ? 'red' : 'orange',
            },
            elements: [
              {
                tag: 'div',
                text: {
                  tag: 'lark_md',
                  content:
                    `**请求接口**: \`${payload.method} ${payload.url}\`\n` +
                    `**状态代码**: \`${payload.statusCode}\`\n` +
                    `**追踪编号**: \`${payload.requestId || '-'}\`\n` +
                    `**触发用户**: ${payload.user || '匿名用户'} (${payload.ip || '未知IP'})\n` +
                    `**发生时间**: ${timeStr}\n` +
                    `**错误描述**: ${payload.message}`,
                },
              },
            ],
          },
        };
        break;
      }
      case 'dingtalk': {
        let finalUrl = url;
        if (secret) {
          const timestamp = Date.now();
          const stringToSign = `${timestamp}\n${secret}`;
          const sign = crypto
            .createHmac('sha256', secret)
            .update(stringToSign)
            .digest('base64');
          finalUrl = `${url}&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
        }
        body = {
          msgtype: 'markdown',
          markdown: {
            title: '🚨 ZhuoStack 系统异常告警',
            text:
              `### 🚨 ZhuoStack 系统异常告警\n\n` +
              `> **请求接口**: \`${payload.method} ${payload.url}\`\n\n` +
              `> **状态代码**: \`${payload.statusCode}\`\n\n` +
              `> **追踪编号**: \`${payload.requestId || '-'}\`\n\n` +
              `> **触发用户**: ${payload.user || '匿名'} (${payload.ip || '-'})\n\n` +
              `> **发生时间**: ${timeStr}\n\n` +
              `> **错误信息**: ${payload.message}`,
          },
        };
        url = finalUrl;
        break;
      }
      case 'wecom':
      default: {
        body = {
          msgtype: 'markdown',
          markdown: {
            content:
              `### 🚨 <font color="warning">ZhuoStack 系统异常告警</font>\n` +
              `> **请求接口**: <font color="comment">${payload.method} ${payload.url}</font>\n` +
              `> **状态代码**: <font color="${payload.statusCode >= 500 ? 'red' : 'comment'}">${payload.statusCode}</font>\n` +
              `> **追踪编号**: \`${payload.requestId || '-'}\`\n` +
              `> **触发用户**: ${payload.user || '匿名'} (${payload.ip || '-'})\n` +
              `> **发生时间**: ${timeStr}\n` +
              `> **错误描述**: <font color="red">${payload.message.replace(/[\n\r]/g, ' ')}</font>`,
          },
        };
        break;
      }
    }

        const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Webhook 响应 HTTP ${res.status}: ${errText.slice(0, 100)}`);
    }

    // 检查平台特定业务错误码（企微/飞书/钉钉在 HTTP 200 下可能返回错误 JSON）
    try {
      const resultJson = (await res.json()) as Record<string, unknown>;
      if (typeof resultJson === "object" && resultJson !== null) {
        // 企业微信 & 钉钉规范: errcode !== 0 表示异常
        if ("errcode" in resultJson && resultJson.errcode !== 0) {
          throw new Error(`机器人接口错误 [${resultJson.errcode}]: ${resultJson.errmsg || "未知错误"}`);
        }
        // 飞书规范: code !== 0 表示异常
        if ("code" in resultJson && resultJson.code !== 0) {
          throw new Error(`飞书机器人错误 [${resultJson.code}]: ${resultJson.msg || "未知错误"}`);
        }
        // 飞书 StatusCode 表示异常
        if ("StatusCode" in resultJson && resultJson.StatusCode !== 0) {
          throw new Error(`飞书机器人错误 [${resultJson.StatusCode}]: ${resultJson.StatusMessage || "未知错误"}`);
        }
      }
    } catch (parseError) {
      if (parseError instanceof Error && parseError.message.includes("机器人")) {
        throw parseError;
      }
      // 非 JSON 文本但 HTTP 200 则放行
    }
  }
}
