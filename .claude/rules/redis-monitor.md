# Redis 缓存键管理

本项目使用 Redis 存储缓存和状态数据。所有 key 前缀必须在 `monitor.service.ts` 中注册。

## Key 前缀注册

文件：`apps/api/src/modules/monitor/monitor.service.ts`

```typescript
// 允许通过「清空缓存」删除的键前缀
const ALLOWED_KEY_PREFIXES = ['menu:', 'dict:', 'dept:', 'captcha:', 'token:blacklist:', 'cache:'];

// 禁止删除的安全键前缀（优先级高于 ALLOWED_KEY_PREFIXES）
const PROTECTED_KEY_PREFIXES = ['token:active:', 'login:', 'kicked:', 'online:user:'];
```

## 新增 Redis key 时的规则

**每次新增 Redis key 前缀时，必须同步更新上述两个常量之一。**

### 判断标准

| 类型 | 归属 | 示例 | 原因 |
|------|------|------|------|
| 纯缓存（丢失后可重建） | `ALLOWED_KEY_PREFIXES` | `menu:*`、`dict:*`、`captcha:*` | 清空后访问时自动从 DB 重建 |
| 安全/状态（丢失会出事） | `PROTECTED_KEY_PREFIXES` | `token:active:*`、`login:*`、`kicked:*` | 丢失 = 安全机制失效 |
| 废弃的临时安全数据 | `ALLOWED_KEY_PREFIXES` | `token:blacklist:*` | 已无实际作用，可清理 |

### 操作流程

1. 在代码中使用新的 Redis key 前缀（如 `redisService.set('xxx:yyy', ...)`）
2. 判断该前缀属于「可清理缓存」还是「安全键」
3. 更新 `monitor.service.ts` 中对应的常量
4. 如果不确定，**必须询问用户**

## 当前所有 Redis key 前缀一览

| 前缀 | 用途 | 归属 | TTL |
|------|------|------|-----|
| `menu:tree` | 菜单树缓存 | ALLOWED | 1 小时 |
| `menu:list` | 菜单列表缓存 | ALLOWED | 1 小时 |
| `menu:{id}` | 单个菜单缓存 | ALLOWED | 1 小时 |
| `dict:list` | 字典列表缓存 | ALLOWED | 1 小时 |
| `dict:data:{code}` | 字典数据缓存 | ALLOWED | 1 小时 |
| `dept:list` | 部门列表缓存 | ALLOWED | 1 小时 |
| `dept:tree` | 部门树缓存 | ALLOWED | 1 小时 |
| `captcha:{id}` | 图形验证码答案 | ALLOWED | 5 分钟 |
| `token:blacklist:{hash}` | 已废弃的 token 黑名单 | ALLOWED | token 剩余有效期 |
| `token:active:{userId}` | 当前活跃 token 的 jti | PROTECTED | 90 天 |
| `login:attempts:{email}` | 登录失败计数 | PROTECTED | 15 分钟 |
| `login:lock:{email}` | 账号锁定标记 | PROTECTED | 15 分钟 |
| `kicked:user:{userId}` | 管理员踢出标记 | PROTECTED | 30 秒 |
| `online:user:{userId}` | 在线用户状态 | PROTECTED | 30 分钟 |
