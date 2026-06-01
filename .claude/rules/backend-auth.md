# 认证与鉴权

本项目使用基于 JWT 的认证体系，配合 Passport.js 和角色权限控制。

## 认证架构

```
客户端 → Authorization 请求头携带 JWT → JwtStrategy.validate() → 数据库查询用户 → request.user
```

### 关键文件

| 文件 | 用途 |
|------|------|
| `modules/auth/auth.module.ts` | 导入 PassportModule、JwtModule.register({}) |
| `modules/auth/auth.service.ts` | register（注册）、login（登录）、getProfile（获取资料）、generateToken（生成令牌） |
| `modules/auth/auth.controller.ts` | POST /auth/register、/auth/login、GET /auth/profile |
| `modules/auth/strategies/jwt.strategy.ts` | 提取 JWT，通过数据库查询验证 |
| `common/guards/jwt-auth.guard.ts` | 继承 AuthGuard('jwt')，抛出 UnauthorizedException |
| `common/guards/roles.guard.ts` | 检查 user.role 是否匹配 @Roles() 元数据 |
| `common/decorators/current-user.decorator.ts` | @CurrentUser() 参数装饰器 |
| `common/decorators/roles.decorator.ts` | @Roles(Role.ADMIN)，基于 SetMetadata |
| `stores/auth-store.ts`（前端） | Zustand persist store，key: "auth-storage" |

## JWT 配置

- **密钥**：`JWT_SECRET` 环境变量（必填）
- **过期时间**：`JWT_EXPIRES_IN` 环境变量（默认 `7d`）
- **载荷**：`{ sub: userId, email }` — 定义在 `JwtPayload` 接口中
- **令牌格式**：请求头 `Authorization: Bearer <token>`
- JwtModule 在 auth.module.ts 中以 `{}` 空配置注册 — 实际签名通过 JwtService + ConfigService 完成

## 为新路由添加认证

### 要求整个 Controller 登录才能访问：

```typescript
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('resource')
export class ResourceController { ... }
```

### 限制仅管理员访问：

```typescript
@Post()
@Roles(Role.ADMIN)
create(@Body() dto: CreateDto) { ... }
```

### 在 Controller 中获取当前用户：

```typescript
@Get('profile')
getProfile(@CurrentUser() user: { id: string; email: string }) { ... }

// 或提取特定属性：
@Get('id')
getUserId(@CurrentUser('id') userId: string) { ... }
```

## 前端认证流程

### 令牌存储
- Zustand Store + `persist` 中间件 → localStorage，key 为 `"auth-storage"`
- Store 结构：`{ token, user, isAuthenticated, setAuth, clearAuth, setUser }`

### API 客户端认证
- `lib/api-client.ts` 请求拦截器从 localStorage 读取 `auth-storage`
- 自动附加 `Authorization: Bearer <token>` 请求头
- 响应拦截器：收到 401 → 清除存储 + 重定向到 `/login`

### 认证 Hooks（`hooks/use-auth.ts`）
- `useLogin()` — 调用 POST /auth/login，成功后调用 `setAuth(token, user)`
- `useRegister()` — 调用 POST /auth/register，成功后调用 `setAuth(token, user)`
- `useProfile()` — 调用 GET /auth/profile 获取最新用户数据
- `useLogout()` — 调用 `clearAuth()` + 重定向到 `/login`

### 路由保护（App Router）
- `(dashboard)/layout.tsx` — 客户端组件，检查 `useAuthStore.isAuthenticated`
- 未认证时自动重定向到 `/login`
- `(auth)/` 路由 — 公开页面，无认证检查

## 核心规则

- **密码哈希**：始终使用 `bcryptjs`，salt rounds 为 10
- **永远不要返回密码**：每个查询都用 Prisma `select` 排除 `password` 字段
- **每次请求查询数据库**：JwtStrategy.validate() 会查询数据库 — 不要在 JWT 载荷中缓存用户信息，只放 id + email
- **角色枚举**：从 `@prisma/client` 导入 — `Role.USER` 和 `Role.ADMIN`
- **Guard 顺序很重要**：始终 `JwtAuthGuard` 在前、`RolesGuard` 在后
- **前端 401 处理**：Axios 拦截器已自动处理登出 + 重定向 — 组件中不要重复处理
- **无刷新令牌**：当前实现没有 Refresh Token — `JWT_EXPIRES_IN` 控制令牌有效期
