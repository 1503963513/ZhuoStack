import * as bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthService } from '../auth/auth.service';
import { UserService } from './user.service';

describe('UserService', () => {
  const existingUser = {
    id: 'user-1',
    email: 'user@example.com',
    name: 'User',
    role: Role.USER,
    avatar: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    dept: null,
    posts: [],
    roles: [],
  };

  function createService(options: {
    current?: { role: Role };
    adminCount?: number;
  } = {}) {
    const findUnique = jest.fn().mockResolvedValue(existingUser);
    const update = jest.fn().mockResolvedValue({ id: 'user-1' });
    const deleteUser = jest.fn().mockResolvedValue({ id: 'user-1' });
    const count = jest.fn().mockResolvedValue(options.adminCount ?? 2);
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue(options.current ?? { role: Role.USER }),
        count,
        update,
        delete: deleteUser,
      },
    };
    const transaction = jest.fn(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );
    const prisma = {
      user: { findUnique, update },
      $transaction: transaction,
    } as unknown as PrismaService;
    const decryptPassword = jest.fn((encrypted: string) => `plain:${encrypted}`);
    const revokeUserSessions = jest.fn().mockResolvedValue(true);
    const authService = {
      decryptPassword,
      revokeUserSessions,
    } as unknown as AuthService;

    return {
      service: new UserService(prisma, authService),
      findUnique,
      update,
      deleteUser,
      count,
      transaction,
      decryptPassword,
      revokeUserSessions,
    };
  }

  describe('update', () => {
    it('管理员更新密码时先解密，再只向数据库写入 bcrypt 哈希', async () => {
      const { service, update, decryptPassword, revokeUserSessions } = createService();
      const encryptedPassword = 'rsa-ciphertext';

      await service.update('user-1', { password: encryptedPassword });

      expect(decryptPassword).toHaveBeenCalledWith(encryptedPassword);
      const updateArgs = update.mock.calls[0]?.[0] as {
        data: { password?: string };
      };
      const storedPassword = updateArgs.data.password;

      expect(storedPassword).toBeDefined();
      expect(storedPassword).not.toBe(encryptedPassword);
      expect(storedPassword).not.toBe(`plain:${encryptedPassword}`);
      await expect(bcrypt.compare(`plain:${encryptedPassword}`, storedPassword!)).resolves.toBe(true);
      expect(revokeUserSessions).toHaveBeenCalledWith('user-1');
    });

    it('不能降级最后一个管理员', async () => {
      const { service, update, count, revokeUserSessions } = createService({
        current: { role: Role.ADMIN },
        adminCount: 1,
      });

      await expect(service.update('user-1', { role: Role.USER })).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(count).toHaveBeenCalledWith({ where: { role: Role.ADMIN } });
      expect(update).not.toHaveBeenCalled();
      expect(revokeUserSessions).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('不能删除最后一个管理员', async () => {
      const { service, deleteUser, count, revokeUserSessions } = createService({
        current: { role: Role.ADMIN },
        adminCount: 1,
      });

      await expect(service.remove('user-1')).rejects.toBeInstanceOf(BadRequestException);

      expect(count).toHaveBeenCalledWith({ where: { role: Role.ADMIN } });
      expect(deleteUser).not.toHaveBeenCalled();
      expect(revokeUserSessions).not.toHaveBeenCalled();
    });
  });
});
