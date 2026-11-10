import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RedisService } from '../../../database/redis.service';
import {
  SystemLogEntryDto,
  LogLevel,
  QuerySystemLogsDto,
  RuntimeLogConfigDto,
  UpdateRuntimeLogConfigDto,
} from '../dto/system-log.dto';
import * as crypto from 'crypto';

const LOG_CONFIG_REDIS_KEY = 'log:runtime:config';
const LOG_STREAM_REDIS_KEY = 'log:runtime:stream';

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
};

@Injectable()
export class SystemLogService implements OnModuleInit {
  private readonly logger = new Logger(SystemLogService.name);

  // 内存环形缓冲区，用于极速无锁追加和读取
  private memoryBuffer: SystemLogEntryDto[] = [];

  // 当前运行时生效配置（内存单例）
  private runtimeConfig: RuntimeLogConfigDto = {
    level: 'info',
    bufferSize: 2000,
    sampleRate: 100,
    trackCallers: true,
    stackThreshold: 'error',
    retentionHours: 24,
    dbRetentionDays: 7,
  };

  constructor(private readonly redisService: RedisService) {}

  async onModuleInit() {
    await this.loadConfigFromRedis();
  }

  /**
   * 从 Redis 加载持久化配置
   */
  private async loadConfigFromRedis() {
    try {
      const cached = await this.redisService.get<RuntimeLogConfigDto>(LOG_CONFIG_REDIS_KEY);
      if (cached) {
        this.runtimeConfig = { ...this.runtimeConfig, ...cached };
        this.logger.log(`已加载运行时日志策略，当前生效级别: ${this.runtimeConfig.level}`);
      }
    } catch {
      // 忽略启动初期读取异常，回退默认配置
    }
  }

  /**
   * 记录一条系统运行日志（进入内存环形缓冲 + Redis 时序队列）
   */
  record(entry: {
    level: LogLevel;
    context: string;
    message: string;
    caller?: string | null;
    requestId?: string | null;
    stack?: string | null;
  }) {
    // 1. 日志级别过滤
    if (LEVEL_WEIGHT[entry.level] < LEVEL_WEIGHT[this.runtimeConfig.level]) {
      return;
    }

    // 2. 请求日志采样率过滤 (仅针对 info 级别进行采样，warn/error 必录)
    if (entry.level === 'info' && this.runtimeConfig.sampleRate < 100) {
      const dice = Math.random() * 100;
      if (dice > this.runtimeConfig.sampleRate) {
        return;
      }
    }

    // 3. 堆栈按阈值裁剪
    let finalStack = entry.stack;
    if (this.runtimeConfig.stackThreshold === 'never') {
      finalStack = null;
    } else if (this.runtimeConfig.stackThreshold === 'error' && entry.level !== 'error') {
      finalStack = null;
    }

    const logItem: SystemLogEntryDto = {
      id: `log_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      timestamp: Date.now(),
      level: entry.level,
      context: entry.context || 'System',
      message: entry.message,
      caller: this.runtimeConfig.trackCallers ? entry.caller || 'system' : undefined,
      requestId: entry.requestId || undefined,
      stack: finalStack || undefined,
    };

    // 4. 追加进内存环形缓冲区 (超出最大容量按 FIFO 推出头部)
    this.memoryBuffer.push(logItem);
    if (this.memoryBuffer.length > this.runtimeConfig.bufferSize) {
      this.memoryBuffer.splice(0, this.memoryBuffer.length - this.runtimeConfig.bufferSize);
    }

    // 5. 异步写入 Redis 时序 ZSET（Score 为时间戳，微秒精度防覆盖）
    this.pushToRedis(logItem).catch(() => {});
  }

  /**
   * 将日志推入 Redis ZSET 缓存
   */
  private async pushToRedis(item: SystemLogEntryDto) {
    try {
      const client = this.redisService.getClient();
      if (!client) return;
      const score = item.timestamp;
      const member = JSON.stringify(item);
      await client.zadd(LOG_STREAM_REDIS_KEY, score, member);

      // 定期剔除过期日志
      const retentionMs = this.runtimeConfig.retentionHours * 3600 * 1000;
      const expireBefore = Date.now() - retentionMs;
      await client.zremrangebyscore(LOG_STREAM_REDIS_KEY, '-inf', expireBefore);
    } catch {
      // 容错处理，不中断系统流
    }
  }

  /**
   * 查询系统运行日志（默认查询近 30 分钟，最新在最前）
   */
  async findLogs(query: QuerySystemLogsDto): Promise<{ list: SystemLogEntryDto[]; total: number }> {
    const { windowMinutes = 30, level = 'all', keyword, caller, limit = 200 } = query;
    const now = Date.now();
    const sinceTimestamp = now - windowMinutes * 60 * 1000;

    let sourceList: SystemLogEntryDto[] = [];

    // 优先从 Redis 获取完整跨进程日志
    try {
      const client = this.redisService.getClient();
      if (!client) throw new Error("Redis client not ready");
      const members = await client.zrevrangebyscore(
        LOG_STREAM_REDIS_KEY,
        '+inf',
        sinceTimestamp,
        'LIMIT',
        0,
        limit * 2, // 适当放大取样
      );
      if (members && members.length > 0) {
        sourceList = members.map((m) => JSON.parse(m) as SystemLogEntryDto);
      }
    } catch {
      // Redis 不可用时回退内存缓冲区
      sourceList = [...this.memoryBuffer].reverse();
    }

    if (sourceList.length === 0 && this.memoryBuffer.length > 0) {
      sourceList = [...this.memoryBuffer].reverse();
    }

    // 内存过滤条件
    const filtered = sourceList.filter((item) => {
      // 时间窗口过滤
      if (item.timestamp < sinceTimestamp) return false;

      // 日志级别过滤
      if (level !== 'all' && item.level !== level) return false;

      // 调用方过滤
      if (caller && item.caller && !item.caller.toLowerCase().includes(caller.toLowerCase())) {
        return false;
      }

      // 关键词过滤（匹配消息、上下文或 RequestID）
      if (keyword) {
        const kw = keyword.toLowerCase();
        const inMsg = item.message.toLowerCase().includes(kw);
        const inCtx = item.context.toLowerCase().includes(kw);
        const inReq = item.requestId ? item.requestId.toLowerCase().includes(kw) : false;
        if (!inMsg && !inCtx && !inReq) return false;
      }

      return true;
    });

    const result = filtered.slice(0, limit);
    return {
      list: result,
      total: result.length,
    };
  }

  /**
   * 清空系统运行日志缓存
   */
  async clearLogs(): Promise<{ success: boolean; message: string }> {
    this.memoryBuffer = [];
    try {
      await this.redisService.del(LOG_STREAM_REDIS_KEY);
      return { success: true, message: '系统运行日志已全部清理' };
    } catch (e) {
      return { success: false, message: `清理失败: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  /**
   * 获取当前运行时日志配置
   */
  getConfig(): RuntimeLogConfigDto {
    return { ...this.runtimeConfig };
  }

  /**
   * 动态更新运行时日志配置（立即生效，并同步到 Redis）
   */
  async updateConfig(dto: UpdateRuntimeLogConfigDto): Promise<RuntimeLogConfigDto> {
    this.runtimeConfig = {
      ...this.runtimeConfig,
      ...dto,
    };

    // 内存缓冲区容量变更响应
    if (this.memoryBuffer.length > this.runtimeConfig.bufferSize) {
      this.memoryBuffer.splice(0, this.memoryBuffer.length - this.runtimeConfig.bufferSize);
    }

    // 保存到 Redis 供多实例和重启恢复
    try {
      await this.redisService.set(LOG_CONFIG_REDIS_KEY, this.runtimeConfig, 30 * 86400);
    } catch {
      // 忽略持久化失败
    }

    this.logger.log(`运行时日志策略已动态生效: 级别=${this.runtimeConfig.level}, 采样率=${this.runtimeConfig.sampleRate}%`);
    return this.runtimeConfig;
  }
}
