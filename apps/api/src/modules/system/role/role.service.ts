import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateRoleDto, UpdateRoleDto, QueryRoleDto } from './dto';
import { DataScope, Role } from '@prisma/client';
import type { DataScopeActor } from '../../../common/access/data-scope.service';

const roleInclude = { menus: true, dataDepts: { select: { id: true } } } as const;

function mapRole<T extends { dataDepts: { id: string }[] }>(role: T) {
  const { dataDepts, ...rest } = role;
  return { ...rest, dataDeptIds: dataDepts.map(({ id }) => id) };
}

@Injectable()
export class RoleService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 创建角色
   */
  async create(dto: CreateRoleDto) {
    this.validateDataScope(dto.dataScope ?? DataScope.ALL, dto.dataDeptIds);
    const existing = await this.prisma.sysRole.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictException('角色标识已存在');
    }

    return this.prisma.sysRole.create({
      data: {
        name: dto.name,
        code: dto.code,
        sort: dto.sort || 0,
        status: dto.status,
        dataScope: dto.dataScope ?? DataScope.ALL,
        remark: dto.remark,
        menus: dto.menuIds?.length
          ? { connect: dto.menuIds.map((id) => ({ id })) }
          : undefined,
        dataDepts: (dto.dataScope ?? DataScope.ALL) === DataScope.CUSTOM
          ? { connect: dto.dataDeptIds!.map((id) => ({ id })) }
          : undefined,
      },
      include: roleInclude,
    }).then(mapRole);
  }

  /**
   * 获取角色列表（分页）
   */
  async findAll(query: QueryRoleDto) {
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
      this.prisma.sysRole.findMany({
        where,
        include: roleInclude,
        skip,
        take: pageSize,
        orderBy: { sort: 'asc' },
      }),
      this.prisma.sysRole.count({ where }),
    ]);

    return {
      data: data.map(mapRole),
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 获取所有角色（不分页，用于下拉选择）
   */
  async findAllSimple() {
    return this.prisma.sysRole.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, code: true },
      orderBy: { sort: 'asc' },
    });
  }

  /**
   * 获取角色详情
   */
  async findOne(id: string) {
    const role = await this.prisma.sysRole.findUnique({
      where: { id },
      include: roleInclude,
    });

    if (!role) {
      throw new NotFoundException(`角色 ${id} 不存在`);
    }

    return mapRole(role);
  }

  /**
   * 更新角色
   */
  async update(id: string, dto: UpdateRoleDto, actor: DataScopeActor) {
    if (
      actor.role !== Role.ADMIN &&
      (dto.dataScope !== undefined || dto.dataDeptIds !== undefined)
    ) {
      throw new ForbiddenException('仅系统管理员可以修改角色的数据范围');
    }

    const current = await this.findOne(id);
    const dataScope = dto.dataScope ?? current.dataScope;
    const dataDeptIds = dto.dataDeptIds ?? current.dataDeptIds;
    this.validateDataScope(dataScope, dataDeptIds);

    if (dto.code) {
      const existing = await this.prisma.sysRole.findUnique({
        where: { code: dto.code },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException('角色标识已存在');
      }
    }

    return this.prisma.sysRole.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code,
        sort: dto.sort,
        status: dto.status,
        ...(dto.dataScope !== undefined && { dataScope: dto.dataScope }),
        remark: dto.remark,
        menus: dto.menuIds
          ? { set: dto.menuIds.map((menuId) => ({ id: menuId })) }
          : undefined,
        ...(dto.dataScope !== undefined || dto.dataDeptIds !== undefined
          ? {
              dataDepts: {
                set: dataScope === DataScope.CUSTOM
                  ? dataDeptIds.map((deptId) => ({ id: deptId }))
                  : [],
              },
            }
          : {}),
      },
      include: roleInclude,
    }).then(mapRole);
  }

  /**
   * 删除角色
   */
  async remove(id: string) {
    await this.findOne(id);

    // 检查是否有关联用户
    const users = await this.prisma.user.findMany({
      where: { roles: { some: { id } } },
    });

    if (users.length > 0) {
      throw new ConflictException('该角色下存在用户，无法删除');
    }

    await this.prisma.sysRole.delete({ where: { id } });
    return { message: '删除成功' };
  }

  private validateDataScope(dataScope: DataScope, dataDeptIds?: string[]) {
    if (dataScope === DataScope.CUSTOM && !dataDeptIds?.length) {
      throw new ConflictException('自定义数据范围至少需要选择一个部门');
    }
  }
}
