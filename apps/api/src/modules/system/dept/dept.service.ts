import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { RedisService } from '../../../database/redis.service';
import { CreateDeptDto, UpdateDeptDto } from './dto';

// 缓存键
const DEPT_TREE_CACHE_KEY = 'dept:tree';
const DEPT_LIST_CACHE_KEY = 'dept:list';
const CACHE_TTL = 3600; // 1 小时

@Injectable()
export class DeptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * 创建部门
   */
  async create(dto: CreateDeptDto) {
    const existing = await this.prisma.sysDept.findFirst({
      where: { name: dto.name, parentId: dto.parentId || null },
    });

    if (existing) {
      throw new ConflictException('同级下已存在同名部门');
    }

    const result = await this.prisma.sysDept.create({
      data: {
        name: dto.name,
        parentId: dto.parentId || null,
        sort: dto.sort || 0,
        status: dto.status,
        remark: dto.remark,
      },
    });

    // 清除部门缓存
    await this.clearDeptCache();
    return result;
  }

  /**
   * 获取部门树形列表（使用缓存）
   */
  async findTree() {
    // 尝试从缓存获取
    const cached = await this.redisService.get(DEPT_TREE_CACHE_KEY);
    if (cached) return cached;

    const depts = await this.prisma.sysDept.findMany({
      orderBy: { sort: 'asc' },
    });

    const tree = this.buildTree(depts);

    // 设置缓存
    await this.redisService.set(DEPT_TREE_CACHE_KEY, tree, CACHE_TTL);
    return tree;
  }

  /**
   * 获取部门列表（平铺）
   */
  async findAll() {
    // 尝试从缓存获取
    const cached = await this.redisService.get(DEPT_LIST_CACHE_KEY);
    if (cached) return cached;

    const depts = await this.prisma.sysDept.findMany({
      orderBy: { sort: 'asc' },
    });

    // 设置缓存
    await this.redisService.set(DEPT_LIST_CACHE_KEY, depts, CACHE_TTL);
    return depts;
  }

  /**
   * 获取部门详情
   */
  async findOne(id: string) {
    const dept = await this.prisma.sysDept.findUnique({
      where: { id },
    });

    if (!dept) {
      throw new NotFoundException(`部门 ${id} 不存在`);
    }

    return dept;
  }

  /**
   * 更新部门
   */
  async update(id: string, dto: UpdateDeptDto) {
    await this.findOne(id);

    if (dto.name && dto.parentId !== undefined) {
      const existing = await this.prisma.sysDept.findFirst({
        where: {
          name: dto.name,
          parentId: dto.parentId || null,
          id: { not: id },
        },
      });

      if (existing) {
        throw new ConflictException('同级下已存在同名部门');
      }
    }

    const result = await this.prisma.sysDept.update({
      where: { id },
      data: dto,
    });

    // 清除部门缓存
    await this.clearDeptCache();
    return result;
  }

  /**
   * 删除部门
   */
  async remove(id: string) {
    await this.findOne(id);

    // 检查是否有子部门
    const children = await this.prisma.sysDept.findMany({
      where: { parentId: id },
    });

    if (children.length > 0) {
      throw new ConflictException('该部门下存在子部门，无法删除');
    }

    // 检查是否有用户
    const users = await this.prisma.user.findMany({
      where: { deptId: id },
    });

    if (users.length > 0) {
      throw new ConflictException('该部门下存在用户，无法删除');
    }

    await this.prisma.sysDept.delete({ where: { id } });

    // 清除部门缓存
    await this.clearDeptCache();
    return { message: '删除成功' };
  }

  /**
   * 清除部门缓存
   */
  private async clearDeptCache(): Promise<void> {
    await this.redisService.del(DEPT_TREE_CACHE_KEY);
    await this.redisService.del(DEPT_LIST_CACHE_KEY);
  }

  /**
   * 构建树形结构
   */
  private buildTree(depts: any[], parentId: string | null = null): any[] {
    return depts
      .filter((dept) => dept.parentId === parentId)
      .map((dept) => ({
        ...dept,
        children: this.buildTree(depts, dept.id),
      }));
  }
}
