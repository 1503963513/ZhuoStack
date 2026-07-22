const path = require('path');

const root = __dirname;

module.exports = {
  apps: [
    {
      name: process.env.PM2_APP_NAME || 'zhuostack-api',
      script: path.join(root, 'apps/api/dist/src/main.js'),
      cwd: path.join(root, 'apps/api'),
      interpreter: process.env.NODE_BINARY || 'node',
      instances: Number(process.env.PM2_INSTANCES || 1),
      exec_mode: Number(process.env.PM2_INSTANCES || 1) > 1 ? 'cluster' : 'fork',
      node_args: process.env.NODE_ARGS || '--max-old-space-size=512',
      env: {
        NODE_ENV: 'production',
      },
      autorestart: true,
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 2000,
      kill_timeout: 10000,
      listen_timeout: 10000,
      max_memory_restart: process.env.PM2_MAX_MEMORY || '750M',
      time: true,
      error_file: path.join(root, 'logs/api-error.log'),
      out_file: path.join(root, 'logs/api-out.log'),
      merge_logs: true,
    },
  ],
};
