import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataScope, Prisma, Role, Status } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface DataScopeActor {
  id: string;
  role: Role;
}

@Injectable()
export class DataScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserWhere(actor: DataScopeActor): Promise<Prisma.UserWhereInput> {
    if (actor.role === Role.ADMIN) return {};

    const user = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: {
        deptId: true,
        roles: {
          where: { status: Status.ACTIVE },
          select: { dataScope: true, dataDepts: { select: { id: true } } },
        },
      },
    });
    if (!user) return { id: '__no_access__' };

    const scopes = user.roles;
    if (scopes.some((item) => item.dataScope === DataScope.ALL)) return {};

    const clauses: Prisma.UserWhereInput[] = [];
    const deptIds = new Set<string>();
    const needsDescendants = scopes.some(
      (item) => item.dataScope === DataScope.DEPT_AND_CHILD,
    );
    if (needsDescendants && user.deptId) {
      for (const id of await this.getDepartmentSubtree(user.deptId)) deptIds.add(id);
    }
    for (const scope of scopes) {
      if (scope.dataScope === DataScope.DEPT && user.deptId) deptIds.add(user.deptId);
      if (scope.dataScope === DataScope.CUSTOM) {
        for (const dept of scope.dataDepts) deptIds.add(dept.id);
      }
      if (scope.dataScope === DataScope.SELF) clauses.push({ id: actor.id });
    }
    if (deptIds.size) clauses.push({ deptId: { in: [...deptIds] } });
    if (!clauses.length) return { id: '__no_access__' };
    return { OR: clauses };
  }

  async getVisibleDeptIds(actor: DataScopeActor): Promise<string[] | null> {
    if (actor.role === Role.ADMIN) return null;
    const user = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: {
        deptId: true,
        roles: {
          where: { status: Status.ACTIVE },
          select: { dataScope: true, dataDepts: { select: { id: true } } },
        },
      },
    });
    if (!user) return [];
    if (user.roles.some((item) => item.dataScope === DataScope.ALL)) return null;

    const deptIds = new Set<string>();
    for (const scope of user.roles) {
      if (scope.dataScope === DataScope.DEPT && user.deptId) deptIds.add(user.deptId);
      if (scope.dataScope === DataScope.DEPT_AND_CHILD && user.deptId) {
        for (const id of await this.getDepartmentSubtree(user.deptId)) deptIds.add(id);
      }
      if (scope.dataScope === DataScope.CUSTOM) {
        for (const dept of scope.dataDepts) deptIds.add(dept.id);
      }
    }
    return [...deptIds];
  }

  async assertCanAccessUser(userId: string, actor: DataScopeActor): Promise<void> {
    const visible = await this.prisma.user.findFirst({
      where: { AND: [{ id: userId }, await this.getUserWhere(actor)] },
      select: { id: true },
    });
    if (!visible) throw new ForbiddenException('无权访问该用户数据');
  }

  async assertCanAccessDept(deptId: string, actor: DataScopeActor): Promise<void> {
    const allowed = await this.getVisibleDeptIds(actor);
    if (allowed !== null && !allowed.includes(deptId)) {
      throw new ForbiddenException('无权访问该部门数据');
    }
  }

  async assertCanManageDeptSubtree(deptId: string, actor: DataScopeActor): Promise<void> {
    const allowed = await this.getVisibleDeptIds(actor);
    if (allowed === null) return;
    const visible = new Set(allowed);
    const subtree = await this.getDepartmentSubtree(deptId);
    if (subtree.some((id) => !visible.has(id))) {
      throw new ForbiddenException('无权移动包含范围外部门的部门树');
    }
  }

  async assertCanAssignRoles(
    roleIds: string[],
    targetDeptId: string | null,
    actor: DataScopeActor,
  ): Promise<void> {
    if (actor.role === Role.ADMIN || roleIds.length === 0) return;
    const visibleIds = await this.getVisibleDeptIds(actor);
    const roles = await this.prisma.sysRole.findMany({
      where: { id: { in: roleIds } },
      select: { dataScope: true, dataDepts: { select: { id: true } } },
    });
    const visible = visibleIds === null ? null : new Set(visibleIds);
    if (visible === null) return;
    for (const role of roles) {
      if (role.dataScope === DataScope.ALL) {
        throw new ForbiddenException('无权分配全量数据范围角色');
      }
      if (role.dataScope === DataScope.DEPT && (!targetDeptId || !visible.has(targetDeptId))) {
        throw new ForbiddenException('无权分配超出管理范围的部门角色');
      }
      if (role.dataScope === DataScope.DEPT_AND_CHILD) {
        if (!targetDeptId) throw new ForbiddenException('无权分配超出管理范围的部门角色');
        const subtree = await this.getDepartmentSubtree(targetDeptId);
        if (subtree.some((id) => !visible.has(id))) {
          throw new ForbiddenException('无权分配超出管理范围的部门角色');
        }
      }
      if (role.dataScope === DataScope.CUSTOM && role.dataDepts.some((dept) => !visible.has(dept.id))) {
        throw new ForbiddenException('无权分配超出管理范围的自定义角色');
      }
    }
  }

  async assertCanManageRootDept(actor: DataScopeActor): Promise<void> {
    if ((await this.getVisibleDeptIds(actor)) !== null) {
      throw new ForbiddenException('仅拥有全部数据范围的角色可管理根部门');
    }
  }

  private async getDepartmentSubtree(rootId: string): Promise<string[]> {
    const departments = await this.prisma.sysDept.findMany({
      select: { id: true, parentId: true },
    });
    const childrenByParent = new Map<string, string[]>();
    for (const department of departments) {
      if (!department.parentId) continue;
      const children = childrenByParent.get(department.parentId) ?? [];
      children.push(department.id);
      childrenByParent.set(department.parentId, children);
    }

    const result: string[] = [];
    const pending = [rootId];
    const visited = new Set<string>();
    while (pending.length) {
      const current = pending.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      result.push(current);
      pending.push(...(childrenByParent.get(current) ?? []));
    }
    return result;
  }
}
