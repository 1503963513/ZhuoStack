import { ForbiddenException } from '@nestjs/common';
import { DataScope, Role } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { RoleService } from './role.service';

describe('RoleService.update', () => {
  const role = {
    id: 'role-1',
    name: 'Scoped role',
    code: 'scoped',
    sort: 0,
    status: 'ACTIVE',
    dataScope: DataScope.DEPT,
    remark: null,
    menus: [],
    dataDepts: [],
  };

  function createService() {
    const findUnique = jest.fn().mockResolvedValue(role);
    const update = jest.fn().mockResolvedValue(role);
    const prisma = {
      sysRole: { findUnique, update },
    } as unknown as PrismaService;
    return { service: new RoleService(prisma), findUnique, update };
  }

  it('rejects non-admin users changing a role data scope', async () => {
    const { service, findUnique, update } = createService();

    await expect(
      service.update('role-1', { dataScope: DataScope.ALL }, { id: 'user-1', role: Role.USER }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(findUnique).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects non-admin users changing custom department assignments', async () => {
    const { service, update } = createService();

    await expect(
      service.update('role-1', { dataDeptIds: ['dept-2'] }, { id: 'user-1', role: Role.USER }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(update).not.toHaveBeenCalled();
  });

  it('allows non-admin users to edit role fields without changing data scope', async () => {
    const { service, update } = createService();

    await service.update('role-1', { name: 'Renamed role' }, { id: 'user-1', role: Role.USER });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'role-1' },
      data: expect.objectContaining({ name: 'Renamed role' }),
    }));
  });

  it('allows system administrators to change a role data scope', async () => {
    const { service, update } = createService();

    await service.update('role-1', { dataScope: DataScope.ALL }, { id: 'admin-1', role: Role.ADMIN });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'role-1' },
      data: expect.objectContaining({ dataScope: DataScope.ALL }),
    }));
  });
});
