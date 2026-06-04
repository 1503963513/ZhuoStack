/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  reactStrictMode: true,
  // 静态导出时图片优化不可用，直接输出原图
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
