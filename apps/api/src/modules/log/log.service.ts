import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

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
   * 清空操作日志
   */
  async clearOperLogs() {
    await this.prisma.sysOperLog.deleteMany({});
    return { message: '操作日志已清空' };
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
   * 清空登录日志
   */
  async clearLoginLogs() {
    await this.prisma.sysLoginLog.deleteMany({});
    return { message: '登录日志已清空' };
  }
}
