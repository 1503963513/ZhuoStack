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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { fileUrl } from '@/lib/utils';
import { PermissionButton } from '@/components/common/permission-button';
import { PageHeader } from '@/components/common/page-header';
import { DataTable, type Column } from '@/components/common/data-table';
import { Pagination } from '@/components/common/pagination';
import { FileUpload } from '@/components/common/file-upload';
import {
  userControllerFindAll,
  userControllerFindOne,
  userControllerCreate,
  userControllerUpdate,
  userControllerRemove,
} from '@/api/generated/endpoints/user/user';
import { deptControllerFindAll } from '@/api/generated/endpoints/系统-部门管理/系统-部门管理';
import type { UserItemDto } from '@/api/generated/models';

type RoleType = 'USER' | 'ADMIN';

export default function UserPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItemDto | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'USER' as RoleType,
    deptId: '',
    postIds: [] as string[],
    roleIds: [] as string[],
    avatar: '',
  });

  const { confirm, ConfirmDialog } = useConfirm();

  // 1. 获取分页用户列表
  const {
    data: userResponse,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['users', page, pageSize, debouncedSearch],
    queryFn: () =>
      userControllerFindAll({
        page,
        pageSize,
        search: debouncedSearch || undefined,
      }),
  });

  // 2. 获取部门列表（用于下拉）
  const { data: deptResponse } = useQuery({
    queryKey: ['depts-simple'],
    queryFn: () => deptControllerFindAll(),
  });

  const depts = deptResponse?.data || [];
  const users = userResponse?.data?.data || [];
  const pagination = userResponse?.data?.pagination || {
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 0,
  };

  // 3. 创建与修改 Mutation
  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      userControllerCreate({
        name: data.name || data.email.split('@')[0],
        email: data.email,
        password: data.password,
        avatar: data.avatar || undefined,
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
      if (!editingUser) throw new Error('未选择编辑用户');
      return userControllerUpdate(editingUser.id, {
        name: data.name || undefined,
        email: data.email || undefined,
        password: data.password || undefined,
        role: data.role,
        deptId: data.deptId || undefined,
        postIds: data.postIds.length ? data.postIds : undefined,
        roleIds: data.roleIds.length ? data.roleIds : undefined,
        avatar: data.avatar || undefined,
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
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'USER',
      deptId: '',
      postIds: [],
      roleIds: [],
      avatar: '',
    });
    setEditingUser(null);
  };

  const handleCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleEdit = async (user: UserItemDto) => {
    setEditingUser(user);
    setFormData({
      name: user.name || '',
      email: user.email,
      password: '',
      role: (user.role as RoleType) || 'USER',
      deptId: '',
      postIds: [],
      roleIds: [],
      avatar: user.avatar || '',
    });
    setDialogOpen(true);

    try {
      const res = await userControllerFindOne(user.id);
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
      // 保持空值
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({ description: '确定要删除该用户吗？', variant: 'destructive' });
    if (!ok) return;
    try {
      await userControllerRemove(id);
      toast.success('删除成功');
      refetch();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '删除失败';
      toast.error('删除失败', { description: errorMsg });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const columns: Column<UserItemDto>[] = [
    {
      label: '用户名',
      span: 2,
      render: (u) => (
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarImage src={fileUrl(u.avatar)} alt={u.name || ''} />
            <AvatarFallback className="text-xs">
              {(u.name || u.email)[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium">{u.name || '-'}</span>
        </div>
      ),
    },
    { label: '邮箱', span: 3, key: 'email' },
    {
      label: '角色',
      span: 2,
      render: (u) => (
        <Badge variant={u.role === 'ADMIN' ? 'default' : 'secondary'}>
          {u.role === 'ADMIN' ? '管理员' : '普通用户'}
        </Badge>
      ),
    },
    {
      label: '创建时间',
      span: 3,
      render: (u) => new Date(u.createdAt).toLocaleDateString('zh-CN'),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="用户管理"
        description="管理系统用户、角色分配与个人信息"
        actions={
          <PermissionButton perm="system:user:add" onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            新增用户
          </PermissionButton>
        }
      />

      <div className="flex items-center gap-4">
        <Input
          placeholder="搜索用户名或邮箱..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Button variant="outline" size="icon" onClick={() => refetch()} title="刷新">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={users}
        isLoading={isLoading}
        emptyText="暂无用户数据"
        actions={(u) => (
          <div className="flex items-center gap-2">
            <PermissionButton
              perm="system:user:edit"
              variant="ghost"
              size="sm"
              onClick={() => handleEdit(u)}
            >
              <Pencil className="mr-1 h-3.5 w-3.5" />
              编辑
            </PermissionButton>
            <PermissionButton
              perm="system:user:delete"
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(u.id)}
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
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingUser ? '编辑用户' : '新增用户'}</DialogTitle>
              <DialogDescription>
                {editingUser ? '修改用户信息，密码留空表示不修改。' : '填写用户信息创建新账号。'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="avatar">头像</Label>
                <FileUpload
                  value={
                    formData.avatar
                      ? [{ id: '1', url: formData.avatar, originalName: 'avatar.png', fileSize: 0 }]
                      : []
                  }
                  onChange={(files) => setFormData({ ...formData, avatar: files[0]?.url || '' })}
                  mode="image"
                  maxCount={1}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="name">用户名</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="请输入用户名"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="email">邮箱 *</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="user@example.com"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password">密码 {editingUser ? '（留空不修改）' : '*'}</Label>
                <Input
                  id="password"
                  type="password"
                  required={!editingUser}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editingUser ? '••••••••' : '至少 6 位字符'}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="role">角色</Label>
                <Select
                  value={formData.role}
                  onValueChange={(val) => setFormData({ ...formData, role: val as RoleType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER">普通用户</SelectItem>
                    <SelectItem value="ADMIN">管理员</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="dept">所属部门</Label>
                <Select
                  value={formData.deptId}
                  onValueChange={(val) => setFormData({ ...formData, deptId: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择部门" />
                  </SelectTrigger>
                  <SelectContent>
                    {depts.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
