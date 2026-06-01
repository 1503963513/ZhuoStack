'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateUserSchema, type UpdateUserFormData } from '@/schemas/user.schema';
import { useProfile } from '@/hooks/use-auth';
import { useApiMutation } from '@/hooks/use-api';
import type { User } from '@/types/user';
import { Loading } from '@/components/common/loading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';

export default function ProfilePage() {
  const { data, isLoading } = useProfile();
  const setUser = useAuthStore((s) => s.setUser);
  const user = data?.data;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateUserFormData>({
    resolver: zodResolver(updateUserSchema),
    values: {
      name: user?.name || '',
      email: user?.email || '',
      avatar: user?.avatar || '',
    },
  });

  const updateMutation = useApiMutation('put', `/api/user/${user?.id || ''}`, {
    invalidateKeys: [['profile']],
  });

  const onSubmit = (formData: UpdateUserFormData) => {
    updateMutation.mutate(formData, {
      onSuccess: (response) => {
        setUser(response.data as User);
        toast.success('个人资料更新成功');
      },
      onError: (error) => {
        toast.error('更新失败', { description: error.message });
      },
    });
  };

  if (isLoading) {
    return <Loading />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">个人资料</h1>
        <p className="text-muted-foreground">管理您的账号设置</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>个人信息</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">用户名</Label>
              <Input id="name" {...register('name')} />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input id="email" type="email" {...register('email')} />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="avatar">头像链接</Label>
              <Input id="avatar" placeholder="https://..." {...register('avatar')} />
              {errors.avatar && (
                <p className="text-sm text-destructive">{errors.avatar.message}</p>
              )}
            </div>

            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? '保存中...' : '保存修改'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
