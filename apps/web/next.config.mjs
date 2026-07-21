/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  reactStrictMode: true,
  // 历史页面仍有 lint 存量问题；发布构建只做编译和类型检查，lint 由 pnpm lint 独立执行。
  eslint: {
    ignoreDuringBuilds: true,
  },
  // 静态导出时图片优化不可用，直接输出原图
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
