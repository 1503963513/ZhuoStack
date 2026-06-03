# 前端 CRUD 页面模板

所有系统管理页面统一使用 `PageHeader` + `DataTable` + `Pagination` 组合。

## 标准模板

```tsx
'use client';

import { useState } from 'react';
import { useApiQuery, useApiMutation } from '@/hooks/use-api';
import { useDebounce } from '@/hooks/use-debounce';
import { useConfirm } from '@/hooks/use-confirm';
import { buildUrl } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { DataTable, type Column } from '@/components/common/data-table';
import { Pagination } from '@/components/common/pagination';
import { PermissionButton } from '@/components/common/permission-button';

interface Resource {
  id: string;
  name: string;
  status: string;
  // ...
}

interface PaginatedResponse {
  data: Resource[];
  pagination: { total: number; page: number; pageSize: number; totalPages: number };
}

export default function ResourcePage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const { confirm, ConfirmDialog } = useConfirm();

  const { data, isLoading, refetch } = useApiQuery<PaginatedResponse>(
    ['resources', String(page), String(pageSize), debouncedSearch],
    buildUrl('/api/system/resource', { page, pageSize, search: debouncedSearch || undefined }),
  );

  const createMutation = useApiMutation('post', '/api/system/resource', {
    onSuccess: () => { toast.success('创建成功'); refetch(); },
    onError: (err) => toast.error('创建失败', { description: err.message }),
  });

  const list = data?.data?.data || [];
  const pagination = data?.data?.pagination;

  const handleDelete = async (id: string) => {
    const ok = await confirm({ description: '确定要删除吗？', variant: 'destructive' });
    if (!ok) return;
    try {
      const { del } = await import('@/lib/api-client');
      await del(`/api/system/resource/${id}`);
      toast.success('删除成功');
      refetch();
    } catch (err: any) {
      toast.error('删除失败', { description: err.message });
    }
  };

  const columns: Column<Resource>[] = [
    { label: '名称', key: 'name', span: 3 },
    { label: '状态', span: 2, render: (row) => <Badge>{row.status}</Badge> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="资源管理"
        description="管理系统资源"
        actions={
          <>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" /> 刷新
            </Button>
            <PermissionButton perm="system:resource:add" onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" /> 新增
            </PermissionButton>
          </>
        }
      />

      <Input
        placeholder="搜索"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        className="max-w-sm"
      />

      <DataTable
        columns={columns}
        data={list}
        isLoading={isLoading}
        emptyText="暂无数据"
        actions={(row) => (
          <>
            <PermissionButton perm="system:resource:edit" variant="ghost" size="sm" onClick={() => handleEdit(row)}>
              <Pencil className="h-4 w-4" />
            </PermissionButton>
            <PermissionButton perm="system:resource:delete" variant="ghost" size="sm" onClick={() => handleDelete(row.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </PermissionButton>
          </>
        )}
        actionsSpan={2}
      />

      {pagination && (
        <Pagination
          page={page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
      )}

      <ConfirmDialog />
    </div>
  );
}
```

## 组件说明

### PageHeader

页面顶部标题 + 操作按钮区域。

```tsx
<PageHeader
  title="页面标题"
  description="页面描述（可选）"
  actions={<Button>操作按钮</Button>}
/>
```

### DataTable

通用数据表格，列配置驱动。

```tsx
<DataTable
  columns={[
    { label: '列名', key: 'field', span: 3 },          // 直接取字段值
    { label: '状态', span: 2, render: (row) => ... },   // 自定义渲染
  ]}
  data={list}
  isLoading={isLoading}
  emptyText="暂无数据"
  actions={(row) => <Button>编辑</Button>}              // 操作列
  actionsSpan={2}                                        // 操作列宽度
  onRowClick={(row) => ...}                              // 行点击
/>
```

**Column 配置**：
- `label`：列标题
- `key`：数据字段名（和 `render` 二选一）
- `span`：grid 占用列数（默认 1）
- `render`：自定义渲染函数

### Pagination

居中分页组件，支持 pageSize 切换和手动输入页码。不足一页自动隐藏。

```tsx
{pagination && (
  <Pagination
    page={page}
    totalPages={pagination.totalPages}
    total={pagination.total}         // 可选：显示总数
    pageSize={pageSize}              // 可选：当前每页条数
    onPageChange={setPage}
    onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}  // 可选：切换每页条数
  />
)}
```

## URL 构建

使用 `buildUrl` 替代手动拼接查询字符串：

```tsx
import { buildUrl } from '@/lib/utils';

// 自动过滤 undefined/null/空字符串
buildUrl('/api/system/resource', { page, pageSize, search: debouncedSearch || undefined })
```

## 确认对话框

使用 `useConfirm` 替代原生 `confirm()`：

```tsx
const { confirm, ConfirmDialog } = useConfirm();

// 在组件 JSX 末尾渲染
<ConfirmDialog />

// 调用
const ok = await confirm({ description: '确定要删除吗？', variant: 'destructive' });
if (!ok) return;
```
