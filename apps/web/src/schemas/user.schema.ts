import { z } from 'zod';

export const updateUserSchema = z.object({
  name: z.string().min(2, '用户名至少需要 2 个字符').optional(),
  email: z.string().email('请输入有效的邮箱地址').optional(),
  avatar: z.string().url('请输入有效的 URL').optional().or(z.literal('')),
});

export type UpdateUserFormData = z.infer<typeof updateUserSchema>;
