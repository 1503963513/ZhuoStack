'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginFormData } from '@/schemas/auth.schema';
import { useLogin } from '@/hooks/use-auth';
import { encryptPassword } from '@/lib/crypto';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toast } from 'sonner';
import Link from 'next/link';
import { ROUTES } from '@/lib/constants';
import { useQuery } from '@tanstack/react-query';
import { authControllerGetCaptcha } from '@/api/generated/endpoints/auth/auth';
import { useSystemConfig } from '@/hooks/use-system-config';
import { useI18n } from '@/hooks/use-i18n';

export function LoginForm() {
  const { getBoolean, isLoaded } = useSystemConfig();
  const { t } = useI18n();
  const registerEnabled = getBoolean('sys.security.register_enabled', false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const loginMutation = useLogin();

  const { data: captchaResponse, refetch: fetchCaptcha } = useQuery({
    queryKey: ['login-captcha'],
    queryFn: () => authControllerGetCaptcha(),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const captchaId = captchaResponse?.data?.captchaId ?? '';
  const captchaImage = captchaResponse?.data?.captchaImage ?? '';

  const onSubmit = async (data: LoginFormData) => {
    try {
      const encryptedPassword = await encryptPassword(data.password);
      loginMutation.mutate(
        {
          email: data.email,
          password: encryptedPassword,
          captchaId,
          captchaCode: data.captchaCode,
        },
        {
          onError: (error) => {
            toast.error('登录失败', {
              description: error.message || '邮箱或密码错误',
            });
            void fetchCaptcha();
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
        <CardTitle className="text-2xl font-bold text-center">{t('auth.loginTitle', '欢迎回来')}</CardTitle>
        <CardDescription className="text-center">{t('auth.loginDesc', '请输入您的账号信息登录')}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email', '邮箱')}</Label>
            <Input id="email" type="email" placeholder="admin@example.com" {...register('email')} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.password', '密码')}</Label>
            <Input id="password" type="password" placeholder="••••••" {...register('password')} />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="captchaCode">{t('auth.captcha', '验证码')}</Label>
            <div className="flex gap-2">
              <Input
                id="captchaCode"
                placeholder={t('auth.captchaPlaceholder', '请输入验证码')}
                maxLength={4}
                className="flex-1"
                {...register('captchaCode')}
              />
              <div
                className="shrink-0 cursor-pointer h-10 w-28 rounded-md border border-input bg-background overflow-hidden flex items-center justify-center [&>svg]:h-8 [&>svg]:w-full"
                onClick={() => void fetchCaptcha()}
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
          <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? t('auth.signingIn', '登录中...') : t('auth.signIn', '登录')}
          </Button>
          {isLoaded && registerEnabled && (
            <p className="text-sm text-muted-foreground text-center">
              {t('auth.noAccount', '还没有账号？')}{' '}
              <Link href={ROUTES.REGISTER} className="text-primary hover:underline">
                注册
              </Link>
            </p>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}
