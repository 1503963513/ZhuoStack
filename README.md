# ZhuoStack

面向生产环境的企业级 NestJS + Next.js 全栈中后台开发脚手架，采用 pnpm Monorepo + Turborepo 架构组织。内置双数据库迁移同步、RBAC 细粒度权限、Redis 会话与缓存治理、多云对象存储、实时通知中心、全局动态参数配置、服务监控与实时日志控制台、接口限流与 IP 安全防火墙、前端 i18n 多语言体系，以及全自动化 Docker/PM2 交互式部署能力。

## 快速开始

### 环境要求

- Node.js 24 LTS（版本见 `.nvmrc`）
- pnpm 10+
- Docker Compose v2（用于启动本地 PostgreSQL 和 Redis；也可改用已有服务）

### 启动本地环境

在仓库根目录执行：

```bash
corepack enable
pnpm install
cp apps/api/.env.example apps/api/.env.development
cp apps/web/.env.example apps/web/.env.local
docker compose -f docker-compose.dev.yml up -d --wait
pnpm db:setup
pnpm dev
```

默认配置使用 PostgreSQL，环境变量样例无需修改。初始化命令会生成 Prisma Client、运行迁移并填充演示数据。

启动后访问：

- Web：http://localhost:3000
- API 健康检查：http://localhost:3100/health/liveness
- Swagger：http://localhost:3100/api/docs

管理员登录：`admin@example.com` / `Admin@123456`。这些是本地演示账号，不要用于生产环境。
普通用户账号为 `user1@example.com`、`user2@example.com`、`user3@example.com`，密码均为 `Password@123`。

生产环境必须使用 TLS；前端还会使用临时 RSA-OAEP 公钥加密密码。RSA 不能替代 TLS。

停止本地数据库和 Redis：

```bash
docker compose -f docker-compose.dev.yml down
```

默认保留数据库数据；需要清空本地数据时再使用 `down -v`。
MySQL 模式停止服务时，请在命令中加上 `--profile mysql`。

### 改用 MySQL

编辑 `apps/api/.env.development`，将 `DB_TYPE` 改为 `mysql`，并将 `DATABASE_URL` 改为 `mysql://root:root@localhost:3307/zhuostack`。然后运行：

```bash
docker compose -f docker-compose.dev.yml --profile mysql up -d --wait mysql redis
pnpm db:setup
pnpm dev
```

## 界面预览

<p align="center">
  <img src="docs/login-dashboard.png" alt="ZhuoStack 登录、注册、仪表盘与文件管理" width="900" />
</p>

登录、注册、仪表盘和文件管理。

<p align="center">
  <img src="docs/settings.jpg" alt="ZhuoStack 菜单权限、定时任务、Redis 缓存与服务器监控" width="900" />
</p>

菜单权限、定时任务、Redis 缓存与服务器监控。

## 使用演示

<p align="center">
  <img src="docs/demo.gif" alt="ZhuoStack 使用演示" width="800" />
</p>

## 技术栈

| 类别      | 技术                    |
| --------- | ----------------------- |
| 包管理器  | pnpm                    |
| 构建编排  | Turborepo               |
| 后端框架  | NestJS 11               |
| HTTP 平台 | Fastify                 |
| ORM       | Prisma                  |
| 数据库    | PostgreSQL / MySQL      |
| 缓存      | Redis                   |
| 前端框架  | Next.js 16 (App Router) |
| CSS 框架  | Tailwind CSS 4          |
| UI 组件   | shadcn/ui               |
| 状态管理  | Zustand                 |
| 数据请求  | TanStack Query v5       |
| 表单处理  | React Hook Form + Zod   |
| 认证      | JWT (passport-jwt)      |
| 密码哈希  | bcryptjs                |
| API 文档  | Swagger                 |

## 核心功能与特性

- 🛡️ **安全防护与流量防火墙 (`/system/security`)**
  - **IP 黑白名单**：支持单个 IP 或 CIDR 网段拦截与特权放行，支持设定封禁倒计时与原因备注。
  - **动态多维限流防刷**：内置 5 大关键敏感路由防爆破策略（登录防爆破、注册防刷、密码频控、文件上传防护、全局兜底），支持按 IP、User 或联合维度统计，支持后台可视化增删改查、秒级周期快捷选项与超限自动临时拉黑。
  - **传输安全与凭据保护**：前端密码提交前经 RSA-OAEP 非对称加密；服务端 Cookie 认证下发双提交 CSRF 保护；支持基于 Redis 的 JWT 双 Token 自动轮换与单设备登录强制互踢。
- ⚙️ **系统参数设置中心 (`/system/config`)**
  - 动态管理系统名称、版权声明、默认外观主题、自主注册开关、图形验证码开关与初始密码，修改即刻生效，无需重新打包构建。
- 📊 **服务监控与实时日志流水 (`/monitor/server`)**
  - **实时运行日志终端**：采用内存环形缓冲区 + Redis ZSET 时序流，支持近 30 分钟日志倒序查看、多级别筛选、关键词黄色高亮搜索、错误概览呼吸灯统计条，以及一键导出 `.log` 文本文件和复制全部日志。
  - **动态日志策略热调控**：在线热更新最低日志级别、缓冲区容量、采样率、堆栈阈值与保留天数，无需重启 Node.js 进程。
  - **群机器人异常告警**：支持企业微信、飞书卡片、钉钉机器人，内置 MD5 错误指纹 Redis 节流防轰炸降噪与连通性测试。
- 🔔 **实时通知中心与系统公告 (`/notifications`)**
  - 基于 SSE (Server-Sent Events) 长连接实现全员公告与个人系统通知的即时下发；提供未读消息红点徽标与顶部右侧快捷抽屉；内置定时生命周期自动清理任务。
- 🌐 **多语言国际化体系 (i18n)**
  - 基于 Zustand + 本地持久化，支持中英文即时无刷新切换，覆盖菜单、PageTabs 动态标题、认证表单与核心交互。
- 🗄️ **双数据库无缝支持与架构一致性**
  - 生产级 PostgreSQL 与 MySQL (8.0+) 双 Schema 支持，内置一致性断言校验器与自动化迁移部署脚本，杜绝跨库语法差异与字段漂移。
- 🚀 **全栈自动化发布与交互式打包 (`pnpm release`)**
  - 提供保姆级终端向导，自由组合打包范围（全栈 / 仅 API / 仅 Web）、目标数据库（PostgreSQL / MySQL）、离线镜像或裸机 PM2 自包含交付包。

## 架构概览

![ZhuoStack 架构图](docs/images/architecture.png)

## 项目结构

```
zhuostack/
├── apps/
│   ├── api/                  # NestJS 后端
│   │   ├── src/
│   │   ├── common/           # 全局装饰器、守卫、拦截器与过滤器
│   │   ├── database/         # Prisma、Redis 接入
│   │   └── modules/          # auth、user、system、monitor 等功能模块
│   └── prisma/               # PostgreSQL/MySQL schema 与独立迁移历史
├── apps/web/                 # Next.js 前端
│   └── src/
│       ├── app/              # App Router 页面
│       ├── components/       # 共享 UI 与布局
│       ├── api/generated/    # OpenAPI/Orval 生成，不手工编辑
│       ├── locales/          # 中英文文案
│       └── stores/           # Zustand 状态
├── docs/                     # 使用、定制、部署与排障文档
├── docker/                   # 容器、Nginx 配置
└── scripts/                  # 部署、打包脚本
```

## 从模板开始定制

建议先完成本地初始化，再按需要调整品牌信息、演示数据和菜单权限。新增业务功能时，按项目现有约定维护后端模块、数据库双 Schema、菜单权限、前端页面和 API 契约。

- [模板定制指南](docs/customization.md)：项目品牌、演示数据、菜单权限与生产初始化边界。
- [新增业务模块示例](docs/module-development.md)：以部门管理模块为参照，说明从后端、数据库到前端和契约生成的开发顺序。
- [Prisma 双数据库与迁移规范](apps/api/prisma/README.md)：双 Schema、迁移、生产部署与回滚原则。
- [部署指南](docs/deployment.md)：生产初始化、发布升级与运维操作。

## 文件存储

上传模块支持本地磁盘、阿里云 OSS 和腾讯云 COS，由 API 环境变量切换：

```dotenv
# local | aliyun | tencent
FILE_STORAGE_TYPE=local
```

- `local`：使用 `FILE_STORAGE_PATH` 和 `FILE_URL_PREFIX`。
- `aliyun`：配置 `ALIYUN_OSS_REGION`、`ALIYUN_OSS_BUCKET`、`ALIYUN_OSS_ACCESS_KEY_ID`、`ALIYUN_OSS_ACCESS_KEY_SECRET`。
- `tencent`：配置 `TENCENT_COS_REGION`、`TENCENT_COS_BUCKET`、`TENCENT_COS_SECRET_ID`、`TENCENT_COS_SECRET_KEY`。腾讯云 Bucket 名称需包含 APPID。

完整变量见 `apps/api/.env.example`。如果使用 CDN、自定义域名或云厂商内网 Endpoint，请同时设置 `ALIYUN_OSS_PUBLIC_URL` / `TENCENT_COS_PUBLIC_URL`。前端会直接访问返回的公网 URL，因此 Bucket 或 CDN 需允许文件读取；API 下载接口仍可使用服务端密钥读取。

上传文件会按文件魔数校验实际内容，存储扩展名由服务端根据验证后的 MIME 类型生成，不使用客户端文件名中的扩展名。HTML、SVG 以及无法可靠识别的旧式 `.doc/.xls` 不允许作为新文件上传；请使用 `.docx/.xlsx`。

切换存储只影响新上传文件。系统会按数据库中的 `storageType` 下载和删除历史文件；若仍需管理历史云端文件，请保留对应厂商的密钥配置。

## Prisma Schema 多文件拆分

本项目使用 Prisma 7 内置的多文件 Schema 能力，不需要启用预览特性。

### 目录结构

```
apps/api/prisma/
├── postgres/           # PostgreSQL Schema
│   ├── config.prisma   # 生成器 + 数据源
│   ├── enums.prisma    # 枚举定义
│   └── models/
│       └── user.prisma # User 模型
├── mysql/              # MySQL Schema（含 MySQL 特定注解）
│   ├── config.prisma
│   ├── enums.prisma
│   └── models/
│       └── user.prisma
├── migrations.postgres/ # PostgreSQL 独立迁移历史
├── migrations.mysql/    # MySQL 独立迁移历史
├── schema.active/       # 当前生效的 Schema（自动生成，已加入 gitignore）
└── migrations -> ...    # 指向当前数据库迁移历史的自动链接
```

### 切换数据库

```bash
# 自动按 .env 中的 DB_TYPE 执行完整初始化
pnpm db:setup

# 强制针对特定数据库初始化
pnpm db:setup --pg      # PostgreSQL
pnpm db:setup --mysql   # MySQL
```

### 添加新模型

1. 创建 `postgres/models/your-model.prisma`（PostgreSQL Schema）
2. 创建 `mysql/models/your-model.prisma`（含 MySQL 特定注解如 `@db.VarChar`）
3. 在 `postgres/enums.prisma` 和 `mysql/enums.prisma` 中添加新枚举
4. 运行 `pnpm db:migrate` 执行迁移（或追加 `--pg` / `--mysql` 显式指定）

## 一键部署

项目使用同一个入口管理 Docker、PM2 和离线内网部署：

```bash
# 交互式全栈打包向导（强烈推荐！可自由选择组件、数据库与是否打包中间件）
pnpm release

# Docker 一键启动（首次运行自动创建 .env.deploy，构建并启动服务）
pnpm docker:up
# 或等价命令：pnpm ops docker up

# PM2 裸机部署：运行 API（Web 静态文件由 Nginx 托管）
pnpm build:deploy
pnpm ops pm2 start

# 生成无需访问镜像仓库的 Docker 离线包（命令行高级模式）
pnpm ops pack docker-offline postgres all none  # 纯应用包（仅 API+Web，200MB）
pnpm ops pack docker-offline postgres all all   # 全家桶交付包（含 DB+Redis，400MB）

# 生成自带 Linux Node、PM2、依赖和 Prisma Client 的 PM2 离线包
pnpm ops pack pm2-offline postgres
```

Docker 默认使用 PostgreSQL。把 `.env.deploy` 的 `DB_TYPE` 和 `DATABASE_URL` 改为 MySQL 后，部署脚本会自动加载 MySQL Compose 配置。完整操作、升级、日志、备份和内网搬运说明见 [部署指南](docs/deployment.md)。

部署脚本采用单入口结构：`scripts/deploy.sh` 只负责命令路由，具体实现集中在 `scripts/deploy/`，不再保留重复的安装、更新和打包包装脚本。

## 可用脚本

| 命令                                    | 描述                                                  |
| --------------------------------------- | ----------------------------------------------------- |
| `pnpm dev`                              | 启动所有服务（开发模式）                              |
| `pnpm build`                            | 构建所有包                                            |
| `pnpm build:deploy`                     | 不依赖 Turbo 远程能力，直接构建部署产物               |
| `pnpm typecheck`                        | 对所有工作区执行严格 TypeScript 检查                  |
| `pnpm lint`                             | 代码检查                                              |
| `pnpm test`                             | 运行 API 单元测试和 Web 测试                          |
| `pnpm test:e2e`                         | 运行 API E2E 测试                                     |
| `pnpm test:ci`                          | 执行类型检查、Lint、单元测试与 E2E                    |
| `pnpm audit:prod`                       | 阻断 high/critical 生产依赖漏洞                       |
| `pnpm docker:up`                        | 启动 Docker 服务                                      |
| `pnpm docker:down`                      | 停止 Docker 服务                                      |
| `pnpm release`                          | 交互式全栈打包向导（可自由组合组件/数据库/中间件）    |
| `pnpm ops --help`                       | 查看统一部署命令                                      |
| `pnpm ops pm2 start`                    | 使用项目内置 PM2 启动 API                             |
| `pnpm ops pack pm2-offline postgres`    | 生成 PM2 离线包                                       |
| `pnpm ops pack docker-offline postgres` | 生成 Docker 离线镜像包                                |
| `pnpm db:setup`                         | 数据库完整初始化（自适应切换+生成+迁移+填充）         |
| `pnpm db:migrate`                       | 执行开发迁移（自适应当前 DB_TYPE，支持 --pg/--mysql） |
| `pnpm db:generate`                      | 生成 Prisma Client（自适应当前 DB_TYPE）              |
| `pnpm db:seed`                          | 填充种子数据（内置多数据库适配器）                    |
| `pnpm admin:bootstrap`                  | 全新生产库初始化默认菜单和首个超级管理员             |
| `pnpm db:studio`                        | 打开 Prisma Studio 可视化数据面板                     |
| `pnpm db:deploy`                        | 生产环境部署迁移 (`migrate deploy`)                   |
| `pnpm db:verify`                        | 空库验证迁移与漂移（CI 专用，支持 --pg/--mysql）      |
| `pnpm db:baseline`                      | 旧 `db push` 数据库一次性基线登记                     |

## 开发规范与运维排障

- 全局启用 **TypeScript 严格模式** — 禁止使用 `any`
- 注释使用**中文**
- Git 提交遵循**约定式提交**格式（`feat/fix/chore/docs...`）
- 通过 **ESLint + Prettier** + lint-staged + husky 强制代码规范
- 所有 API 响应遵循 `{ code, data, message }` 统一格式，全链路请求自动携带 `x-request-id`
- 新增模块时遵循[模块开发示例](docs/module-development.md)；涉及数据库结构时同时遵循[Prisma 迁移规范](apps/api/prisma/README.md)
- 详细排障指南见 [生产运维与排障文档 (Troubleshooting Runbook)](docs/troubleshooting.md)

## 持续集成与安全门禁

GitHub Actions 会在主分支推送和 Pull Request 上执行类型检查、零警告 Lint、API/Web 单元测试、E2E、生产构建和生产依赖审计。另有独立任务在空 PostgreSQL/MySQL 实例上执行两套迁移链，并运行 Gitleaks 密钥扫描及 Trivy API/Web 镜像扫描。

生产 Compose 默认给容器配置了进程数、CPU、内存和日志轮转上限；API 与 Web 文件系统均为只读，API 仅 `/tmp` 与上传卷可写，并移除全部 Linux capabilities，Web 只保留 Nginx 启动所需的最小 capabilities 和临时目录。实际上线前仍需结合业务容量调整 `.env.deploy` 中的资源值，并在平台侧配置指标、告警与数据库备份恢复演练。

## 开源协议

本项目基于 [Apache License 2.0](LICENSE) 开源。你可以在遵守协议条款的前提下使用、修改和分发本项目；完整授权范围、再分发要求、专利许可及免责声明以 [LICENSE](LICENSE) 中的英文正文为准。

## 开源协作与发布

- 贡献代码、文档或问题反馈前，请阅读 [贡献指南](.github/CONTRIBUTING.md) 和 [行为准则](.github/CODE_OF_CONDUCT.md)。
- 安全漏洞、凭据泄露和隐私问题请按照 [安全策略](.github/SECURITY.md) 使用私密渠道报告，不要创建公开 Issue。
- Issue、Pull Request、代码所有者和发布权限由 `.github/` 下的模板与规则统一管理。
- 稳定版本使用 `vMAJOR.MINOR.PATCH` Git tag 发布，发布物、校验和及升级步骤见 [发布流程](docs/release.md)。
- 版本变更记录与升级说明见 [GitHub Releases](https://github.com/1503963513/ZhuoStack/releases)；生产部署和数据库迁移仍以 [部署指南](docs/deployment.md) 与 [Prisma 迁移规范](apps/api/prisma/README.md) 为准。
