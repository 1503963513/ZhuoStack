import type { Metadata } from 'next';
import { Providers } from '@/components/layout/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'NodeJs 全栈模板',
  description: '基于 NestJS + Next.js 的全栈应用模板',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
