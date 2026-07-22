import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { AuthService } from '../auth/auth.service';
import { UserService } from './user.service';

describe('UserService', () => {
  describe('update', () => {
    it('管理员更新密码时只向数据库写入 bcrypt 哈希', async () => {
      const findUnique = jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        name: 'User',
        role: 'USER',
        avatar: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        dept: null,
        posts: [],
        roles: [],
      });
      const update = jest.fn().mockResolvedValue({ id: 'user-1' });
      const prisma = { user: { findUnique, update } } as unknown as PrismaService;
      const authService = {} as AuthService;
      const service = new UserService(prisma, authService);
      const plainPassword = 'new-password-123';

      await service.update('user-1', { password: plainPassword });

      const updateArgs = update.mock.calls[0]?.[0] as {
        data: { password?: string };
      };
      const storedPassword = updateArgs.data.password;

      expect(storedPassword).toBeDefined();
      expect(storedPassword).not.toBe(plainPassword);
      await expect(bcrypt.compare(plainPassword, storedPassword!)).resolves.toBe(true);
    });
  });
});
