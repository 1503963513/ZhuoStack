import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/constants';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background to-muted">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          Welcome to MyApp
        </h1>
        <p className="mt-6 text-lg leading-8 text-muted-foreground">
          A production-ready fullstack application built with NestJS, Next.js, and modern web technologies.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Button asChild size="lg">
            <Link href={ROUTES.LOGIN}>Sign in</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href={ROUTES.REGISTER}>Sign up</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
