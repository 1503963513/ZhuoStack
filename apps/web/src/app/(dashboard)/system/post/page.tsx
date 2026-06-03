'use client';

import { useState } from 'react';
import { useApiQuery, useApiMutation } from '@/hooks/use-api';
import { useDebounce } from '@/hooks/use-debounce';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { buildUrl } from '@/lib/utils';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { PermissionButton } from '@/components/common/permission-button';
import { PageHeader } from '@/components/common/page-header';
import { DataTable, type Column } from '@/components/common/data-table';
import { Pagination } from '@/components/common/pagination';
import { useConfirm } from '@/hooks/use-confirm';

interface Post {
  id: string;
  name: string;
  code: string;
  sort: number;
  status: string;
  remark: string | null;
}

interface PaginatedResponse {
  data: Post[];
  pagination: { total: number; page: number; pageSize: number; totalPages: number };
}

export default function PostPage() {
  const { confirm, ConfirmDialog } = useConfirm();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    sort: 0,
    status: 'ACTIVE',
    remark: '',
  });

  const { data, isLoading, refetch } = useApiQuery<PaginatedResponse>(
    ['posts', String(page), String(pageSize), debouncedSearch],
    buildUrl('/api/system/post', { page, pageSize, search: debouncedSearch || undefined }),
  );

  const createMutation = useApiMutation('post', '/api/system/post', {
    onSuccess: () => {
      toast.success('创建成功');
      setDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => toast.error('创建失败', { description: error.message }),
  });

  const updateMutation = useApiMutation('put', `/api/system/post/${editingPost?.id || ''}`, {
    onSuccess: () => {
      toast.success('更新成功');
      setDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => toast.error('更新失败', { description: error.message }),
  });

  const resetForm = () => {
    setFormData({ name: '', code: '', sort: 0, status: 'ACTIVE', remark: '' });
    setEditingPost(null);
  };

  const handleCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleEdit = (post: Post) => {
    setEditingPost(post);
    setFormData({
      name: post.name,
      code: post.code,
      sort: post.sort,
      status: post.status,
      remark: post.remark || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({ description: '确定要删除吗？', variant: 'destructive' });
    if (!ok) return;
    import('@/lib/api-client').then((m) =>
      m.del(`/api/system/post/${id}`).then(() => {
        toast.success('删除成功');
        refetch();
      }).catch((err) => toast.error('删除失败', { description: err.message }))
    );
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.code) {
      toast.error('请填写必填项');
      return;
    }

    if (editingPost) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const posts = data?.data?.data || [];
  const pagination = data?.data?.pagination;

  const columns: Column<Post>[] = [
    { label: '岗位名称', key: 'name', span: 2 },
    { label: '岗位编码', key: 'code', span: 2 },
    { label: '排序', key: 'sort', span: 1 },
    {
      label: '状态', span: 2,
      render: (row) => (
        <Badge variant={row.status === 'ACTIVE' ? 'default' : 'secondary'}>
          {row.status === 'ACTIVE' ? '启用' : '停用'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="岗位管理"
        description="管理系统岗位信息"
        actions={
          <PermissionButton perm="system:post:add" onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            新增岗位
          </PermissionButton>
        }
      />

      <div className="flex gap-4">
        <Input
          placeholder="搜索岗位名称/编码"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-sm"
        />
      </div>

      <DataTable
        columns={columns}
        data={posts}
        isLoading={isLoading}
        emptyText="暂无岗位数据"
        actionsSpan={2}
        actions={(row) => (
          <>
            <PermissionButton perm="system:post:edit" variant="ghost" size="sm" onClick={() => handleEdit(row)}>
              <Pencil className="h-4 w-4" />
            </PermissionButton>
            <PermissionButton perm="system:post:delete" variant="ghost" size="sm" onClick={() => handleDelete(row.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </PermissionButton>
          </>
        )}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPost ? '编辑岗位' : '新增岗位'}</DialogTitle>
            <DialogDescription>请填写岗位信息</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>岗位名称 *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="请输入岗位名称"
                />
              </div>
              <div className="space-y-2">
                <Label>岗位编码 *</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="请输入岗位编码"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>排序</Label>
                <Input
                  type="number"
                  value={formData.sort}
                  onChange={(e) => setFormData({ ...formData, sort: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>状态</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">启用</SelectItem>
                    <SelectItem value="INACTIVE">停用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Input
                value={formData.remark}
                onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                placeholder="请输入备注"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? '提交中...' : '确定'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog />
    </div>
  );
}
