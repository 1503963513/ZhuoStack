import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role, Status } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

interface PermissionUser {
  id: string;
  role?: Role;
}

interface RoleMenuPermission {
  path: string | null;
  perms: string | null;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredPermissions?.length) return true;

    const request = context.switchToHttp().getRequest<{ user?: PermissionUser }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('无权访问该资源');
    }

    // 内置管理员保持全局兜底权限，自定义角色完全由菜单/按钮权限决定。
    if (user.role === Role.ADMIN) return true;

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        roles: {
          where: { status: Status.ACTIVE },
          select: {
            menus: {
              where: { status: Status.ACTIVE },
              select: { path: true, perms: true },
            },
          },
        },
      },
    });

    if (!dbUser) {
      throw new ForbiddenException('用户不存在或角色已失效');
    }

    const menus = dbUser.roles.flatMap((role) => role.menus);
    const allowed = requiredPermissions.some((required) =>
      menus.some((menu) => this.menuMatchesPermission(menu, required)),
    );

    if (!allowed) {
      throw new ForbiddenException('无权访问该资源');
    }

    return true;
  }

  private menuMatchesPermission(menu: RoleMenuPermission, required: string): boolean {
    if (menu.perms === required) return true;

    // 拥有模块内任一操作权限时，允许读取该模块的基础数据。
    if (menu.perms?.startsWith(`${required}:`)) return true;

    // 已分配菜单资源本身（例如 /system/user）即拥有该模块的读取权限。
    const resourcePath = `/${required.split(':').join('/')}`;
    return menu.path === resourcePath;
  }
}
