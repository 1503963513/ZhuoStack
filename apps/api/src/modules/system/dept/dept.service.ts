import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateDeptDto, UpdateDeptDto } from './dto';
import type { SysDept } from '@prisma/client';
import { DataScopeActor, DataScopeService } from '../../../common/access/data-scope.service';

type DeptTreeNode = SysDept & { children: DeptTreeNode[] };

@Injectable()
export class DeptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  /**
   * 创建部门
   */
  async create(dto: CreateDeptDto, actor: DataScopeActor) {
    if (dto.parentId) await this.dataScopeService.assertCanAccessDept(dto.parentId, actor);
    else await this.dataScopeService.assertCanManageRootDept(actor);
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

    return result;
  }

  /**
   * 获取部门树形列表
   */
  async findTree(actor: DataScopeActor) {
    const visibleIds = await this.dataScopeService.getVisibleDeptIds(actor);
    const depts = await this.prisma.sysDept.findMany({
      where: visibleIds === null ? {} : { id: { in: visibleIds } },
      orderBy: { sort: 'asc' },
    });

    return this.buildTree(depts);
  }

  /**
   * 获取部门列表（平铺）
   */
  async findAll(actor: DataScopeActor) {
    const visibleIds = await this.dataScopeService.getVisibleDeptIds(actor);
    const depts = await this.prisma.sysDept.findMany({
      where: visibleIds === null ? {} : { id: { in: visibleIds } },
      orderBy: { sort: 'asc' },
    });

    return depts;
  }

  /**
   * 获取部门详情
   */
  async findOne(id: string, actor: DataScopeActor) {
    await this.dataScopeService.assertCanAccessDept(id, actor);
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
  async update(id: string, dto: UpdateDeptDto, actor: DataScopeActor) {
    const current = await this.findOne(id, actor);
    if (dto.parentId !== undefined && dto.parentId !== current.parentId) {
      await this.dataScopeService.assertCanManageDeptSubtree(id, actor);
    }
    if (dto.parentId) await this.dataScopeService.assertCanAccessDept(dto.parentId, actor);
    else if (dto.parentId === null) await this.dataScopeService.assertCanManageRootDept(actor);

    // name 或 parentId 任一变化时，校验同级唯一性
    if (dto.name !== undefined || dto.parentId !== undefined) {
      const name = dto.name ?? current.name;
      const parentId = dto.parentId !== undefined ? (dto.parentId || null) : current.parentId;

      const existing = await this.prisma.sysDept.findFirst({
        where: {
          name,
          parentId,
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

    return result;
  }

  /**
   * 删除部门
   */
  async remove(id: string, actor: DataScopeActor) {
    await this.findOne(id, actor);

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
  private buildTree(
    depts: SysDept[],
    parentId: string | null = null,
  ): DeptTreeNode[] {
    const visibleIds = new Set(depts.map((dept) => dept.id));
    return depts
      .filter((dept) =>
        parentId === null
          ? !dept.parentId || !visibleIds.has(dept.parentId)
          : dept.parentId === parentId,
      )
      .map((dept) => ({
        ...dept,
        children: this.buildTree(depts, dept.id),
      }));
  }
}
