# 前端 Hooks 与通用模式

本项目封装了多个自定义 Hooks，统一数据请求、权限控制、字典管理等模式。

## 数据请求（useApiQuery / useApiMutation）

位于 `hooks/use-api.ts`，封装 TanStack Query：

```tsx
// 读取数据
const { data, isLoading, refetch } = useApiQuery<DataType>(
  ['key', param],           // 查询键
  '/api/resource?page=1',   // API 路径（含 /api 前缀）
  { enabled: true },        // 可选：控制是否启用查询
);

// 变更数据
const mutation = useApiMutation<DataType>('post', '/api/resource', {
  invalidateKeys: [['key']],  // 成功后自动刷新关联查询
  onSuccess: () => toast.success('操作成功'),
  onError: (err) => toast.error('失败', { description: err.message }),
});

mutation.mutate({ field: 'value' });
```

**核心规则**：
- API 路径始终带 `/api` 前缀（`baseURL` 为空，Next.js rewrites 代理）
- 查询键格式：`['资源名', ...标识符]`
- 使用 `invalidateKeys` 自动刷新关联查询
- 不要在组件中直接调用 `api-client`，始终使用 Hooks

## 字典 Hook（useDict）

位于 `hooks/use-dict.ts`，从字典 API 获取数据：

```tsx
import { useDict } from '@/hooks/use-dict';

const { labelMap, getLabel, dictData, isLoading } = useDict('sys_business_type');

// 方式一：映射表（推荐，适合多次查找）
<Badge>{labelMap[String(value)] || '默认值'}</Badge>

// 方式二：函数
<span>{getLabel(String(value))}</span>

// 方式三：获取完整列表（适合下拉框）
<Select>
  {dictData.map((item) => (
    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
  ))}
</Select>
```

**系统内置字典编码**：
| 编码 | 名称 | 用途 |
|------|------|------|
| `sys_status` | 系统状态 | ACTIVE/INACTIVE |
| `sys_yes_no` | 是否 | 1/0 |
| `sys_user_gender` | 用户性别 | male/female/unknown |
| `sys_role_type` | 角色类型 | ADMIN/USER |
| `sys_menu_type` | 菜单类型 | DIRECTORY/MENU/BUTTON |
| `sys_business_type` | 业务操作类型 | 0-4 |
| `sys_oper_status` | 操作状态 | 1(成功)/0(失败) |
| `sys_hidden` | 隐藏状态 | 0(显示)/1(隐藏) |

**后端接口**：`GET /api/system/dict/code/:code`

## 权限控制（usePermissions / PermissionButton）

### usePermissions Hook

位于 `hooks/use-permission.ts`，从菜单树中提取权限标识：

```tsx
import { usePermissions } from '@/hooks/use-permission';

const { hasPermission, hasAnyPermission, permissions, isLoading } = usePermissions();

// 检查单个权限
if (hasPermission('system:user:add')) { ... }

// 检查任一权限
if (hasAnyPermission(['system:user:add', 'system:user:edit'])) { ... }
```

### PermissionButton 组件

位于 `components/common/permission-button.tsx`，用法与 Button 完全一致：

```tsx
import { PermissionButton } from '@/components/common/permission-button';

// 无权限时隐藏（默认）
<PermissionButton perm="system:user:add" onClick={handleAdd}>
  新增用户
</PermissionButton>

// 无权限时禁用
<PermissionButton perm="system:user:add" hideWhenNoPerm={false} onClick={handleAdd}>
  新增用户
</PermissionButton>

// 支持所有 Button props
<PermissionButton perm="system:role:delete" variant="ghost" size="sm">
  <Trash2 className="h-4 w-4" />
</PermissionButton>
```

**权限标识格式**：`模块:资源:操作`，如 `system:user:add`

**系统内置权限标识**：
| 模块 | 权限标识 |
|------|----------|
| 用户管理 | `system:user:add/edit/delete` |
| 角色管理 | `system:role:add/edit/delete` |
| 部门管理 | `system:dept:add/edit/delete` |
| 岗位管理 | `system:post:add/edit/delete` |
| 菜单管理 | `system:menu:add/edit/delete` |
| 字典管理 | `system:dict:add/edit/delete/data` |
| 操作日志 | `log:oper:delete` |
| 登录日志 | `log:login:delete` |

## 密码加密（encryptPassword）

位于 `lib/crypto.ts`，使用 RSA-2048 OAEP 加密：

```tsx
import { encryptPassword } from '@/lib/crypto';

const onSubmit = async (data: FormData) => {
  try {
    const encrypted = await encryptPassword(data.password);
    loginMutation.mutate({ email: data.email, password: encrypted });
  } catch {
    toast.error('加密失败，请刷新页面重试');
  }
};
```

**加密流程**：
1. 前端调用 `GET /api/auth/public-key` 获取 RSA 公钥（5 分钟缓存）
2. 使用 `node-forge` 的 RSA-OAEP + SHA-256 加密密码
3. Base64 编码后发送到后端
4. 后端用 `crypto.privateDecrypt` 解密

**适用场景**：登录、注册、修改密码（旧密码+新密码都要加密）

## 认证相关（use-auth）

位于 `hooks/use-auth.ts`：

```tsx
import { useLogin, useRegister, useProfile, useLogout } from '@/hooks/use-auth';

// 登录
const login = useLogin();
login.mutate({ email, password });

// 注册
const register = useRegister();
register.mutate({ email, password, name });

// 获取用户资料
const { data: profile } = useProfile();

// 登出
const logout = useLogout();
logout();
```

## 防抖（useDebounce）

位于 `hooks/use-debounce.ts`：

```tsx
import { useDebounce } from '@/hooks/use-debounce';

const [search, setSearch] = useState('');
const debouncedSearch = useDebounce(search, 300);

// 用 debouncedSearch 作为查询参数，避免每次输入都请求
const { data } = useApiQuery(['list', debouncedSearch], `/api/resource?search=${debouncedSearch}`);
```

## 通用规则

- **禁止 `any`**：ESLint 强制，使用具体类型或泛型
- **路径别名**：`@/*` 映射到 `./src/*`
- **CSS**：仅用 Tailwind，不用 CSS Modules
- **图标**：`lucide-react`
- **提示消息**：`sonner` — `toast.success()`、`toast.error()`
- **UI 组件**：`shadcn/ui`，用 `cn()` 合并样式
