import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { RedisService } from '../../../database/redis.service';
import { CreateConfigDto } from './dto/create-config.dto';
import { UpdateConfigDto } from './dto/update-config.dto';
import { QueryConfigDto } from './dto/query-config.dto';
import { Prisma } from '@prisma/client';

const CONFIG_CACHE_PREFIX = 'sys:config:';
const CONFIG_PUBLIC_CACHE_KEY = 'sys:config:public';

@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * 获取所有对前端公开的系统参数（免登录接口，Redis 缓存）
   */
  async getPublicConfigs(): Promise<Record<string, string>> {
    const cached = await this.redisService.get<Record<string, string>>(CONFIG_PUBLIC_CACHE_KEY);
    if (cached) return cached;

    const list = await this.prisma.sysConfig.findMany({
      where: { isPublic: true, status: 'ACTIVE' },
      select: { key: true, value: true },
    });

    const result: Record<string, string> = {};
    for (const item of list) {
      result[item.key] = item.value;
    }

    await this.redisService.set(CONFIG_PUBLIC_CACHE_KEY, result, 3600);
    return result;
  }

  /**
   * 根据键名读取参数值（后端 Service 内部调用或管理接口）
   */
  async getValueByKey(key: string): Promise<string | null> {
    const cacheKey = `${CONFIG_CACHE_PREFIX}${key}`;
    const cached = await this.redisService.get<string>(cacheKey);
    if (cached !== null) return cached;

    const config = await this.prisma.sysConfig.findUnique({
      where: { key },
      select: { value: true, status: true },
    });

    if (!config || config.status !== 'ACTIVE') return null;

    await this.redisService.set(cacheKey, config.value, 3600);
    return config.value;
  }

  /**
   * 分页查询配置列表（管理后台）
   */
  async findAll(query: QueryConfigDto) {
    const { page = 1, pageSize = 10, search, group } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.SysConfigWhereInput = {};
    if (group && group !== 'all') {
      where.group = group;
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { key: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.sysConfig.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.sysConfig.count({ where }),
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

  /**
   * 获取单个配置详情
   */
  async findOne(id: string) {
    const config = await this.prisma.sysConfig.findUnique({ where: { id } });
    if (!config) throw new NotFoundException('配置项不存在');
    return config;
  }

  /**
   * 创建配置
   */
  async create(dto: CreateConfigDto) {
    const existing = await this.prisma.sysConfig.findUnique({
      where: { key: dto.key },
    });
    if (existing) throw new ConflictException(`配置键名 ${dto.key} 已存在`);

    const result = await this.prisma.sysConfig.create({ data: dto });
    await this.clearCache(dto.key);
    return result;
  }

  /**
   * 更新配置
   */
  async update(id: string, dto: UpdateConfigDto) {
    const config = await this.prisma.sysConfig.findUnique({ where: { id } });
    if (!config) throw new NotFoundException('配置项不存在');

    if (dto.key && dto.key !== config.key) {
      const existing = await this.prisma.sysConfig.findUnique({
        where: { key: dto.key },
      });
      if (existing) throw new ConflictException(`配置键名 ${dto.key} 已存在`);
    }

    const result = await this.prisma.sysConfig.update({
      where: { id },
      data: dto,
    });

    await this.clearCache(config.key);
    if (dto.key && dto.key !== config.key) {
      await this.clearCache(dto.key);
    }
    return result;
  }

  /**
   * 删除配置
   */
  async remove(id: string) {
    const config = await this.prisma.sysConfig.findUnique({ where: { id } });
    if (!config) throw new NotFoundException('配置项不存在');

    await this.prisma.sysConfig.delete({ where: { id } });
    await this.clearCache(config.key);
    return { message: '删除成功' };
  }

  /**
   * 清除指定或全局缓存
   */
  private async clearCache(key: string) {
    try {
      await this.redisService.del(`${CONFIG_CACHE_PREFIX}${key}`);
      await this.redisService.del(CONFIG_PUBLIC_CACHE_KEY);
    } catch (e) {
      this.logger.warn(`清除参数缓存失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
