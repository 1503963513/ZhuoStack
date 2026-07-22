# 部署指南

项目只有一个部署入口：`pnpm ops`（部署包内也可直接执行 `bash scripts/deploy.sh`）。API 的实际入口统一为 `apps/api/dist/src/main.js`，Web 是 Next.js 静态导出，由 Nginx 提供服务。

脚本目录按职责组织：

```text
scripts/
├── deploy.sh           # 唯一公开入口，只负责命令路由
└── deploy/
    ├── common.sh       # 环境文件、密钥、数据库类型和构建
    ├── docker.sh       # Docker Compose 生命周期
    ├── pm2.sh          # PM2 安装、启停、更新和数据库同步
    └── package.sh      # 在线包与离线包
```

## 方案选择

| 场景                           | 推荐命令                                | 目标机要求                                    |
| ------------------------------ | --------------------------------------- | --------------------------------------------- |
| 常规服务器 / 云主机            | `pnpm ops docker up`                    | Docker + Compose                              |
| 已有 Nginx、Node 运维体系      | `pnpm ops pm2 start`                    | Node.js 20+；在线准备时需要 pnpm              |
| 完全离线，允许 Docker          | `pnpm ops pack docker-offline postgres` | 目标机只有 Docker 即可                        |
| 完全离线，不使用 Docker 跑应用 | `pnpm ops pack pm2-offline postgres`    | Linux glibc 系统；Node、PM2、依赖均已随包提供 |

`postgres` 可替换为 `mysql`。离线包中的 Prisma Client 与 CPU 架构、数据库类型相关，必须按目标环境生成。

## Docker 一键部署

```bash
pnpm ops docker up
```

首次运行会从 `.env.deploy.example` 创建 `.env.deploy`，并自动生成强随机数据库密码和 `JWT_SECRET`。正式环境至少要修改 `CORS_ORIGIN`、TLS 证书、开放端口和 AI 配置。浏览器认证使用 `Secure + HttpOnly + SameSite=Strict` Cookie，因此正式环境必须通过 HTTPS 访问。

默认地址：

- Web：`https://服务器地址`（示例环境默认映射 443）
- API：Web 同域下的 `/api/*`
- Swagger：启用 `SWAGGER_ENABLED=true` 后访问 `/api/docs`
- API 端口仅绑定到宿主机 `127.0.0.1:3100`

### HTTPS / TLS

Docker 内置 Nginx 支持 TLS 1.2/1.3。将完整证书链和私钥分别放到以下文件，然后启动服务：

```text
docker/certs/tls.crt
docker/certs/tls.key
```

也可以在 `.env.deploy` 中通过 `TLS_CERT_DIR` 指向其他证书目录。检测到两个文件时，Nginx 会启用 443 并将 HTTP 重定向到 HTTPS；只有一个文件时会拒绝启动。若 TLS 已由云负载均衡器或 Ingress 终止，不放置本地证书即可，但外层代理必须面向用户强制 HTTPS。

常用运维命令：

```bash
pnpm ops docker status
pnpm ops docker logs
pnpm ops docker restart
pnpm ops docker down
```

API 容器启动前默认在 `DB_MIGRATE_ON_START=true` 时执行 `prisma migrate deploy`，只应用已经提交并审核过的迁移。若迁移由独立发布任务执行，可设为 `false`，但必须在启动新版本应用前完成迁移；生产环境不使用 `prisma db push`。

从旧版 `DB_AUTO_SYNC/db push` 升级的已有非空数据库没有迁移元数据，不能直接启动新版容器。请先停止写入并完成备份，再按 [Prisma 双数据库与迁移规范](../apps/api/prisma/README.md#从旧版-db-push-部署升级) 做一次零漂移基线登记。全新空库不需要基线。

### 切换 MySQL

编辑 `.env.deploy`：

```dotenv
DB_TYPE=mysql
DATABASE_URL=mysql://zhuostack:zhuostack123@db:3306/zhuostack
```

然后运行 `pnpm ops docker up`。脚本会自动叠加 `docker/compose.mysql.yml`，不需要手写多条 Compose 命令。已有 PostgreSQL 数据不会自动迁移到 MySQL。

### 使用外部数据库

可将 `DATABASE_URL` 指向外部地址。当前 Compose 仍会启动内置 `db` 容器；若生产环境只允许外部数据库，可在项目自己的 Compose override 中移除依赖或把 `api` 服务单独接入现有编排。

持久化数据保存在 Compose volumes：`postgres_data` / `mysql_data`、`redis_data`、`api_uploads`。执行 `docker compose down` 不会删除数据；不要在未备份时执行 `down -v`。`api_uploads` 用于本地文件存储，切换到阿里云 OSS 或腾讯云 COS 后仍保留该 volume，以便继续访问历史本地文件。

### 切换对象存储

在 `.env.deploy` 中设置 `FILE_STORAGE_TYPE=aliyun` 或 `FILE_STORAGE_TYPE=tencent`，并填写同文件中对应的 OSS/COS 变量，然后重启 API：

```bash
pnpm ops docker restart
```

切换只影响新上传文件，不会自动迁移历史文件。请给服务端 AccessKey/Secret 最小化的对象读、写、删权限，不要将真实密钥提交到仓库。如使用内网 Endpoint，必须另外配置可供浏览器访问的 `*_PUBLIC_URL`。

## PM2 部署

PM2 只负责 API，Web 的 `apps/web/out` 由宿主机 Nginx 托管。PM2 已固定为项目依赖，不要求 `npm i -g pm2`。

```bash
pnpm build:deploy
pnpm ops pm2 start
```

首次运行会创建 `apps/api/.env.production` 并生成 JWT 密钥。旧版的 `apps/api/.env` 会自动迁移。`DB_MIGRATE_ON_START=true` 时，`start/restart/update` 会先执行已审核迁移；若关闭自动迁移，可手动执行：

```bash
pnpm ops pm2 db-migrate
pnpm ops pm2 restart
```

常用命令：

```bash
pnpm ops pm2 status
pnpm ops pm2 logs
pnpm ops pm2 restart
pnpm ops pm2 stop
```

复制 `docker/nginx.pm2.conf` 到 Nginx 配置目录，将 `__WEB_ROOT__` 替换成 `apps/web/out` 的绝对路径，补充站点的 443 证书配置和 HTTP → HTTPS 跳转，然后执行 `nginx -t && nginx -s reload`。本地上传文件由 API 的 `/files/` 提供；确保 `FILE_STORAGE_PATH` 指向持久化目录。云存储文件使用 OSS/COS 或配置的 CDN 域名。

## PM2 在线发布包

联网构建机执行：

```bash
pnpm ops pack pm2-online postgres
```

上传 `deploy_pm2_online_*.tar.gz` 后，在目标机执行：

```bash
mkdir -p /opt/zhuostack && cd /opt/zhuostack
tar -xzf deploy_pm2_online_*.tar.gz
cp apps/api/.env.example apps/api/.env.production
# 编辑 apps/api/.env.production
bash scripts/deploy.sh pm2 start
```

目标机需要 Node.js 20+、pnpm 10+，并能访问 npm 源。后续更新可执行：

```bash
bash scripts/deploy.sh pm2 update /path/to/new-package.tar.gz
```

更新脚本会保留 `apps/api/.env.production`。

## PM2 完全离线包

联网构建机需要 Docker，用它生成与目标 Linux 一致的原生依赖：

```bash
# x86_64 Linux（默认）
pnpm ops pack pm2-offline postgres

# ARM64 Linux
TARGET_ARCH=linux/arm64 pnpm ops pack pm2-offline postgres
```

包内包含 Linux Node、项目本地 PM2、API 生产依赖和对应数据库的 Prisma Client。目标机无需 Node、pnpm、npm 源或 Docker：

```bash
mkdir -p /opt/zhuostack && cd /opt/zhuostack
tar -xzf deploy_pm2_offline_*.tar.gz
cp apps/api/.env.example apps/api/.env.production
# 编辑 apps/api/.env.production，DB_TYPE 必须与包名一致
bash scripts/deploy.sh pm2 start
```

离线 PM2 包面向带 OpenSSL 3 的常见 glibc Linux（如 Debian 12、Ubuntu 22.04+、Rocky Linux 9）。Alpine Linux 使用 musl，不适用该包；其他系统也建议使用 Docker 离线包。

## Docker 完全离线包

联网构建机执行：

```bash
pnpm ops pack docker-offline postgres
# 或
TARGET_ARCH=linux/arm64 pnpm ops pack docker-offline mysql
```

将生成的单个压缩包拷入内网目标机：

```bash
mkdir -p /opt/zhuostack && cd /opt/zhuostack
tar -xzf deploy_docker_offline_*.tar.gz
bash scripts/deploy.sh docker up
```

首次启动会自动导入 `offline-images.tar`、创建 `.env.deploy`、生成 JWT 密钥并启动服务，全程不会拉取镜像。生成包前应确保构建机已拉取基础镜像；目标 CPU 架构通过 `TARGET_ARCH` 指定。

## 上线检查

- 使用强数据库密码，并限制 `.env.deploy` / `apps/api/.env.production` 文件权限。
- `CORS_ORIGIN` 填写实际 HTTPS 域名；多个域名用英文逗号分隔。
- 禁止在 `CORS_ORIGIN` 使用 `*`；确认登录响应包含 Secure、HttpOnly、SameSite=Strict 属性。
- 仅开放 HTTPS，验证 TLS 1.0/1.1 已禁用，并确认 HSTS、CSP、Permissions-Policy 等响应头存在。
- 生产环境通常关闭 Swagger，或只允许内网访问。
- 对数据库 volume、本地上传 volume / OSS / COS 和环境文件做定期备份。
- 在更新前先运行健康检查并准备回滚包；不要依赖 `prisma db push` 完成跨版本的数据迁移。
