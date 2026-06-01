# 前端开发（Next.js）

本项目使用 Next.js 14 App Router + shadcn/ui + TanStack Query + Zustand + Tailwind CSS。

## 目录结构

```
apps/web/src/
├── app/                     # App Router 页面
│   ├── layout.tsx           # 根布局（Providers 包装）
│   ├── page.tsx             # 首页
│   ├── globals.css          # Tailwind + CSS 变量
│   ├── (auth)/              # 公开认证路由
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   └── (dashboard)/         # 需认证的路由（layout 检查认证状态）
│       ├── layout.tsx       # 认证守卫 + 侧边栏 + 顶栏
│       ├── dashboard/page.tsx
│       └── profile/page.tsx
├── components/
│   ├── auth/                # 认证相关表单
│   ├── common/              # 通用组件（Loading、ErrorBoundary）
│   ├── layout/              # 布局组件（Providers、Header、Sidebar）
│   └── ui/                  # shadcn/ui 组件（avatar、button、card 等）
├── hooks/
│   ├── use-api.ts           # useApiQuery<T>、useApiMutation<T>
│   ├── use-auth.ts          # useLogin、useRegister、useProfile、useLogout
│   └── use-debounce.ts      # 通用防抖 Hook
├── lib/
│   ├── api-client.ts        # Axios 实例 + JWT 拦截器
│   ├── constants.ts         # APP_NAME、ROUTES、STORAGE_KEYS
│   └── utils.ts             # cn() 工具函数（clsx + tailwind-merge）
├── schemas/
│   ├── auth.schema.ts       # 登录/注册的 Zod 验证 Schema
│   └── user.schema.ts       # 用户更新的 Zod 验证 Schema
├── stores/
│   └── auth-store.ts        # Zustand persist 状态管理
└── types/
    ├── api.ts                # ApiResponse<T>、PaginatedResponse<T>
    └── user.ts               # Role、User、AuthResponse 类型
```

## 数据请求模式

### 读取数据（useApiQuery）：

```typescript
const { data, isLoading, error } = useApiQuery<User>(['user', id], `/api/user/${id}`);
```

### 变更数据（useApiMutation）：

```typescript
const updateMutation = useApiMutation<User>('put', `/api/user/${id}`, {
  invalidateKeys: [['user', id]],  // 成功后自动刷新关联查询
  onSuccess: () => toast.success('更新成功！'),
});

updateMutation.mutate({ name: '新名称' });
```

### 数据请求核心规则：
- 始终使用 `useApiQuery` / `useApiMutation` — 不要在组件中直接调用 `api-client`
- 查询键格式：`['资源名', ...标识符]`
- 使用 `invalidateKeys` 选项在变更后自动刷新关联查询
- API 客户端自动处理 JWT 注入和 401 重定向

## 新增页面

1. **公开页面**：放在 `app/(auth)/<路由>/page.tsx`
2. **受保护页面**：放在 `app/(dashboard)/<路由>/page.tsx`
3. **受保护页面**必须是客户端组件（`'use client'`），因为 layout 会检查 `useAuthStore`

### 页面模板（受保护页面）：

```tsx
'use client';

import { useApiQuery } from '@/hooks/use-api';

export default function MyPage() {
  const { data, isLoading } = useApiQuery<DataType>(['my-key'], '/api/my-route');

  if (isLoading) return <Loading />;
  return <div>{/* 内容 */}</div>;
}
```

## 表单开发模式

表单使用 React Hook Form + Zod 验证：

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { mySchema, MyFormValues } from '@/schemas/my.schema';

const form = useForm<MyFormValues>({
  resolver: zodResolver(mySchema),
  defaultValues: { field: '' },
});
```

## UI 组件

- **使用 shadcn/ui** 作为所有 UI 基础组件（Button、Input、Card、Label 等）
- **添加新组件**：`npx shadcn-ui@latest add <组件名>` — 自动放入 `components/ui/`
- **使用 `cn()`**（来自 `lib/utils.ts`）进行条件样式合并
- **暗色模式**：由 `next-themes` 处理 — 使用 `globals.css` 中定义的 CSS 变量
- **图标**：使用 `lucide-react`（已安装）
- **提示消息**：使用 `sonner` — `toast.success()`、`toast.error()` 等

## 核心规则

- **`'use client'` 指令**：任何使用 hooks、state 或浏览器 API 的组件都必须添加
- **路径别名**：`@/*` 映射到 `./src/*`，`@myapp/shared-types` 映射到共享类型包
- **禁止 `any`** — 强制 TypeScript 严格模式
- **CSS**：仅使用 Tailwind — 不用 CSS Modules、不用 styled-components
- **API 代理**：`next.config.ts` 将 `/api/*` 重写到 `NEXT_PUBLIC_API_URL` — 前端开发时直接调用 `/api/*`
- **环境变量**：`.env.local` 中只需 `NEXT_PUBLIC_API_URL`
- **常量管理**：路由和魔法字符串放在 `lib/constants.ts`，不要硬编码
