import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateDeptDto, UpdateDeptDto } from './dto';

@Injectable()
export class DeptService {
  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.sysDept.create({
      data: {
        name: dto.name,
        parentId: dto.parentId || null,
        sort: dto.sort || 0,
        status: dto.status,
        remark: dto.remark,
      },
    });
  }

  /**
   * 获取部门树形列表
   */
  async findTree() {
    const depts = await this.prisma.sysDept.findMany({
      orderBy: { sort: 'asc' },
    });

    return this.buildTree(depts);
  }

  /**
   * 获取部门列表（平铺）
   */
  async findAll() {
    return this.prisma.sysDept.findMany({
      orderBy: { sort: 'asc' },
    });
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

    return this.prisma.sysDept.update({
      where: { id },
      data: dto,
    });
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
    return { message: '删除成功' };
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
