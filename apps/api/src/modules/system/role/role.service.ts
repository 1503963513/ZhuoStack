import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateRoleDto, UpdateRoleDto, QueryRoleDto } from './dto';

@Injectable()
export class RoleService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 创建角色
   */
  async create(dto: CreateRoleDto) {
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
        remark: dto.remark,
        menus: dto.menuIds?.length
          ? { connect: dto.menuIds.map((id) => ({ id })) }
          : undefined,
      },
      include: { menus: true },
    });
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
        include: { menus: true },
        skip,
        take: pageSize,
        orderBy: { sort: 'asc' },
      }),
      this.prisma.sysRole.count({ where }),
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
      include: { menus: true },
    });

    if (!role) {
      throw new NotFoundException(`角色 ${id} 不存在`);
    }

    return role;
  }

  /**
   * 更新角色
   */
  async update(id: string, dto: UpdateRoleDto) {
    await this.findOne(id);

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
        remark: dto.remark,
        menus: dto.menuIds
          ? { set: dto.menuIds.map((menuId) => ({ id: menuId })) }
          : undefined,
      },
      include: { menus: true },
    });
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
}
