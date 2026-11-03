import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
  function createContext(user?: { id: string; role: Role }): ExecutionContext {
    return {
      getHandler: () => function handler() {},
      getClass: () => class Controller {},
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
  }

  function createGuard(
    required: string[] | undefined,
    menus: Array<{ path: string | null; perms: string | null }>,
  ) {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(required),
    } as unknown as Reflector;
    const findUnique = jest.fn().mockResolvedValue({ roles: [{ menus }] });
    const prisma = { user: { findUnique } } as unknown as PrismaService;
    return { guard: new PermissionsGuard(reflector, prisma), findUnique };
  }

  it('未声明权限要求的接口直接放行', async () => {
    const { guard, findUnique } = createGuard(undefined, []);
    await expect(guard.canActivate(createContext())).resolves.toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('内置管理员拥有权限兜底能力', async () => {
    const { guard, findUnique } = createGuard(['system:user'], []);
    await expect(
      guard.canActivate(createContext({ id: 'admin-1', role: Role.ADMIN })),
    ).resolves.toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('普通用户即使角色字段为 USER，也可通过菜单按钮权限访问', async () => {
    const { guard } = createGuard(['system:user:edit'], [
      { path: '/system/user', perms: 'system:user:edit' },
    ]);
    await expect(
      guard.canActivate(createContext({ id: 'user-1', role: Role.USER })),
    ).resolves.toBe(true);
  });

  it('菜单资源本身授予基础读取权限', async () => {
    const { guard } = createGuard(['system:dept'], [
      { path: '/system/dept', perms: null },
    ]);
    await expect(
      guard.canActivate(createContext({ id: 'user-1', role: Role.USER })),
    ).resolves.toBe(true);
  });

  it('没有对应自定义角色权限时拒绝访问', async () => {
    const { guard } = createGuard(['system:user:edit'], [
      { path: '/dashboard', perms: null },
    ]);
    await expect(
      guard.canActivate(createContext({ id: 'user-1', role: Role.USER })),
    ).rejects.toThrow(ForbiddenException);
  });
});
