import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  CreateDictDto,
  UpdateDictDto,
  QueryDictDto,
  CreateDictDataDto,
  UpdateDictDataDto,
} from './dto';

@Injectable()
export class DictService {
  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.sysDict.create({
      data: {
        name: dto.name,
        code: dto.code,
        status: dto.status,
        remark: dto.remark,
      },
    });
  }

  /**
   * 获取字典列表（分页）
   */
  async findAll(query: QueryDictDto) {
    const { page = 1, pageSize = 10, search } = query;
    const skip = (page - 1) * pageSize;

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
   * 获取字典详情
   */
  async findOne(id: string) {
    const dict = await this.prisma.sysDict.findUnique({
      where: { id },
      include: { dictData: { orderBy: { sort: 'asc' } } },
    });

    if (!dict) {
      throw new NotFoundException(`字典 ${id} 不存在`);
    }

    return dict;
  }

  /**
   * 根据编码获取字典数据
   */
  async findByCode(code: string) {
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

    return dict;
  }

  /**
   * 更新字典
   */
  async update(id: string, dto: UpdateDictDto) {
    await this.findOne(id);

    if (dto.code) {
      const existing = await this.prisma.sysDict.findUnique({
        where: { code: dto.code },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException('字典编码已存在');
      }
    }

    return this.prisma.sysDict.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * 删除字典
   */
  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.sysDict.delete({ where: { id } });
    return { message: '删除成功' };
  }

  // ========== 字典数据管理 ==========

  /**
   * 创建字典数据
   */
  async createData(dto: CreateDictDataDto) {
    return this.prisma.sysDictData.create({
      data: {
        dictId: dto.dictId,
        label: dto.label,
        value: dto.value,
        sort: dto.sort || 0,
        status: dto.status,
        remark: dto.remark,
      },
    });
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

    return this.prisma.sysDictData.update({
      where: { id },
      data: dto,
    });
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
    return { message: '删除成功' };
  }
}
