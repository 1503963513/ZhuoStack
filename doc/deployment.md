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

首次运行会从 `.env.deploy.example` 创建 `.env.deploy`，并自动生成强随机数据库密码和 `JWT_SECRET`。正式环境至少要修改 `CORS_ORIGIN`、开放端口和 AI 配置。

默认地址：

- Web：`http://服务器地址:3000`
- API：Web 同域下的 `/api/*`
- Swagger：启用 `SWAGGER_ENABLED=true` 后访问 `/api/docs`
- API 端口仅绑定到宿主机 `127.0.0.1:3100`

常用运维命令：

```bash
pnpm ops docker status
pnpm ops docker logs
pnpm ops docker restart
pnpm ops docker down
```

数据库结构默认在 API 容器启动前通过 `prisma db push` 同步。希望由独立迁移流程管理时，把 `.env.deploy` 中的 `DB_AUTO_SYNC` 改为 `false`。

### 切换 MySQL

编辑 `.env.deploy`：

```dotenv
DB_TYPE=mysql
DATABASE_URL=mysql://myapp:myapp123@db:3306/myapp
```

然后运行 `pnpm ops docker up`。脚本会自动叠加 `docker/compose.mysql.yml`，不需要手写多条 Compose 命令。已有 PostgreSQL 数据不会自动迁移到 MySQL。

### 使用外部数据库

可将 `DATABASE_URL` 指向外部地址。当前 Compose 仍会启动内置 `db` 容器；若生产环境只允许外部数据库，可在项目自己的 Compose override 中移除依赖或把 `api` 服务单独接入现有编排。

持久化数据保存在 Compose volumes：`postgres_data` / `mysql_data`、`redis_data`、`api_uploads`。执行 `docker compose down` 不会删除数据；不要在未备份时执行 `down -v`。

## PM2 部署

PM2 只负责 API，Web 的 `apps/web/out` 由宿主机 Nginx 托管。PM2 已固定为项目依赖，不要求 `npm i -g pm2`。

```bash
pnpm build:deploy
pnpm ops pm2 start
```

首次运行会创建 `apps/api/.env` 并生成 JWT 密钥。修改数据库连接后，如需手动同步结构：

```bash
pnpm ops pm2 db-sync
pnpm ops pm2 restart
```

常用命令：

```bash
pnpm ops pm2 status
pnpm ops pm2 logs
pnpm ops pm2 restart
pnpm ops pm2 stop
```

复制 `docker/nginx.pm2.conf` 到 Nginx 配置目录，将 `__WEB_ROOT__` 替换成 `apps/web/out` 的绝对路径，然后执行 `nginx -t && nginx -s reload`。上传文件仍由 API 的 `/files/` 提供；确保 `FILE_STORAGE_PATH` 指向持久化目录。

## PM2 在线发布包

联网构建机执行：

```bash
pnpm ops pack pm2-online postgres
```

上传 `deploy_pm2_online_*.tar.gz` 后，在目标机执行：

```bash
mkdir -p /opt/myapp && cd /opt/myapp
tar -xzf deploy_pm2_online_*.tar.gz
cp apps/api/.env.example apps/api/.env
# 编辑 apps/api/.env
bash scripts/deploy.sh pm2 start
```

目标机需要 Node.js 20+、pnpm 10+，并能访问 npm 源。后续更新可执行：

```bash
bash scripts/deploy.sh pm2 update /path/to/new-package.tar.gz
```

更新脚本会保留 `apps/api/.env`。

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
mkdir -p /opt/myapp && cd /opt/myapp
tar -xzf deploy_pm2_offline_*.tar.gz
cp apps/api/.env.example apps/api/.env
# 编辑 apps/api/.env，DB_TYPE 必须与包名一致
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
mkdir -p /opt/myapp && cd /opt/myapp
tar -xzf deploy_docker_offline_*.tar.gz
bash scripts/deploy.sh docker up
```

首次启动会自动导入 `offline-images.tar`、创建 `.env.deploy`、生成 JWT 密钥并启动服务，全程不会拉取镜像。生成包前应确保构建机已拉取基础镜像；目标 CPU 架构通过 `TARGET_ARCH` 指定。

## 上线检查

- 使用强数据库密码，并限制 `.env.deploy` / `apps/api/.env` 文件权限。
- `CORS_ORIGIN` 填写实际 HTTPS 域名；多个域名用英文逗号分隔。
- 生产环境通常关闭 Swagger，或只允许内网访问。
- 对数据库 volume、上传 volume 和环境文件做定期备份。
- 在更新前先运行健康检查并准备回滚包；不要依赖 `prisma db push` 完成跨版本的数据迁移。
