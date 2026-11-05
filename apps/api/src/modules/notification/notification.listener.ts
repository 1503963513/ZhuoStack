import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationService } from './notification.service';

/** 通知发送事件载荷 */
export interface NotificationSendPayload {
  /** 通知标题 */
  title: string;
  /** 通知内容 */
  content: string;
  /** 目标用户ID */
  userId: string;
  /** 关联业务类型 */
  bizType?: string;
  /** 关联业务ID */
  bizId?: string;
  /** 发送者信息 */
  sender?: { id: string; name?: string | null };
}

/** 公告发送事件载荷 */
export interface AnnouncementSendPayload {
  /** 公告标题 */
  title: string;
  /** 公告内容 */
  content: string;
  /** 发送者信息 */
  sender: { id: string; name?: string | null };
  /** 备注 */
  remark?: string;
}

/**
 * 事件监听器：接收内部业务事件，转发到通知服务
 *
 * 使用方式：
 * ```typescript
 * // 在任意 Service 中注入 EventEmitter2 后发送事件
 * this.eventEmitter.emit('notification.send', {
 *   title: '审批通过',
 *   content: '您的请假申请已审批通过',
 *   userId: targetUserId,
 *   bizType: 'approval',
 *   bizId: approvalId,
 *   sender: { id: currentUser.id, name: currentUser.name },
 * });
 * ```
 */
@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(private readonly notificationService: NotificationService) {}

  /** 监听个人通知发送事件 */
  @OnEvent('notification.send')
  async handleNotificationSend(payload: NotificationSendPayload): Promise<void> {
    try {
      await this.notificationService.sendNotification(
        {
          title: payload.title,
          content: payload.content,
          userId: payload.userId,
          bizType: payload.bizType,
          bizId: payload.bizId,
        },
        payload.sender,
      );
      this.logger.log(`通知已发送: [${payload.title}] → ${payload.userId}`);
    } catch (error) {
      this.logger.error(
        `通知发送失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** 监听公告发送事件 */
  @OnEvent('notification.announcement')
  async handleAnnouncementSend(
    payload: AnnouncementSendPayload,
  ): Promise<void> {
    try {
      await this.notificationService.createAnnouncement(
        {
          title: payload.title,
          content: payload.content,
          status: 'published',
          remark: payload.remark,
        },
        payload.sender,
      );
      this.logger.log(`公告已发布: [${payload.title}]`);
    } catch (error) {
      this.logger.error(
        `公告发布失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
