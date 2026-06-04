# Nginx 部署配置指南

本文档说明如何使用 Nginx 部署本项目（Next.js 纯静态导出 + NestJS API）。

## 架构

```
浏览器 → Nginx (80/443)
           ├── /            → apps/web/out/（静态 HTML/JS/CSS）
           ├── /files/*     → uploads/（上传的文件）
           └── /api/*       → 127.0.0.1:3100（NestJS 后端）
```

Web 前端已改为纯静态导出（`next export`），构建产物仅 ~2MB，由 Nginx 直接服务，
**不再需要 Node.js 进程运行前端**。PM2 只管理 API 后端。

## 完整配置

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为实际域名

    # === 前端静态文件 ===
    root /opt/node-app/test/apps/web/out;
    index index.html;

    # SPA 路由回退（所有非文件请求都返回 index.html）
    location / {
        try_files $uri $uri.html $uri/ /index.html;
    }

    # 静态资源缓存（Next.js 构建产物带 hash，可长期缓存）
    location /_next/static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # === 上传文件 ===
    location /files/ {
        alias /opt/node-app/test/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";

        # 允许跨源访问（前端直连后端时需要）
        add_header Access-Control-Allow-Origin *;
        add_header Cross-Origin-Resource-Policy cross-origin;
    }

    # === API 反向代理 ===
    location /api/ {
        proxy_pass http://127.0.0.1:3100;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 文件上传大小限制（与后端 FILE_MAX_SIZE_MB 一致）
        client_max_body_size 50m;
    }

    # 健康检查（无 /api 前缀）
    location /health {
        proxy_pass http://127.0.0.1:3100;
        proxy_set_header Host $host;
    }

    # === 安全头 ===
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # 隐藏 Nginx 版本号
    server_tokens off;

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 1000;
}
```

## HTTPS 配置（推荐）

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # ... 其余配置同上 ...
}
```

## 部署步骤

### 1. 本地打包

```bash
bash scripts/deploy-pack.sh
```

### 2. 上传到服务器

```bash
scp -P 15554 deploy_*.tar.gz root@your-server:/opt/node-app/test/
```

### 3. 首次部署

```bash
ssh -p 15554 root@your-server
cd /opt/node-app/test
tar xzf deploy_*.tar.gz
bash scripts/server-setup.sh

# 编辑环境变量
vi apps/api/.env

# 同步数据库
cd apps/api && pnpm prisma:push && cd ../..
pnpm run db:seed

# 启动 API
pm2 start ecosystem.config.js
pm2 save && pm2 startup

# 配置 Nginx
vi /etc/nginx/conf.d/myapp.conf
nginx -t && systemctl reload nginx
```

### 4. 后续更新

```bash
# 本地打包上传
bash scripts/deploy-pack.sh
scp -P 15554 deploy_*.tar.gz root@your-server:/opt/node-app/test/

# 服务器执行更新
ssh -p 15554 root@your-server 'cd /opt/node-app/test && bash scripts/server-update.sh'
```

`server-update.sh` 会自动：
- 清除旧的构建产物
- 解压新文件（保留 .env）
- 安装依赖 + 生成 Prisma Client
- 同步数据库 Schema
- 重启 PM2

## 注意事项

### 环境变量

| 文件 | 变量 | 说明 |
|------|------|------|
| `apps/api/.env` | `CORS_ORIGIN` | 允许的前端域名（逗号分隔），如 `https://your-domain.com` |
| `apps/web/.env.local` | `NEXT_PUBLIC_API_URL` | 留空即可（Nginx 同域代理，无需跨域） |

### 关于 NEXT_PUBLIC_API_URL

- **开发环境**：设为 `http://localhost:3100`（前端直连后端）
- **生产环境（Nginx 同域代理）**：留空或不设（前端走 `/api/*` 相对路径，Nginx 代理到后端）
- **生产环境（跨域部署）**：设为后端地址如 `https://api.your-domain.com`，需配置 CORS

### 文件上传目录

确保服务器上的 `uploads/` 目录存在且有写入权限：

```bash
mkdir -p /opt/node-app/test/uploads
chmod 755 /opt/node-app/test/uploads
```
