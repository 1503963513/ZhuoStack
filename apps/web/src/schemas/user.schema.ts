import { z } from 'zod';

export const updateUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  email: z.string().email('Please enter a valid email address').optional(),
  avatar: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
});

export type UpdateUserFormData = z.infer<typeof updateUserSchema>;
