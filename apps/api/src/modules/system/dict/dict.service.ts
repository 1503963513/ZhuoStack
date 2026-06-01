import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { RedisService } from '../../../database/redis.service';
import {
  CreateDictDto,
  UpdateDictDto,
  QueryDictDto,
  CreateDictDataDto,
  UpdateDictDataDto,
} from './dto';

// 缓存键前缀
const DICT_CACHE_PREFIX = 'dict:';
const DICT_DATA_CACHE_PREFIX = 'dict:data:';
const DICT_LIST_CACHE_KEY = 'dict:list';
const CACHE_TTL = 3600; // 1 小时

@Injectable()
export class DictService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  // ========== 字典管理 ==========

  /**
   * 创建字典
   */
  async create(dto: CreateDictDto) {
    const existing = await this.prisma.sysDict.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictException('字典编码已存在');
    }

    const result = await this.prisma.sysDict.create({
      data: {
        name: dto.name,
        code: dto.code,
        status: dto.status,
        remark: dto.remark,
      },
    });

    // 清除列表缓存
    await this.redisService.del(DICT_LIST_CACHE_KEY);
    return result;
  }

  /**
   * 获取字典列表（分页）
   */
  async findAll(query: QueryDictDto) {
    const { page = 1, pageSize = 10, search } = query;
    const skip = (page - 1) * pageSize;

    // 尝试从缓存获取（仅第一页且无搜索条件时）
    if (page === 1 && !search) {
      const cached = await this.redisService.get(DICT_LIST_CACHE_KEY);
      if (cached) return cached;
    }

    const where = search
      ? {
          OR: [
            { name: { contains: search } },
            { code: { contains: search } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.sysDict.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.sysDict.count({ where }),
    ]);

    const result = {
      data,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };

    // 缓存第一页
    if (page === 1 && !search) {
      await this.redisService.set(DICT_LIST_CACHE_KEY, result, CACHE_TTL);
    }

    return result;
  }

  /**
   * 获取字典详情
   */
  async findOne(id: string) {
    const cacheKey = `${DICT_CACHE_PREFIX}${id}`;

    // 尝试从缓存获取
    const cached = await this.redisService.get(cacheKey);
    if (cached) return cached;

    const dict = await this.prisma.sysDict.findUnique({
      where: { id },
      include: { dictData: { orderBy: { sort: 'asc' } } },
    });

    if (!dict) {
      throw new NotFoundException(`字典 ${id} 不存在`);
    }

    // 设置缓存
    await this.redisService.set(cacheKey, dict, CACHE_TTL);
    return dict;
  }

  /**
   * 根据编码获取字典数据（高频接口，使用缓存）
   */
  async findByCode(code: string) {
    const cacheKey = `${DICT_DATA_CACHE_PREFIX}${code}`;

    // 尝试从缓存获取
    const cached = await this.redisService.get(cacheKey);
    if (cached) return cached;

    const dict = await this.prisma.sysDict.findUnique({
      where: { code },
      include: {
        dictData: {
          where: { status: 'ACTIVE' },
          orderBy: { sort: 'asc' },
        },
      },
    });

    if (!dict) {
      throw new NotFoundException(`字典 ${code} 不存在`);
    }

    // 设置缓存（字典数据变化不频繁，缓存时间较长）
    await this.redisService.set(cacheKey, dict, CACHE_TTL * 2);
    return dict;
  }

  /**
   * 更新字典
   */
  async update(id: string, dto: UpdateDictDto) {
    // 直接查询字典（不带 include，减少查询开销）
    const dict = await this.prisma.sysDict.findUnique({ where: { id } });
    if (!dict) {
      throw new NotFoundException(`字典 ${id} 不存在`);
    }

    // 如果修改了编码，检查唯一性
    if (dto.code && dto.code !== dict.code) {
      const existing = await this.prisma.sysDict.findUnique({
        where: { code: dto.code },
      });
      if (existing) {
        throw new ConflictException('字典编码已存在');
      }
    }

    const result = await this.prisma.sysDict.update({
      where: { id },
      data: dto,
    });

    // 清除相关缓存
    await this.redisService.del(`${DICT_CACHE_PREFIX}${id}`);
    await this.redisService.del(`${DICT_DATA_CACHE_PREFIX}${dict.code}`);
    if (dto.code && dto.code !== dict.code) {
      await this.redisService.del(`${DICT_DATA_CACHE_PREFIX}${dto.code}`);
    }
    await this.redisService.del(DICT_LIST_CACHE_KEY);

    return result;
  }

  /**
   * 删除字典
   */
  async remove(id: string) {
    const dict = await this.findOne(id) as any;

    await this.prisma.sysDict.delete({ where: { id } });

    // 清除相关缓存
    await this.redisService.del(`${DICT_CACHE_PREFIX}${id}`);
    if (dict.code) {
      await this.redisService.del(`${DICT_DATA_CACHE_PREFIX}${dict.code}`);
    }
    await this.redisService.del(DICT_LIST_CACHE_KEY);

    return { message: '删除成功' };
  }

  // ========== 字典数据管理 ==========

  /**
   * 创建字典数据
   */
  async createData(dto: CreateDictDataDto) {
    const result = await this.prisma.sysDictData.create({
      data: {
        dictId: dto.dictId,
        label: dto.label,
        value: dto.value,
        sort: dto.sort || 0,
        status: dto.status,
        remark: dto.remark,
      },
    });

    // 清除字典数据缓存
    await this.clearDictDataCache(dto.dictId);
    return result;
  }

  /**
   * 获取字典数据列表
   */
  async findDataByDictId(dictId: string) {
    return this.prisma.sysDictData.findMany({
      where: { dictId },
      orderBy: { sort: 'asc' },
    });
  }

  /**
   * 更新字典数据
   */
  async updateData(id: string, dto: UpdateDictDataDto) {
    const data = await this.prisma.sysDictData.findUnique({
      where: { id },
    });

    if (!data) {
      throw new NotFoundException(`字典数据 ${id} 不存在`);
    }

    const result = await this.prisma.sysDictData.update({
      where: { id },
      data: dto,
    });

    // 清除字典数据缓存
    await this.clearDictDataCache(data.dictId);
    return result;
  }

  /**
   * 删除字典数据
   */
  async removeData(id: string) {
    const data = await this.prisma.sysDictData.findUnique({
      where: { id },
    });

    if (!data) {
      throw new NotFoundException(`字典数据 ${id} 不存在`);
    }

    await this.prisma.sysDictData.delete({ where: { id } });

    // 清除字典数据缓存
    await this.clearDictDataCache(data.dictId);
    return { message: '删除成功' };
  }

  /**
   * 清除字典数据缓存
   */
  private async clearDictDataCache(dictId: string): Promise<void> {
    const dict = await this.prisma.sysDict.findUnique({
      where: { id: dictId },
    });
    if (dict) {
      await this.redisService.del(`${DICT_DATA_CACHE_PREFIX}${dict.code}`);
      await this.redisService.del(`${DICT_CACHE_PREFIX}${dictId}`);
    }
  }
}
