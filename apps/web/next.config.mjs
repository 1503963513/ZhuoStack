import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  outputFileTracingRoot: workspaceRoot,
  reactStrictMode: false,
  // 静态导出时图片优化不可用，直接输出原图
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
