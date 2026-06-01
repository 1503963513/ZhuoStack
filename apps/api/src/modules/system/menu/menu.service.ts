import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateMenuDto, UpdateMenuDto } from './dto';

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 创建菜单
   */
  async create(dto: CreateMenuDto) {
    return this.prisma.sysMenu.create({
      data: {
        name: dto.name,
        parentId: dto.parentId || null,
        type: dto.type,
        path: dto.path,
        component: dto.component,
        icon: dto.icon,
        sort: dto.sort || 0,
        status: dto.status,
        perms: dto.perms,
        remark: dto.remark,
      },
    });
  }

  /**
   * 获取菜单树形列表
   */
  async findTree() {
    const menus = await this.prisma.sysMenu.findMany({
      orderBy: { sort: 'asc' },
    });

    return this.buildTree(menus);
  }

  /**
   * 获取菜单列表（平铺）
   */
  async findAll() {
    return this.prisma.sysMenu.findMany({
      orderBy: { sort: 'asc' },
    });
  }

  /**
   * 获取菜单详情
   */
  async findOne(id: string) {
    const menu = await this.prisma.sysMenu.findUnique({
      where: { id },
    });

    if (!menu) {
      throw new NotFoundException(`菜单 ${id} 不存在`);
    }

    return menu;
  }

  /**
   * 更新菜单
   */
  async update(id: string, dto: UpdateMenuDto) {
    await this.findOne(id);

    return this.prisma.sysMenu.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * 删除菜单
   */
  async remove(id: string) {
    await this.findOne(id);

    // 检查是否有子菜单
    const children = await this.prisma.sysMenu.findMany({
      where: { parentId: id },
    });

    if (children.length > 0) {
      throw new ConflictException('该菜单下存在子菜单，无法删除');
    }

    await this.prisma.sysMenu.delete({ where: { id } });
    return { message: '删除成功' };
  }

  /**
   * 构建树形结构
   */
  private buildTree(menus: any[], parentId: string | null = null): any[] {
    return menus
      .filter((menu) => menu.parentId === parentId)
      .map((menu) => ({
        ...menu,
        children: this.buildTree(menus, menu.id),
      }));
  }
}
