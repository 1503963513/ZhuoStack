import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { RedisService } from '../../../database/redis.service';
import { CreateMenuDto, UpdateMenuDto } from './dto';

// 缓存键
const MENU_TREE_CACHE_KEY = 'menu:tree';
const MENU_LIST_CACHE_KEY = 'menu:list';
const MENU_CACHE_PREFIX = 'menu:';
const CACHE_TTL = 3600; // 1 小时

@Injectable()
export class MenuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * 创建菜单
   */
  async create(dto: CreateMenuDto) {
    const result = await this.prisma.sysMenu.create({
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

    // 清除菜单缓存
    await this.clearMenuCache();
    return result;
  }

  /**
   * 获取菜单树形列表（高频接口，使用缓存）
   */
  async findTree() {
    // 尝试从缓存获取
    const cached = await this.redisService.get(MENU_TREE_CACHE_KEY);
    if (cached) return cached;

    const menus = await this.prisma.sysMenu.findMany({
      orderBy: { sort: 'asc' },
    });

    const tree = this.buildTree(menus);

    // 设置缓存
    await this.redisService.set(MENU_TREE_CACHE_KEY, tree, CACHE_TTL);
    return tree;
  }

  /**
   * 获取菜单列表（平铺）
   */
  async findAll() {
    // 尝试从缓存获取
    const cached = await this.redisService.get(MENU_LIST_CACHE_KEY);
    if (cached) return cached;

    const menus = await this.prisma.sysMenu.findMany({
      orderBy: { sort: 'asc' },
    });

    // 设置缓存
    await this.redisService.set(MENU_LIST_CACHE_KEY, menus, CACHE_TTL);
    return menus;
  }

  /**
   * 获取菜单详情
   */
  async findOne(id: string) {
    const cacheKey = `${MENU_CACHE_PREFIX}${id}`;

    // 尝试从缓存获取
    const cached = await this.redisService.get(cacheKey);
    if (cached) return cached;

    const menu = await this.prisma.sysMenu.findUnique({
      where: { id },
    });

    if (!menu) {
      throw new NotFoundException(`菜单 ${id} 不存在`);
    }

    // 设置缓存
    await this.redisService.set(cacheKey, menu, CACHE_TTL);
    return menu;
  }

  /**
   * 更新菜单
   */
  async update(id: string, dto: UpdateMenuDto) {
    await this.findOne(id);

    const result = await this.prisma.sysMenu.update({
      where: { id },
      data: dto,
    });

    // 清除菜单缓存
    await this.clearMenuCache();
    return result;
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

    // 清除菜单缓存
    await this.clearMenuCache();
    return { message: '删除成功' };
  }

  /**
   * 清除菜单缓存
   */
  private async clearMenuCache(): Promise<void> {
    await this.redisService.del(MENU_TREE_CACHE_KEY);
    await this.redisService.del(MENU_LIST_CACHE_KEY);
    await this.redisService.delPattern(`${MENU_CACHE_PREFIX}*`);
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
