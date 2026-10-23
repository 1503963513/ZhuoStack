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
import {
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
  MousePointer,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PermissionButton } from '@/components/common/permission-button';
import { PageHeader } from '@/components/common/page-header';
import { DataTable, type Column } from '@/components/common/data-table';
import { Pagination } from '@/components/common/pagination';
import {
  roleControllerFindAll,
  roleControllerFindOne,
  roleControllerCreate,
  roleControllerUpdate,
  roleControllerRemove,
} from '@/api/generated/endpoints/系统-角色管理/系统-角色管理';
import { menuControllerFindTree } from '@/api/generated/endpoints/系统-菜单管理/系统-菜单管理';
import type { RoleItemDto, MenuTreeNodeDto, CreateRoleDtoStatus } from '@/api/generated/models';

const TYPE_ICON_MAP: Record<string, typeof Folder> = {
  DIRECTORY: Folder,
  MENU: FileText,
  BUTTON: MousePointer,
};

const TYPE_COLOR_MAP: Record<string, string> = {
  DIRECTORY: 'text-blue-500',
  MENU: 'text-green-500',
  BUTTON: 'text-orange-500',
};

export default function RolePage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleItemDto | null>(null);
  const [selectedMenuIds, setSelectedMenuIds] = useState<Set<string>>(new Set());
  const { confirm, ConfirmDialog } = useConfirm();
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    sort: 0,
    status: 'ACTIVE' as CreateRoleDtoStatus,
    remark: '',
  });

  // 1. 获取分页角色列表
  const {
    data: roleResponse,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['roles', page, pageSize, debouncedSearch],
    queryFn: () =>
      roleControllerFindAll({
        page,
        pageSize,
        search: debouncedSearch || undefined,
      }),
  });

  // 2. 获取菜单树（用于分配权限）
  const { data: menuTreeResponse } = useQuery({
    queryKey: ['menu-tree'],
    queryFn: () => menuControllerFindTree(),
  });

  const menuTree = menuTreeResponse?.data || [];
  const roles = roleResponse?.data?.data || [];
  const pagination = roleResponse?.data?.pagination || {
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 0,
  };

  // 3. 创建与修改角色
  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      roleControllerCreate({
        name: data.name,
        code: data.code,
        sort: data.sort,
        status: data.status,
        remark: data.remark || undefined,
        menuIds: Array.from(selectedMenuIds),
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
      if (!editingRole) throw new Error('未选择编辑角色');
      return roleControllerUpdate(editingRole.id, {
        name: data.name || undefined,
        code: data.code || undefined,
        sort: data.sort,
        status: data.status,
        remark: data.remark || undefined,
        menuIds: Array.from(selectedMenuIds),
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
    setSelectedMenuIds(new Set());
    setEditingRole(null);
  };

  const handleCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleEdit = async (role: RoleItemDto) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      code: role.code,
      sort: role.sort,
      status: role.status,
      remark: role.remark || '',
    });

    try {
      const res = await roleControllerFindOne(role.id);
      const menus = (res.data?.menus as { id: string }[]) || [];
      setSelectedMenuIds(new Set(menus.map((m) => m.id)));
    } catch {
      setSelectedMenuIds(new Set());
    }

    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({ description: '确定要删除该角色吗？', variant: 'destructive' });
    if (!ok) return;
    try {
      await roleControllerRemove(id);
      toast.success('删除成功');
      refetch();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '删除失败';
      toast.error('删除失败', { description: errorMsg });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRole) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const toggleMenu = (id: string) => {
    setSelectedMenuIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const allIds = new Set<string>();
    const collect = (nodes: MenuTreeNodeDto[]) => {
      for (const n of nodes) {
        allIds.add(n.id);
        if (n.children) collect(n.children);
      }
    };
    collect(menuTree);
    setSelectedMenuIds(allIds);
  };

  const deselectAll = () => {
    setSelectedMenuIds(new Set());
  };

  const columns: Column<RoleItemDto>[] = [
    { label: '角色名称', span: 2, key: 'name' },
    { label: '角色标识', span: 2, key: 'code' },
    { label: '排序', span: 1, key: 'sort' },
    {
      label: '状态',
      span: 2,
      render: (r) => (
        <Badge variant={r.status === 'ACTIVE' ? 'default' : 'secondary'}>
          {r.status === 'ACTIVE' ? '正常' : '停用'}
        </Badge>
      ),
    },
    { label: '备注', span: 2, render: (r) => r.remark || '-' },
    {
      label: '创建时间',
      span: 3,
      render: (r) => new Date(r.createdAt).toLocaleDateString('zh-CN'),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="角色管理"
        description="管理系统角色及其菜单权限分配"
        actions={
          <PermissionButton perm="system:role:add" onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            新增角色
          </PermissionButton>
        }
      />

      <div className="flex items-center gap-4">
        <Input
          placeholder="搜索角色名称或标识..."
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
        data={roles}
        isLoading={isLoading}
        emptyText="暂无角色数据"
        actions={(r) => (
          <div className="flex items-center gap-2">
            <PermissionButton
              perm="system:role:edit"
              variant="ghost"
              size="sm"
              onClick={() => handleEdit(r)}
            >
              <Pencil className="mr-1 h-3.5 w-3.5" />
              编辑
            </PermissionButton>
            <PermissionButton
              perm="system:role:delete"
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(r.id)}
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
        <DialogContent className="sm:max-w-[560px] max-h-[85vh] flex flex-col">
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <DialogHeader>
              <DialogTitle>{editingRole ? '编辑角色' : '新增角色'}</DialogTitle>
              <DialogDescription>
                {editingRole ? '修改角色信息及菜单权限。' : '填写角色信息并分配菜单权限。'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">角色名称 *</Label>
                  <Input
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="如：普通管理员"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="code">角色标识 *</Label>
                  <Input
                    id="code"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="如：admin / common"
                  />
                </div>
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
                      setFormData({ ...formData, status: val as CreateRoleDtoStatus })
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

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>菜单权限</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={selectAll}
                    >
                      全选
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={deselectAll}
                    >
                      全不选
                    </Button>
                  </div>
                </div>
                <div className="border rounded-md p-3 max-h-[220px] overflow-y-auto space-y-1 bg-muted/20">
                  {menuTree.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      暂无菜单数据
                    </div>
                  ) : (
                    menuTree.map((item) => (
                      <MenuTreeItem
                        key={item.id}
                        item={item}
                        selectedIds={selectedMenuIds}
                        onToggle={toggleMenu}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
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

function MenuTreeItem({
  item,
  selectedIds,
  onToggle,
  level = 0,
}: {
  item: MenuTreeNodeDto;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  level?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = item.children && item.children.length > 0;
  const isSelected = selectedIds.has(item.id);
  const Icon = TYPE_ICON_MAP[item.type] || FileText;
  const colorClass = TYPE_COLOR_MAP[item.type] || '';

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1.5 py-1 px-1.5 rounded text-sm hover:bg-muted/50 cursor-pointer select-none',
          isSelected && 'bg-primary/5 font-medium',
        )}
        style={{ paddingLeft: `${level * 18 + 6}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="p-0.5 hover:bg-muted rounded"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="w-4.5" />
        )}

        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggle(item.id)}
          className="rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
        />

        <Icon className={cn('h-3.5 w-3.5', colorClass)} />
        <span className="flex-1 text-xs" onClick={() => onToggle(item.id)}>
          {item.name}
        </span>
      </div>

      {hasChildren && expanded && (
        <div>
          {item.children!.map((child) => (
            <MenuTreeItem
              key={child.id}
              item={child}
              selectedIds={selectedIds}
              onToggle={onToggle}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
