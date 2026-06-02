import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

// 日志清空时保留最近 N 天的记录
const LOG_RETENTION_DAYS = 7;
// 单次最多删除的记录数
const MAX_DELETE_BATCH = 5000;

@Injectable()
export class LogService {
  constructor(private readonly prisma: PrismaService) {}

  // ========== 操作日志 ==========

  /**
   * 记录操作日志
   */
  async createOperLog(data: {
    title: string;
    businessType?: number;
    method: string;
    requestMethod: string;
    url: string;
    ip: string;
    operName?: string;
    status?: number;
    jsonResult?: string;
    errorMsg?: string;
  }) {
    return this.prisma.sysOperLog.create({ data });
  }

  /**
   * 获取操作日志列表
   */
  async findOperLogs(query: { page?: number; pageSize?: number; title?: string; status?: number }) {
    const { page = 1, pageSize = 10, title, status } = query;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (title) where.title = { contains: title };
    if (status !== undefined) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.sysOperLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { operTime: 'desc' },
      }),
      this.prisma.sysOperLog.count({ where }),
    ]);

    return {
      data,
      pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    };
  }

  /**
   * 清空操作日志（保留最近 7 天，单次最多删 5000 条）
   */
  async clearOperLogs() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - LOG_RETENTION_DAYS);

    // 先查出要删除的 ID（限制数量）
    const records = await this.prisma.sysOperLog.findMany({
      where: { operTime: { lt: cutoffDate } },
      select: { id: true },
      take: MAX_DELETE_BATCH,
    });

    if (records.length === 0) {
      return { message: `没有超过 ${LOG_RETENTION_DAYS} 天的日志可清除` };
    }

    const ids = records.map((r) => r.id);
    await this.prisma.sysOperLog.deleteMany({
      where: { id: { in: ids } },
    });

    return { message: `已清除 ${ids.length} 条超过 ${LOG_RETENTION_DAYS} 天的操作日志` };
  }

  // ========== 登录日志 ==========

  /**
   * 记录登录日志
   */
  async createLoginLog(data: {
    username: string;
    ip: string;
    location?: string;
    browser?: string;
    os?: string;
    status: number;
    msg?: string;
  }) {
    return this.prisma.sysLoginLog.create({ data });
  }

  /**
   * 获取登录日志列表
   */
  async findLoginLogs(query: { page?: number; pageSize?: number; username?: string; status?: number }) {
    const { page = 1, pageSize = 10, username, status } = query;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (username) where.username = { contains: username };
    if (status !== undefined) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.sysLoginLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { loginTime: 'desc' },
      }),
      this.prisma.sysLoginLog.count({ where }),
    ]);

    return {
      data,
      pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    };
  }

  /**
   * 清空登录日志（保留最近 7 天，单次最多删 5000 条）
   */
  async clearLoginLogs() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - LOG_RETENTION_DAYS);

    const records = await this.prisma.sysLoginLog.findMany({
      where: { loginTime: { lt: cutoffDate } },
      select: { id: true },
      take: MAX_DELETE_BATCH,
    });

    if (records.length === 0) {
      return { message: `没有超过 ${LOG_RETENTION_DAYS} 天的日志可清除` };
    }

    const ids = records.map((r) => r.id);
    await this.prisma.sysLoginLog.deleteMany({
      where: { id: { in: ids } },
    });

    return { message: `已清除 ${ids.length} 条超过 ${LOG_RETENTION_DAYS} 天的登录日志` };
  }
}
