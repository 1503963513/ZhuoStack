import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { NotificationGateway } from './notification.gateway';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../database/redis.service';

describe('NotificationService', () => {
  let service: NotificationService;

  const mockPrismaService = {
    sysNotification: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    sysNotificationRead: {
      findMany: jest.fn(),
      count: jest.fn(),
      upsert: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const mockRedisService = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    delPattern: jest.fn().mockResolvedValue(undefined),
  };

  const mockGateway = {
    subscribe: jest.fn(),
    pushToUser: jest.fn(),
    broadcast: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: NotificationGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUnreadCount', () => {
    it('应优先返回 Redis 缓存的未读计数', async () => {
      const cached = { total: 5, announcement: 2, system: 3 };
      mockRedisService.get.mockResolvedValueOnce(cached);

      const result = await service.getUnreadCount('user-1');
      expect(result).toEqual(cached);
      expect(mockPrismaService.sysNotification.count).not.toHaveBeenCalled();
    });

    it('无缓存时应计算未读数并回写 Redis', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);
      mockPrismaService.sysNotification.count.mockResolvedValueOnce(3);
      mockPrismaService.sysNotification.count.mockResolvedValueOnce(5);
      mockPrismaService.sysNotificationRead.count.mockResolvedValueOnce(2);

      const result = await service.getUnreadCount('user-1');
      expect(result).toEqual({ total: 6, announcement: 3, system: 3 });
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'notification:unread:user-1',
        { total: 6, announcement: 3, system: 3 },
        300,
      );
    });
  });

  describe('markAsRead', () => {
    it('标记个人消息已读', async () => {
      mockPrismaService.sysNotification.findUnique.mockResolvedValueOnce({
        id: 'notif-1',
        type: 'system',
        userId: 'user-1',
      });
      mockPrismaService.sysNotification.update.mockResolvedValueOnce({});

      const result = await service.markAsRead('notif-1', 'user-1');
      expect(result).toEqual({ message: '已标记为已读' });
      expect(mockPrismaService.sysNotification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: expect.objectContaining({ isRead: true }),
      });
      expect(mockRedisService.del).toHaveBeenCalledWith('notification:unread:user-1');
    });

    it('标记公告已读时写入 reads 表', async () => {
      mockPrismaService.sysNotification.findUnique.mockResolvedValueOnce({
        id: 'ann-1',
        type: 'announcement',
        userId: null,
      });
      mockPrismaService.sysNotificationRead.upsert.mockResolvedValueOnce({});

      const result = await service.markAsRead('ann-1', 'user-1');
      expect(result).toEqual({ message: '已标记为已读' });
      expect(mockPrismaService.sysNotificationRead.upsert).toHaveBeenCalledWith({
        where: {
          notificationId_userId: { notificationId: 'ann-1', userId: 'user-1' },
        },
        create: { notificationId: 'ann-1', userId: 'user-1' },
        update: {},
      });
    });
  });

  describe('getUserNotifications', () => {
    it('按未读状态筛选时，应将已读公告排除出查询条件', async () => {
      mockPrismaService.sysNotificationRead.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ notificationId: 'ann-read-1' }]);

      mockPrismaService.sysNotification.findMany.mockResolvedValueOnce([]);
      mockPrismaService.sysNotification.count.mockResolvedValueOnce(0);

      await service.getUserNotifications('user-1', { isRead: false });

      expect(mockPrismaService.sysNotification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                type: 'announcement',
                id: { notIn: ['ann-read-1'] },
              }),
            ]),
          }),
        }),
      );
    });
  });
});
