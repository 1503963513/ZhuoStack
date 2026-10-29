# 生产部署与运行时排障指南 (Troubleshooting Runbook)

本指南面向生产环境使用 ZhuoStack 遇到故障时的应急排查与快速定位。

---

## 一、排障第一法则：全链路请求 ID (`x-request-id`)

系统针对每一次 HTTP 请求均自动注入或透传唯一的 `x-request-id`。

### 1. 客户端如何获取 Request ID

- **响应头**：每个 API 响应的 Response Header 中均包含 `x-request-id: req_xxxxxxxx`。
- **错误响应体**：当接口报错（4xx / 5xx）时，JSON 响应体直接附带 `requestId`：
  ```json
  {
    "code": 500,
    "data": null,
    "message": "Internal server error",
    "requestId": "req_8f1a2b3c4d5e"
  }
  ```
- **前端捕获**：`api-client.ts` 会自动将该 ID 挂载至 `error.requestId`。

### 2. 服务端如何检索对应日志

拿到用户提供的 `requestId` 后，可在日志中秒级定位整条异常堆栈：

```bash
# Docker 部署环境
docker compose logs api | grep "req_8f1a2b3c4d5e"

# PM2 部署环境
pm2 logs api | grep "req_8f1a2b3c4d5e"

# 云原生日志平台（Loki / ELK / CloudWatch / 阿里云 SLS）
# 查询语句：
requestId = "req_8f1a2b3c4d5e"
```

---

## 二、HTTP 状态码速查与定位

| 状态码  | 典型报错信息                                             | 根因排查与解决办法                                                                                                                                                                                                  |
| :------ | :------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **401** | `Authentication required` / `会话已失效，请重新登录`     | 1. 客户端未携带有效的 HttpOnly `access_token` Cookie。<br>2. Redis 中 `token:active:${userId}` 被清空或用户在其他设备登录（被新登录踢下线）。<br>3. 检查浏览器域名与后端是否满足同域或 CORS HTTPS 要求。            |
| **403** | `CSRF 校验失败，请刷新页面后重试`                        | Cookie 认证发起非 GET 请求时，缺少 `x-csrf-token` 请求头，或该值与 Cookie 中的 `csrf_token` 不一致。<br>**解决**：检查前端请求是否携带了 `withCredentials: true`，以及客户端是否从 Cookie 正确读取了 `csrf_token`。 |
| **403** | `You do not have permission to access this resource`     | 当前登录用户角色（如 `USER`）无权访问带有 `@Roles(Role.ADMIN)` 保护的管理员接口。                                                                                                                                   |
| **413** | `文件大小超过限制，请上传 50MB 以内的文件`               | 上传文件体积超过 `FILE_MAX_SIZE_MB` 限制或 Nginx `client_max_body_size` 限制。                                                                                                                                      |
| **500** | `Internal server error`                                  | 未捕获的服务端异常。在日志中搜索对应的 `[req_xxxx]` 查看真实的错误堆栈。                                                                                                                                            |
| **503** | `安全状态存储不可用，无法执行 GETDEL` / `Redis 连接失败` | 后端无法连接到 Redis，或 Redis 拒绝连接。<br>**解决**：检查 Redis 容器运行状态与 `REDIS_URL` 端口密码配置。                                                                                                         |

---

## 三、健康检查探针解读与诊断

服务提供三套标准探针端点：

### 1. 深度就绪探针（Readiness Probe）：`GET /health` 或 `GET /health/readiness`

实时探测数据库与 Redis 连通性及耗时：

```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up", "latencyMs": 1.2 },
    "redis": { "status": "up", "latencyMs": 0.8 }
  },
  "error": {},
  "details": { ... }
}
```

- 如果任一依赖不可用，接口会返回 **HTTP 503**，并在 `error` 字段指出具体哪一个组件故障。
- **运维用途**：配置在反向代理（Nginx upstream / K8s Service）的健康检查中，依赖恢复前自动切走流量。

### 2. 容器存活探针（Liveness Probe）：`GET /health/liveness`

```json
{
  "status": "ok",
  "uptime": 3600,
  "timestamp": "2026-10-23T14:00:00.000Z"
}
```

- **运维用途**：配置在 Docker / K8s 的存活探针中。仅检测 Node.js 进程事件循环是否挂起，**不深度依赖外部数据库**，避免因外部网络偶发抖动引发容器恶性重启。

---

## 四、数据库常见故障与恢复 (Prisma)

### 1. `PrismaClientInitializationError: A driver adapter is required`

- **根因**：项目基于 Prisma 7+，必须传入 Driver Adapter（Postgres 使用 `@prisma/adapter-pg`，MySQL 使用 `@prisma/adapter-mariadb`）。
- **排查**：检查 `apps/api/.env.production` 中的 `DB_TYPE` 是否正确设置为 `postgres` 或 `mysql`。

### 2. 生产环境容器启动卡在迁移：`prisma migrate deploy` 报错

- **报错表现**：`Migration ... failed to apply cleanly` / `Database error: ... already exists`。
- **排障步骤**：
  1. 查看迁移历史表：进入数据库执行 `SELECT * FROM _prisma_migrations ORDER BY started_at DESC;`。
  2. 若存在 `applied_steps_count = 0` 且 `rolled_back_at IS NULL` 的死锁迁移记录，说明上次迁移执行到一半被强制 kill。
  3. 修复方案：
     ```bash
     # 标记故障迁移已回滚或已解决
     pnpm --filter api exec prisma migrate resolve --rolled-back "<迁移名称>"
     ```

---

## 五、Redis 缓存与状态故障

### 1. 登录时报错 `安全状态存储不可用`

- **排查 1**：Redis 服务是否正常运行：
  ```bash
  docker compose exec redis redis-cli ping
  # 必须返回 PONG
  ```
- **排查 2**：`REDIS_URL` 配置是否正确，如果 Redis 启用了密码，URL 格式必须为：
  `redis://:密码@主机:端口`（注意冒号 `:` 不能漏）。
- **排查 3**：如果允许无 Redis 启动（开发/测试环境），需在环境变量中显式配置 `REDIS_REQUIRED=false`。

### 2. 管理员误删了 Redis 数据，如何恢复？

- 系统采用了**分离前缀设计**：
  - 纯缓存数据（`menu:*`、`dict:*`、`dept:*`）：丢失后无需处理，用户下一次访问时后端会自动从数据库重新载入并建立缓存。
  - 安全会话（`token:active:*`）：若丢失会导致全员登录态失效，属于预期安全行为，用户重新登录即可重建。

---

## 六、HTTPS、Cookie 与跨域故障

### 1. 登录成功但后续请求全部报 401（Cookie 丢失）

- **根因**：认证 Cookie 设置了 `SameSite=Strict; Secure; HttpOnly`。
- **排查清单**：
  1. **HTTPS 检查**：生产环境必须通过 HTTPS 协议访问，明文 HTTP 协议下浏览器会静默拒绝保存带有 `Secure` 属性的 Cookie。
  2. **同域反向代理**：确保前端静态页面与后端 API 通过同域名代理（如 `https://example.com` 托管前端，`https://example.com/api/*` 代理到后端）。如果跨域，Cookie 的 `SameSite` 与 `Domain` 必须单独调优。
  3. **CORS_ORIGIN 检查**：后端 `CORS_ORIGIN` 必须与前端访问地址绝对一致，且不能使用通配符 `*`。

---

## 七、快速自检清单 (Production Pre-flight Checklist)

上线前执行一次完整自检：

```bash
# 1. 验证契约一致性（确保无未生成的代码）
pnpm contract:sync
git diff --exit-code apps/web/openapi.json apps/web/src/api/generated/

# 2. 检查数据库就绪状态
pnpm db:verify  # 或 pnpm db:verify --pg / --mysql

# 3. 检查就绪探针响应
curl -i http://localhost:3100/health/readiness
```
