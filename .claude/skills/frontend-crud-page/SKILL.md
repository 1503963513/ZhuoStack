---
name: frontend-crud-page
description: 用 PageHeader+DataTable+Pagination 组合新建前端 CRUD 管理页面时使用。提供标准页面骨架、列配置、分页、搜索、权限按钮、确认对话框的完整代码模板与组件 API。
---

# 前端 CRUD 页面模板

所有系统管理页面统一使用 `PageHeader` + `DataTable` + `Pagination` 组合，并直接调用由 `pnpm contract:sync` 产出的强类型客户端函数与数据模型。

## 标准模板代码

```tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/use-debounce';
import { useConfirm } from '@/hooks/use-confirm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { DataTable, type Column } from '@/components/common/data-table';
import { Pagination } from '@/components/common/pagination';
import { PermissionButton } from '@/components/common/permission-button';

// 从自动生成的契约中导入 API 函数与类型（无需手写 URL 与泛型断言）
import {
  postControllerFindAll,
  postControllerCreate,
  postControllerUpdate,
  postControllerRemove,
} from '@/api/generated/endpoints/系统-岗位管理/系统-岗位管理';
import type { PostItemDto } from '@/api/generated/models';

export default function ResourcePage() {
  const { confirm, ConfirmDialog } = useConfirm();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PostItemDto | null>(null);
  const [formData, setFormData] = useState({ name: '', code: '', sort: 0 });

  // 1. 获取分页列表
  const {
    data: response,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['resources', page, pageSize, debouncedSearch],
    queryFn: () =>
      postControllerFindAll({
        page,
        pageSize,
        search: debouncedSearch || undefined,
      }),
  });

  const list = response?.data?.data || [];
  const pagination = response?.data?.pagination || {
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 0,
  };

  // 2. 新增与更新 Mutation
  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => postControllerCreate(data),
    onSuccess: () => {
      toast.success('创建成功');
      setDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (err) => toast.error('创建失败', { description: err.message }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) => {
      if (!editingItem) throw new Error('未选择编辑项');
      return postControllerUpdate(editingItem.id, data);
    },
    onSuccess: () => {
      toast.success('更新成功');
      setDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (err) => toast.error('更新失败', { description: err.message }),
  });

  const resetForm = () => {
    setFormData({ name: '', code: '', sort: 0 });
    setEditingItem(null);
  };

  const handleEdit = (item: PostItemDto) => {
    setEditingItem(item);
    setFormData({ name: item.name, code: item.code, sort: item.sort });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({ description: '确定要删除吗？', variant: 'destructive' });
    if (!ok) return;
    try {
      await postControllerRemove(id);
      toast.success('删除成功');
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '删除失败';
      toast.error('删除失败', { description: msg });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) updateMutation.mutate(formData);
    else createMutation.mutate(formData);
  };

  // 列定义（label, span, render/key）
  const columns: Column<PostItemDto>[] = [
    { label: '名称', span: 3, key: 'name' },
    { label: '编码', span: 3, key: 'code' },
    { label: '排序', span: 2, key: 'sort' },
    {
      label: '创建时间',
      span: 4,
      render: (row) => new Date(row.createdAt).toLocaleDateString('zh-CN'),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="资源管理"
        description="管理系统资源列表"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => refetch()} title="刷新">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <PermissionButton
              perm="system:resource:add"
              onClick={() => {
                resetForm();
                setDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              新增资源
            </PermissionButton>
          </div>
        }
      />

      <div className="flex items-center gap-4">
        <Input
          placeholder="搜索关键词..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <DataTable
        columns={columns}
        data={list}
        isLoading={isLoading}
        emptyText="暂无数据"
        actions={(row) => (
          <div className="flex items-center gap-2">
            <PermissionButton
              perm="system:resource:edit"
              variant="ghost"
              size="sm"
              onClick={() => handleEdit(row)}
            >
              <Pencil className="mr-1 h-3.5 w-3.5" />
              编辑
            </PermissionButton>
            <PermissionButton
              perm="system:resource:delete"
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(row.id)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              删除
            </PermissionButton>
          </div>
        )}
      />

      <Pagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={pagination.total}
        totalPages={pagination.totalPages}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />

      {/* 增改弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingItem ? '编辑资源' : '新增资源'}</DialogTitle>
              <DialogDescription>填写信息并保存。</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">名称 *</Label>
                <Input
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="code">编码 *</Label>
                <Input
                  id="code"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? '保存中...' : '保存'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog />
    </div>
  );
}
```

## 组件 API 要点

- **`DataTable`**：
  - `columns: Column<T>[]`：每个列对象使用 `label`（标题）、`span`（占据网格数）、`key` 或 `render: (row: T) => ReactNode`。
  - `isLoading?: boolean`：加载中状态。
  - `actions?: (row: T) => ReactNode`：固定在右侧的操作按钮插槽。
- **`PermissionButton`**：
  - `perm: string`：传入权限字符，如 `system:user:add`。无权时默认隐藏。
- **`PageHeader`**：
  - `actions?: ReactNode`：右侧按钮组插槽。
- **`useConfirm`**：
  - `const { confirm, ConfirmDialog } = useConfirm()`
  - `const ok = await confirm({ description: '确定删除吗？', variant: 'destructive' })`
  - 必须在组件末尾渲染 `<ConfirmDialog />`。
