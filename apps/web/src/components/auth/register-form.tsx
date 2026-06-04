'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterFormData } from '@/schemas/auth.schema';
import { useRegister } from '@/hooks/use-auth';
import { encryptPassword } from '@/lib/crypto';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import Link from 'next/link';
import { ROUTES } from '@/lib/constants';
import { get } from '@/lib/api-client';

export function RegisterForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const registerMutation = useRegister();

  // 验证码状态
  const [captchaId, setCaptchaId] = useState('');
  const [captchaImage, setCaptchaImage] = useState('');

  /** 获取验证码 */
  const fetchCaptcha = useCallback(async () => {
    try {
      const res = await get<{ captchaId: string; captchaImage: string }>('/api/auth/captcha');
      setCaptchaId(res.data.captchaId);
      setCaptchaImage(res.data.captchaImage);
    } catch {
      toast.error('获取验证码失败');
    }
  }, []);

  useEffect(() => {
    fetchCaptcha();
  }, [fetchCaptcha]);

  const onSubmit = async (data: RegisterFormData) => {
    const { confirmPassword: _, ...payload } = data;
    try {
      const encryptedPassword = await encryptPassword(payload.password);
      registerMutation.mutate(
        { ...payload, password: encryptedPassword, captchaId, captchaCode: data.captchaCode },
        {
          onError: (error) => {
            toast.error('注册失败', {
              description: error.message || '无法创建账号',
            });
            fetchCaptcha();
          },
        },
      );
    } catch {
      toast.error('加密失败，请刷新页面重试');
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">创建账号</CardTitle>
        <CardDescription className="text-center">
          请输入您的信息开始使用
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">用户名</Label>
            <Input id="name" type="text" placeholder="请输入用户名" {...register('name')} />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input id="email" type="email" placeholder="user@example.com" {...register('email')} />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input id="password" type="password" placeholder="••••••" {...register('password')} />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">确认密码</Label>
            <Input id="confirmPassword" type="password" placeholder="••••••" {...register('confirmPassword')} />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="captchaCode">验证码</Label>
            <div className="flex gap-2">
              <Input
                id="captchaCode"
                placeholder="请输入验证码"
                maxLength={4}
                className="flex-1"
                {...register('captchaCode')}
              />
              <div
                className="shrink-0 cursor-pointer h-10 w-28 rounded-md border border-input bg-background overflow-hidden flex items-center justify-center [&>svg]:h-8 [&>svg]:w-full"
                onClick={fetchCaptcha}
                title="点击刷新验证码"
                dangerouslySetInnerHTML={{ __html: captchaImage }}
              />
            </div>
            {errors.captchaCode && (
              <p className="text-sm text-destructive">{errors.captchaCode.message}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
            {registerMutation.isPending ? '创建中...' : '创建账号'}
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            已有账号？{' '}
            <Link href={ROUTES.LOGIN} className="text-primary hover:underline">
              登录
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
