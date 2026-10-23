'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
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
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { PermissionButton } from '@/components/common/permission-button';
import { PageHeader } from '@/components/common/page-header';
import { DataTable, type Column } from '@/components/common/data-table';
import { Pagination } from '@/components/common/pagination';
import { useConfirm } from '@/hooks/use-confirm';
import {
  postControllerFindAll,
  postControllerCreate,
  postControllerUpdate,
  postControllerRemove,
} from '@/api/generated/endpoints/系统-岗位管理/系统-岗位管理';
import type { PostItemDto, CreatePostDtoStatus } from '@/api/generated/models';

export default function PostPage() {
  const { confirm, ConfirmDialog } = useConfirm();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<PostItemDto | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    sort: 0,
    status: 'ACTIVE' as CreatePostDtoStatus,
    remark: '',
  });

  const {
    data: response,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['posts', page, pageSize, debouncedSearch],
    queryFn: () =>
      postControllerFindAll({
        page,
        pageSize,
        search: debouncedSearch || undefined,
      }),
  });

  const posts = response?.data?.data || [];
  const pagination = response?.data?.pagination || {
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 0,
  };

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      postControllerCreate({
        name: data.name,
        code: data.code,
        sort: data.sort,
        status: data.status,
        remark: data.remark || undefined,
      }),
    onSuccess: () => {
      toast.success('创建成功');
      setDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => toast.error('创建失败', { description: error.message }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) => {
      if (!editingPost) throw new Error('未选择编辑岗位');
      return postControllerUpdate(editingPost.id, {
        name: data.name,
        code: data.code,
        sort: data.sort,
        status: data.status,
        remark: data.remark || undefined,
      });
    },
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

  const handleEdit = (post: PostItemDto) => {
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
    const ok = await confirm({ description: '确定要删除该岗位吗？', variant: 'destructive' });
    if (!ok) return;
    try {
      await postControllerRemove(id);
      toast.success('删除成功');
      refetch();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '删除失败';
      toast.error('删除失败', { description: errorMsg });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPost) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const columns: Column<PostItemDto>[] = [
    { label: '岗位名称', span: 2, key: 'name' },
    { label: '岗位编码', span: 2, key: 'code' },
    { label: '排序', span: 1, key: 'sort' },
    {
      label: '状态',
      span: 2,
      render: (p) => (
        <Badge variant={p.status === 'ACTIVE' ? 'default' : 'secondary'}>
          {p.status === 'ACTIVE' ? '正常' : '停用'}
        </Badge>
      ),
    },
    { label: '备注', span: 2, render: (p) => p.remark || '-' },
    {
      label: '创建时间',
      span: 3,
      render: (p) => new Date(p.createdAt).toLocaleDateString('zh-CN'),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="岗位管理"
        description="管理企业职位与岗位体系"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => refetch()} title="刷新">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <PermissionButton perm="system:post:add" onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              新增岗位
            </PermissionButton>
          </div>
        }
      />

      <div className="flex items-center gap-4">
        <Input
          placeholder="搜索岗位名称或编码..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <DataTable
        columns={columns}
        data={posts}
        isLoading={isLoading}
        emptyText="暂无岗位数据"
        actions={(p) => (
          <div className="flex items-center gap-2">
            <PermissionButton
              perm="system:post:edit"
              variant="ghost"
              size="sm"
              onClick={() => handleEdit(p)}
            >
              <Pencil className="mr-1 h-3.5 w-3.5" />
              编辑
            </PermissionButton>
            <PermissionButton
              perm="system:post:delete"
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(p.id)}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingPost ? '编辑岗位' : '新增岗位'}</DialogTitle>
              <DialogDescription>
                {editingPost ? '修改岗位信息。' : '填写岗位信息创建新职位。'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">岗位名称 *</Label>
                <Input
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="如：技术总监"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="code">岗位编码 *</Label>
                <Input
                  id="code"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="如：cto"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="sort">显示顺序</Label>
                  <Input
                    id="sort"
                    type="number"
                    value={formData.sort}
                    onChange={(e) =>
                      setFormData({ ...formData, sort: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="status">状态</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(val) =>
                      setFormData({ ...formData, status: val as CreatePostDtoStatus })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">正常</SelectItem>
                      <SelectItem value="INACTIVE">停用</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="remark">备注</Label>
                <Input
                  id="remark"
                  value={formData.remark}
                  onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                  placeholder="可选备注说明"
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
