import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../database/redis.service';
import { NotificationGateway } from './notification.gateway';
import {
  CreateNotificationDto,
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
  QueryNotificationDto,
} from './dto';

/** Redis 键前缀 */
const UNREAD_PREFIX = 'notification:unread:';
/** 未读缓存 TTL（5 分钟） */
const UNREAD_CACHE_TTL = 300;

/** 当前用户的请求上下文 */
interface CurrentUserContext {
  id: string;
  name?: string | null;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly gateway: NotificationGateway,
  ) {}

  // ========== 用户侧接口 ==========

  /**
   * 获取用户通知列表（合并个人消息与公告）
   */
  async getUserNotifications(userId: string, query: QueryNotificationDto) {
    const { page = 1, pageSize = 10, type, isRead } = query;

    // 查询用户已隐藏的公告 ID 列表
    const hiddenIds = await this.prisma.sysNotificationRead.findMany({
      where: { userId, hidden: true },
      select: { notificationId: true },
    });
    const hiddenIdList = hiddenIds.map((r) => r.notificationId);

    // 构建个人消息条件
    const personalWhere: Record<string, unknown> = {
      userId,
      type: { not: 'announcement' },
    };
    if (type && type !== 'announcement') {
      personalWhere.type = type;
    }
    if (isRead !== undefined) {
      personalWhere.isRead = isRead;
    }

    // 构建公告的 ID 集合过滤（已读/未读/隐藏）
    const announcementIdFilter: Record<string, unknown> = {};
    if (hiddenIdList.length > 0) {
      announcementIdFilter.notIn = hiddenIdList;
    }

    if (isRead !== undefined) {
      const readRecords = await this.prisma.sysNotificationRead.findMany({
        where: { userId, hidden: false },
        select: { notificationId: true },
      });
      const readIds = readRecords.map((r) => r.notificationId);

      if (isRead) {
        // 筛选已读公告：必须在 readIds 中，且不在 hiddenIdList 中
        const validReadIds = readIds.filter((id) => !hiddenIdList.includes(id));
        announcementIdFilter.in = validReadIds;
      } else {
        // 筛选未读公告：排除已读和已隐藏
        const excludeIds = Array.from(new Set([...readIds, ...hiddenIdList]));
        if (excludeIds.length > 0) {
          announcementIdFilter.notIn = excludeIds;
        }
      }
    }

    // 构建公告条件
    const announcementWhere: Record<string, unknown> = {
      type: 'announcement',
      status: 'published',
      userId: null,
      ...(Object.keys(announcementIdFilter).length > 0 ? { id: announcementIdFilter } : {}),
    };

    // 根据筛选条件决定查询范围
    let where: Record<string, unknown>;
    if (type === 'announcement') {
      // 只查公告
      where = announcementWhere;
    } else if (type) {
      // 指定了非公告类型，只查个人消息
      where = personalWhere;
    } else {
      // 全部：合并公告和个人消息
      where = { OR: [personalWhere, announcementWhere] };
    }

    const [data, total] = await Promise.all([
      this.prisma.sysNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          reads: {
            where: { userId },
            select: { id: true, hidden: true, createdAt: true },
          },
        },
      }),
      this.prisma.sysNotification.count({ where }),
    ]);

    // 根据 isRead 筛选条件过滤公告已读状态
    const result = data.map((n) => {
      const isAnnouncement = n.type === 'announcement';
      const notificationIsRead = isAnnouncement
        ? n.reads.length > 0
        : n.isRead;
      const notificationReadAt = isAnnouncement
        ? n.reads[0]?.createdAt ?? null
        : n.readAt;
      return {
        id: n.id,
        type: n.type,
        title: n.title,
        content: n.content,
        userId: n.userId,
        senderId: n.senderId,
        senderName: n.senderName,
        isRead: notificationIsRead,
        readAt: notificationReadAt,
        bizType: n.bizType,
        bizId: n.bizId,
        status: n.status,
        remark: n.remark,
        createdAt: n.createdAt,
      };
    });

    // 数据库层已通过 ID 集合精确定位，无需应用层二次过滤

    return {
      data: result,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 获取未读计数（分类）
   */
  async getUnreadCount(userId: string) {
    // 优先走 Redis 缓存
    const cacheKey = `${UNREAD_PREFIX}${userId}`;
    const cached = await this.redisService.get<{
      total: number;
      announcement: number;
      system: number;
    }>(cacheKey);
    if (cached) return cached;

    // 回源计算
    const [personalUnread, totalAnnouncements, readAnnouncements] =
      await Promise.all([
        // 未读个人系统消息
        this.prisma.sysNotification.count({
          where: {
            userId,
            type: { not: 'announcement' },
            isRead: false,
          },
        }),
        // 已发布公告总数
        this.prisma.sysNotification.count({
          where: {
            type: 'announcement',
            status: 'published',
            userId: null,
          },
        }),
        // 该用户已读（未隐藏）的公告数
        this.prisma.sysNotificationRead.count({
          where: { userId, hidden: false },
        }),
      ]);

    const unreadAnnouncement = Math.max(
      0,
      totalAnnouncements - readAnnouncements,
    );
    const result = {
      total: personalUnread + unreadAnnouncement,
      announcement: unreadAnnouncement,
      system: personalUnread,
    };

    await this.redisService.set(cacheKey, result, UNREAD_CACHE_TTL);
    return result;
  }

  /**
   * 标记单条通知已读
   */
  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.sysNotification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('通知不存在');
    }

    if (notification.type === 'announcement') {
      // 公告：写入 reads 表
      await this.prisma.sysNotificationRead.upsert({
        where: {
          notificationId_userId: { notificationId, userId },
        },
        create: { notificationId, userId },
        update: {},
      });
    } else {
      // 个人消息：检查归属
      if (notification.userId !== userId) {
        throw new NotFoundException('通知不存在');
      }
      await this.prisma.sysNotification.update({
        where: { id: notificationId },
        data: { isRead: true, readAt: new Date() },
      });
    }

    // 清除未读缓存
    await this.invalidateUnreadCache(userId);

    return { message: '已标记为已读' };
  }

  /**
   * 全部标记已读
   */
  async markAllAsRead(userId: string) {
    // 1. 标记所有个人未读消息为已读
    await this.prisma.sysNotification.updateMany({
      where: { userId, isRead: false, type: { not: 'announcement' } },
      data: { isRead: true, readAt: new Date() },
    });

    // 2. 给所有未读公告插入已读记录
    const unreadAnnouncements = await this.prisma.sysNotification.findMany({
      where: {
        type: 'announcement',
        status: 'published',
        userId: null,
        reads: { none: { userId } },
      },
      select: { id: true },
    });

    if (unreadAnnouncements.length > 0) {
      // 批量创建已读记录，跳过已存在的
      await this.prisma.sysNotificationRead.createMany({
        data: unreadAnnouncements.map((a) => ({
          notificationId: a.id,
          userId,
        })),
        skipDuplicates: true,
      });
    }

    // 清除未读缓存
    await this.invalidateUnreadCache(userId);

    return { message: '已全部标记为已读' };
  }

  /**
   * 用户删除通知
   */
  async removeByUser(notificationId: string, userId: string) {
    const notification = await this.prisma.sysNotification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('通知不存在');
    }

    if (notification.type === 'announcement') {
      // 公告：标记为隐藏
      await this.prisma.sysNotificationRead.upsert({
        where: {
          notificationId_userId: { notificationId, userId },
        },
        create: { notificationId, userId, hidden: true },
        update: { hidden: true },
      });
    } else {
      // 个人消息：检查归属后物理删除
      if (notification.userId !== userId) {
        throw new NotFoundException('通知不存在');
      }
      await this.prisma.sysNotification.delete({
        where: { id: notificationId },
      });
    }

    // 清除未读缓存
    await this.invalidateUnreadCache(userId);

    return { message: '删除成功' };
  }

  // ========== 管理员/系统侧接口 ==========

  /**
   * 发送个人系统消息（内部调用 / 管理员调用）
   */
  async sendNotification(
    dto: CreateNotificationDto,
    sender?: CurrentUserContext,
  ) {
    const notification = await this.prisma.sysNotification.create({
      data: {
        type: 'system',
        title: dto.title,
        content: dto.content,
        userId: dto.userId,
        senderId: sender?.id,
        senderName: sender?.name,
        bizType: dto.bizType,
        bizId: dto.bizId,
        remark: dto.remark,
        createdBy: sender?.id,
      },
    });

    // 推送 SSE
    this.gateway.pushToUser(dto.userId, {
      type: 'notification',
      data: {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        content: notification.content,
        senderId: notification.senderId,
        senderName: notification.senderName,
        bizType: notification.bizType,
        bizId: notification.bizId,
        createdAt: notification.createdAt.toISOString(),
      },
    });

    // 清除目标用户未读缓存
    await this.invalidateUnreadCache(dto.userId);

    // 推送未读计数更新
    const unread = await this.getUnreadCount(dto.userId);
    this.gateway.pushToUser(dto.userId, {
      type: 'unread-count',
      data: unread as unknown as Record<string, unknown>,
    });

    return notification;
  }

  /**
   * 发布系统公告
   */
  async createAnnouncement(
    dto: CreateAnnouncementDto,
    sender: CurrentUserContext,
  ) {
    const announcement = await this.prisma.sysNotification.create({
      data: {
        type: 'announcement',
        title: dto.title,
        content: dto.content,
        userId: null,
        senderId: sender.id,
        senderName: sender.name,
        status: dto.status || 'published',
        remark: dto.remark,
        createdBy: sender.id,
      },
    });

    // 仅已发布的公告推送 SSE 广播
    if (announcement.status === 'published') {
      await this.broadcastAnnouncement(announcement);
    }

    return announcement;
  }

  /**
   * 更新公告
   */
  async updateAnnouncement(
    id: string,
    dto: UpdateAnnouncementDto,
    updater: CurrentUserContext,
  ) {
    const existing = await this.prisma.sysNotification.findUnique({
      where: { id },
    });
    if (!existing || existing.type !== 'announcement') {
      throw new NotFoundException('公告不存在');
    }
    if (existing.status === 'revoked') {
      throw new BadRequestException('已撤回的公告不可编辑');
    }

    return this.prisma.sysNotification.update({
      where: { id },
      data: {
        ...dto,
        updatedBy: updater.id,
      },
    });
  }

  /**
   * 发布草稿公告
   */
  async publishAnnouncement(id: string, publisher: CurrentUserContext) {
    const announcement = await this.prisma.sysNotification.findUnique({
      where: { id },
    });
    if (!announcement || announcement.type !== 'announcement') {
      throw new NotFoundException('公告不存在');
    }
    if (announcement.status !== 'draft') {
      throw new BadRequestException('仅草稿公告可发布');
    }

    const updated = await this.prisma.sysNotification.update({
      where: { id },
      data: { status: 'published', updatedBy: publisher.id },
    });

    await this.broadcastAnnouncement(updated);
    return updated;
  }

  /**
   * 撤回公告
   */
  async revokeAnnouncement(id: string, revoker: CurrentUserContext) {
    const announcement = await this.prisma.sysNotification.findUnique({
      where: { id },
    });
    if (!announcement || announcement.type !== 'announcement') {
      throw new NotFoundException('公告不存在');
    }
    if (announcement.status !== 'published') {
      throw new BadRequestException('仅已发布的公告可撤回');
    }

    const updated = await this.prisma.sysNotification.update({
      where: { id },
      data: { status: 'revoked', updatedBy: revoker.id },
    });

    // 广播撤回事件，前端移除该公告
    this.gateway.broadcast({
      type: 'announcement-revoked',
      data: { id: updated.id },
    });

    // 清除所有在线用户的未读缓存
    await this.redisService.delPattern(`${UNREAD_PREFIX}*`);

    return { message: '公告已撤回' };
  }

  /**
   * 删除公告（管理员）
   */
  async removeAnnouncement(id: string) {
    const announcement = await this.prisma.sysNotification.findUnique({
      where: { id },
    });
    if (!announcement || announcement.type !== 'announcement') {
      throw new NotFoundException('公告不存在');
    }

    // 级联删除 reads 记录（Prisma onDelete: Cascade）
    await this.prisma.sysNotification.delete({ where: { id } });

    // 清除所有用户未读缓存
    await this.redisService.delPattern(`${UNREAD_PREFIX}*`);

    return { message: '删除成功' };
  }

  /**
   * 管理员查询公告列表
   */
  async getAnnouncementList(query: QueryNotificationDto) {
    const { page = 1, pageSize = 10 } = query;

    const where = {
      type: 'announcement',
      userId: null,
    };

    const [data, total] = await Promise.all([
      this.prisma.sysNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.sysNotification.count({ where }),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  // ========== 内部方法 ==========

  /** 广播公告到所有在线用户 */
  private async broadcastAnnouncement(
    announcement: Record<string, unknown>,
  ): Promise<void> {
    this.gateway.broadcast({
      type: 'notification',
      data: {
        id: announcement.id,
        type: 'announcement',
        title: announcement.title,
        content: announcement.content,
        senderId: announcement.senderId,
        senderName: announcement.senderName,
        status: announcement.status,
        createdAt:
          announcement.createdAt instanceof Date
            ? announcement.createdAt.toISOString()
            : announcement.createdAt,
      },
    });

    // 清除所有用户未读缓存
    await this.redisService.delPattern(`${UNREAD_PREFIX}*`);
  }

  /** 清除指定用户的未读缓存 */
  private async invalidateUnreadCache(userId: string): Promise<void> {
    await this.redisService.del(`${UNREAD_PREFIX}${userId}`);
  }
}
