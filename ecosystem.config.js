module.exports = {
  apps: [
    {
      name: 'myapp-api',
      script: 'dist/src/main.js',
      cwd: './apps/api',
      instances: 1,
      exec_mode: 'fork',
      node_args: '--max-old-space-size=256',
      env: {
        NODE_ENV: 'production',
        PORT: 3100,
      },
      env_file: './apps/api/.env',
      max_memory_restart: '500M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      merge_logs: true,
    },
    // Web 前端已改为纯静态导出（next export → out/ 目录）
    // 生产环境由 Nginx 直接服务静态文件，无需 Node.js 进程
  ],
};
