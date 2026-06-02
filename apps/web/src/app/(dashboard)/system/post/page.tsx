'use client';

import { useState } from 'react';
import { useApiQuery, useApiMutation } from '@/hooks/use-api';
import { useDebounce } from '@/hooks/use-debounce';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
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
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { PermissionButton } from '@/components/common/permission-button';

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
  const [page, setPage] = useState(1);
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
    ['posts', String(page), debouncedSearch],
    `/api/system/post?page=${page}&pageSize=10${debouncedSearch ? `&search=${debouncedSearch}` : ''}`,
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

  const deleteMutation = useApiMutation('delete', '/api/system/post', {
    invalidateKeys: [['posts']],
    onSuccess: () => toast.success('删除成功'),
    onError: (error) => toast.error('删除失败', { description: error.message }),
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

  const handleDelete = (id: string) => {
    if (confirm('确定要删除吗？')) {
      import('@/lib/api-client').then((m) =>
        m.del(`/api/system/post/${id}`).then(() => {
          toast.success('删除成功');
          refetch();
        }).catch((err) => toast.error('删除失败', { description: err.message }))
      );
    }
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">岗位管理</h1>
          <p className="text-muted-foreground">管理系统岗位信息</p>
        </div>
        <PermissionButton perm="system:post:add" onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          新增岗位
        </PermissionButton>
      </div>

      <div className="flex gap-4">
        <Input
          placeholder="搜索岗位名称/编码"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-sm"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="border-b px-4 py-3 font-medium">
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-2">岗位名称</div>
              <div className="col-span-2">岗位编码</div>
              <div className="col-span-2">排序</div>
              <div className="col-span-2">状态</div>
              <div className="col-span-4">操作</div>
            </div>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">加载中...</div>
          ) : posts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">暂无数据</div>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="border-b px-4 py-3 hover:bg-muted/50">
                <div className="grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-2">{post.name}</div>
                  <div className="col-span-2">{post.code}</div>
                  <div className="col-span-2">{post.sort}</div>
                  <div className="col-span-2">
                    <Badge variant={post.status === 'ACTIVE' ? 'default' : 'secondary'}>
                      {post.status === 'ACTIVE' ? '启用' : '停用'}
                    </Badge>
                  </div>
                  <div className="col-span-4 flex gap-2">
                    <PermissionButton perm="system:post:edit" variant="ghost" size="sm" onClick={() => handleEdit(post)}>
                      <Pencil className="h-4 w-4" />
                    </PermissionButton>
                    <PermissionButton perm="system:post:delete" variant="ghost" size="sm" onClick={() => handleDelete(post.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </PermissionButton>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            上一页
          </Button>
          <span className="flex items-center px-4">
            第 {page} / {pagination.totalPages} 页
          </span>
          <Button variant="outline" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>
            下一页
          </Button>
        </div>
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
    </div>
  );
}
