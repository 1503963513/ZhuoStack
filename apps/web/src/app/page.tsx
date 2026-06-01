import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ROUTES, APP_NAME } from '@/lib/constants';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background to-muted">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          欢迎使用 {APP_NAME}
        </h1>
        <p className="mt-6 text-lg leading-8 text-muted-foreground">
          基于 NestJS、Next.js 和现代 Web 技术构建的生产级全栈应用。
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Button asChild size="lg">
            <Link href={ROUTES.LOGIN}>登录</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href={ROUTES.REGISTER}>注册</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
