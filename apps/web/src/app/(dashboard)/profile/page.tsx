'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateUserSchema, type UpdateUserFormData } from '@/schemas/user.schema';
import { useProfile } from '@/hooks/use-auth';
import type { User } from '@/types/user';
import { Loading } from '@/components/common/loading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { encryptPassword } from '@/lib/crypto';
import { Lock, User as UserIcon } from 'lucide-react';
import { getErrorMessage } from '@/lib/utils';
import {
  userControllerUpdate,
  userControllerChangePassword,
} from '@/api/generated/endpoints/user/user';

export default function ProfilePage() {
  const { data, isLoading } = useProfile();
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();
  const user = data?.data;

  // ========== 个人信息表单 ==========
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

  const updateMutation = useMutation({
    mutationFn: (formData: UpdateUserFormData) => {
      if (!user?.id) throw new Error('用户未加载');
      return userControllerUpdate(user.id, {
        name: formData.name || undefined,
        email: formData.email,
        avatar: formData.avatar || undefined,
      });
    },
    onSuccess: (response) => {
      if (response.data) {
        setUser(response.data as unknown as User);
      }
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('个人资料更新成功');
    },
    onError: (error) => {
      toast.error('更新失败', { description: error.message });
    },
  });

  const onSubmit = (formData: UpdateUserFormData) => {
    updateMutation.mutate(formData);
  };

  // ========== 修改密码 ==========
  const [pwdForm, setPwdForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [pwdLoading, setPwdLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!pwdForm.oldPassword || !pwdForm.newPassword || !pwdForm.confirmPassword) {
      toast.error('请填写所有密码字段');
      return;
    }
    if (pwdForm.newPassword.length < 6) {
      toast.error('新密码至少需要 6 个字符');
      return;
    }
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      toast.error('两次输入的新密码不一致');
      return;
    }

    setPwdLoading(true);
    try {
      const encryptedOld = await encryptPassword(pwdForm.oldPassword);
      const encryptedNew = await encryptPassword(pwdForm.newPassword);
      await userControllerChangePassword({
        oldPassword: encryptedOld,
        newPassword: encryptedNew,
      });
      toast.success('密码修改成功');
      setPwdForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: unknown) {
      toast.error('密码修改失败', { description: getErrorMessage(error) });
    } finally {
      setPwdLoading(false);
    }
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

      {/* 个人信息 */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            基本信息
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">姓名</Label>
              <Input id="name" {...register('name')} placeholder="您的姓名" />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input id="email" type="email" {...register('email')} placeholder="you@example.com" />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="avatar">头像 URL</Label>
              <Input
                id="avatar"
                {...register('avatar')}
                placeholder="https://example.com/avatar.jpg"
              />
              {errors.avatar && <p className="text-sm text-destructive">{errors.avatar.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>角色</Label>
              <Input value={user?.role} disabled className="bg-muted" />
            </div>

            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? '保存中...' : '保存更改'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 修改密码 */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            修改密码
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="oldPassword">当前密码</Label>
              <Input
                id="oldPassword"
                type="password"
                placeholder="••••••••"
                value={pwdForm.oldPassword}
                onChange={(e) => setPwdForm({ ...pwdForm, oldPassword: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">新密码</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="至少 6 位字符"
                value={pwdForm.newPassword}
                onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认新密码</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="再次输入新密码"
                value={pwdForm.confirmPassword}
                onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
              />
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleChangePassword}
              disabled={pwdLoading}
            >
              {pwdLoading ? '修改中...' : '修改密码'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
