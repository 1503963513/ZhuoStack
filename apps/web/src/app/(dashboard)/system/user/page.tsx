'use client';

import { useState } from 'react';
import { useApiQuery, useApiMutation } from '@/hooks/use-api';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { buildUrl } from '@/lib/utils';
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { PermissionButton } from '@/components/common/permission-button';
import { PageHeader } from '@/components/common/page-header';
import { DataTable, type Column } from '@/components/common/data-table';
import { Pagination } from '@/components/common/pagination';
import { FileUpload } from '@/components/common/file-upload';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  avatar: string | null;
  createdAt: string;
}

interface PaginatedResponse {
  data: User[];
  pagination: { total: number; page: number; pageSize: number; totalPages: number };
}

interface Dept { id: string; name: string; }
interface Post { id: string; name: string; code: string; }
interface Role { id: string; name: string; code: string; }

export default function UserPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'USER',
    deptId: '',
    postIds: [] as string[],
    roleIds: [] as string[],
    avatar: '',
  });

  const { confirm, ConfirmDialog } = useConfirm();

  const { data, isLoading, refetch } = useApiQuery<PaginatedResponse>(
    ['users', String(page), String(pageSize), debouncedSearch],
    buildUrl('/api/user', { page, pageSize, search: debouncedSearch || undefined }),
  );

  const { data: depts } = useApiQuery<Dept[]>(['dept-list'], '/api/system/dept');
  const { data: posts } = useApiQuery<{ data: Post[] }>(['post-list'], '/api/system/post?page=1&pageSize=100');
  const { data: roles } = useApiQuery<{ data: Role[] }>(['role-list'], '/api/system/role?page=1&pageSize=100');

  const createMutation = useApiMutation('post', '/api/user', {
    onSuccess: () => {
      toast.success('创建成功');
      setDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => toast.error('创建失败', { description: error.message }),
  });

  const updateMutation = useApiMutation('put', `/api/user/${editingUser?.id || ''}`, {
    onSuccess: () => {
      toast.success('更新成功');
      setDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => toast.error('更新失败', { description: error.message }),
  });

  const resetForm = () => {
    setFormData({ name: '', email: '', password: '', role: 'USER', deptId: '', postIds: [], roleIds: [], avatar: '' });
    setEditingUser(null);
  };

  const handleCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleEdit = async (user: User) => {
    setEditingUser(user);
    // 先设置基本信息
    setFormData({
      name: user.name || '',
      email: user.email,
      password: '',
      role: user.role,
      deptId: '',
      postIds: [],
      roleIds: [],
      avatar: user.avatar || '',
    });
    setDialogOpen(true);

    // 获取用户详情（含部门、岗位、角色）
    try {
      const { get } = await import('@/lib/api-client');
      const res = await get<User & { dept?: { id: string }; posts?: { id: string }[]; roles?: { id: string }[] }>(`/api/user/${user.id}`);
      const detail = res.data;
      if (detail) {
        setFormData((prev) => ({
          ...prev,
          deptId: detail.dept?.id || '',
          postIds: detail.posts?.map((p) => p.id) || [],
          roleIds: detail.roles?.map((r) => r.id) || [],
        }));
      }
    } catch {
      // 获取详情失败，保持空值
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({ description: '确定要删除该用户吗？', variant: 'destructive' });
    if (!ok) return;
    import('@/lib/api-client').then((m) =>
      m.del(`/api/user/${id}`).then(() => {
        toast.success('删除成功');
        refetch();
      }).catch((err) => toast.error('删除失败', { description: err.message }))
    );
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.email) {
      toast.error('请填写必填项');
      return;
    }
    if (!editingUser && !formData.password) {
      toast.error('请输入密码');
      return;
    }

    const payload: any = { ...formData };
    if (editingUser && !payload.password) delete payload.password;

    if (editingUser) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const users = data?.data?.data || [];
  const pagination = data?.data?.pagination;
  const deptList = depts?.data || [];
  const postList = posts?.data?.data || [];
  const roleList = roles?.data?.data || [];

  const columns: Column<User>[] = [
    { label: '用户名', key: 'name', span: 2, render: (row) => <span className="font-medium">{row.name || '-'}</span> },
    { label: '邮箱', key: 'email', span: 3 },
    {
      label: '角色', span: 2,
      render: (row) => (
        <Badge variant={row.role === 'ADMIN' ? 'default' : 'secondary'}>
          {row.role === 'ADMIN' ? '管理员' : '普通用户'}
        </Badge>
      ),
    },
    {
      label: '创建时间', span: 2,
      render: (row) => <span className="text-muted-foreground">{new Date(row.createdAt).toLocaleDateString('zh-CN')}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="用户管理"
        description="管理系统用户"
        actions={
          <>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              刷新
            </Button>
            <PermissionButton perm="system:user:add" onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              新增用户
            </PermissionButton>
          </>
        }
      />

      <div className="flex gap-4">
        <Input
          placeholder="搜索用户名/邮箱"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-sm"
        />
      </div>

      <DataTable
        columns={columns}
        data={users}
        isLoading={isLoading}
        emptyText="暂无用户数据"
        actionsSpan={3}
        actions={(row) => (
          <>
            <PermissionButton perm="system:user:edit" variant="ghost" size="sm" onClick={() => handleEdit(row)}>
              <Pencil className="h-4 w-4" />
            </PermissionButton>
            <PermissionButton perm="system:user:delete" variant="ghost" size="sm" onClick={() => handleDelete(row.id)}>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingUser ? '编辑用户' : '新增用户'}</DialogTitle>
            <DialogDescription>请填写用户信息</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>用户名 *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="请输入用户名"
                />
              </div>
              <div className="space-y-2">
                <Label>邮箱 *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="请输入邮箱"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{editingUser ? '密码（留空不修改）' : '密码 *'}</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="请输入密码"
                />
              </div>
              <div className="space-y-2">
                <Label>角色</Label>
                <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER">普通用户</SelectItem>
                    <SelectItem value="ADMIN">管理员</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>部门</Label>
              <Select value={formData.deptId || 'none'} onValueChange={(v) => setFormData({ ...formData, deptId: v === 'none' ? '' : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择部门" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">无</SelectItem>
                  {deptList.map((dept: any) => (
                    <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>头像</Label>
              <FileUpload
                mode="image"
                maxCount={1}
                value={formData.avatar ? [{ id: 'avatar', url: formData.avatar, originalName: '头像', fileSize: 0 }] : []}
                onChange={(files) => setFormData({ ...formData, avatar: files[0]?.url || '' })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
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
