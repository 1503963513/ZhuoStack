import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';

/**
 * 通知定时清理任务
 * - 已读个人消息：默认保留 90 天
 * - 公告：默认保留 180 天
 * - 已隐藏的已读记录：30 天
 */
@Injectable()
export class NotificationCleanupService {
  private readonly logger = new Logger(NotificationCleanupService.name);
  private readonly personalRetentionDays: number;
  private readonly announcementRetentionDays: number;
  private readonly hiddenReadRetentionDays = 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.personalRetentionDays = parseInt(
      this.configService.get('NOTIFICATION_RETENTION_DAYS', '90'),
      10,
    );
    this.announcementRetentionDays = parseInt(
      this.configService.get('ANNOUNCEMENT_RETENTION_DAYS', '180'),
      10,
    );
  }

  /** 每天凌晨 3:17 执行清理 */
  @Cron('17 3 * * *', { name: 'notification-cleanup' })
  async cleanupExpiredNotifications(): Promise<void> {
    this.logger.log('开始清理过期通知...');

    const now = new Date();

    // 1. 清理已读个人消息
    const personalCutoff = new Date(now);
    personalCutoff.setDate(personalCutoff.getDate() - this.personalRetentionDays);

    const deletedPersonal = await this.prisma.sysNotification.deleteMany({
      where: {
        userId: { not: null },
        isRead: true,
        type: { not: 'announcement' },
        updatedAt: { lt: personalCutoff },
      },
    });

    // 2. 清理过期公告（级联删除 reads 记录）
    const announcementCutoff = new Date(now);
    announcementCutoff.setDate(
      announcementCutoff.getDate() - this.announcementRetentionDays,
    );

    const deletedAnnouncements = await this.prisma.sysNotification.deleteMany({
      where: {
        type: 'announcement',
        createdAt: { lt: announcementCutoff },
      },
    });

    // 3. 清理已隐藏超期的已读记录
    const hiddenCutoff = new Date(now);
    hiddenCutoff.setDate(hiddenCutoff.getDate() - this.hiddenReadRetentionDays);

    const deletedHidden = await this.prisma.sysNotificationRead.deleteMany({
      where: {
        hidden: true,
        createdAt: { lt: hiddenCutoff },
      },
    });

    this.logger.log(
      `清理完成：个人消息 ${deletedPersonal.count} 条，` +
        `公告 ${deletedAnnouncements.count} 条，` +
        `隐藏记录 ${deletedHidden.count} 条`,
    );
  }
}
