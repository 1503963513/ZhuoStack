'use client';

import { useState, useMemo } from 'react';
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
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown, Folder, FileText, MousePointer } from 'lucide-react';
import { cn, buildUrl } from '@/lib/utils';
import { PermissionButton } from '@/components/common/permission-button';
import { PageHeader } from '@/components/common/page-header';
import { DataTable, type Column } from '@/components/common/data-table';
import { Pagination } from '@/components/common/pagination';

interface Role {
  id: string;
  name: string;
  code: string;
  sort: number;
  status: string;
  remark: string | null;
  menus?: MenuItem[];
}

interface MenuItem {
  id: string;
  name: string;
  parentId: string | null;
  type: string;
  children?: MenuItem[];
}

interface PaginatedResponse {
  data: Role[];
  pagination: { total: number; page: number; pageSize: number; totalPages: number };
}

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
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [selectedMenuIds, setSelectedMenuIds] = useState<Set<string>>(new Set());
  const { confirm, ConfirmDialog } = useConfirm();
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    sort: 0,
    status: 'ACTIVE',
    remark: '',
  });

  const { data, isLoading, refetch } = useApiQuery<PaginatedResponse>(
    ['roles', String(page), String(pageSize), debouncedSearch],
    buildUrl('/api/system/role', { page, pageSize, search: debouncedSearch || undefined }),
  );

  // 获取菜单树（用于权限选择）
  const { data: menuTreeData } = useApiQuery<MenuItem[]>(['menus'], '/api/system/menu/tree');
  const menuTree = menuTreeData?.data || [];

  const createMutation = useApiMutation('post', '/api/system/role', {
    onSuccess: () => {
      toast.success('创建成功');
      setDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => toast.error('创建失败', { description: error.message }),
  });

  const updateMutation = useApiMutation('put', `/api/system/role/${editingRole?.id || ''}`, {
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

  const handleEdit = async (role: Role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      code: role.code,
      sort: role.sort,
      status: role.status,
      remark: role.remark || '',
    });

    // 获取角色详情（含已分配的菜单）
    try {
      const { get } = await import('@/lib/api-client');
      const res = await get<Role>(`/api/system/role/${role.id}`);
      const menuIds = res.data?.menus?.map((m) => m.id) || [];
      setSelectedMenuIds(new Set(menuIds));
    } catch {
      setSelectedMenuIds(new Set());
    }

    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({ description: '确定要删除该角色吗？', variant: 'destructive' });
    if (!ok) return;
    import('@/lib/api-client').then((m) =>
      m.del(`/api/system/role/${id}`).then(() => {
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

    const payload = {
      ...formData,
      menuIds: Array.from(selectedMenuIds),
    };

    if (editingRole) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  // 切换菜单选中状态（含父子联动）
  const toggleMenu = (menuId: string, children?: MenuItem[]) => {
    setSelectedMenuIds((prev) => {
      const next = new Set(prev);
      const isSelected = next.has(menuId);

      if (isSelected) {
        // 取消选中：移除自己和所有子菜单
        next.delete(menuId);
        if (children) {
          removeChildrenRecursive(next, children);
        }
      } else {
        // 选中：添加自己和所有子菜单
        next.add(menuId);
        if (children) {
          addChildrenRecursive(next, children);
        }
      }

      return next;
    });
  };

  const addChildrenRecursive = (set: Set<string>, children: MenuItem[]) => {
    for (const child of children) {
      set.add(child.id);
      if (child.children) addChildrenRecursive(set, child.children);
    }
  };

  const removeChildrenRecursive = (set: Set<string>, children: MenuItem[]) => {
    for (const child of children) {
      set.delete(child.id);
      if (child.children) removeChildrenRecursive(set, child.children);
    }
  };

  // 全选/全不选
  const toggleAll = () => {
    if (selectedMenuIds.size > 0) {
      setSelectedMenuIds(new Set());
    } else {
      const allIds = new Set<string>();
      const collectIds = (menus: MenuItem[]) => {
        for (const m of menus) {
          allIds.add(m.id);
          if (m.children) collectIds(m.children);
        }
      };
      collectIds(menuTree);
      setSelectedMenuIds(allIds);
    }
  };

  const roles = data?.data?.data || [];
  const pagination = data?.data?.pagination;

  const columns: Column<Role>[] = [
    { label: '角色名称', key: 'name', span: 2 },
    { label: '角色标识', span: 2, render: (row) => <code className="rounded bg-muted px-2 py-0.5 text-xs">{row.code}</code> },
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
        title="角色管理"
        description="管理系统角色和菜单权限"
        actions={
          <PermissionButton perm="system:role:add" onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            新增角色
          </PermissionButton>
        }
      />

      <div className="flex gap-4">
        <Input
          placeholder="搜索角色名称/标识"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-sm"
        />
      </div>

      <DataTable
        columns={columns}
        data={roles}
        isLoading={isLoading}
        emptyText="暂无角色数据"
        actionsSpan={2}
        actions={(row) => (
          <>
            <PermissionButton perm="system:role:edit" variant="ghost" size="sm" onClick={() => handleEdit(row)} title="编辑 / 分配权限">
              <Pencil className="h-4 w-4" />
            </PermissionButton>
            <PermissionButton perm="system:role:delete" variant="ghost" size="sm" onClick={() => handleDelete(row.id)}>
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
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRole ? '编辑角色' : '新增角色'}</DialogTitle>
            <DialogDescription>填写角色信息并分配菜单权限</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>角色名称 *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="请输入角色名称"
                />
              </div>
              <div className="space-y-2">
                <Label>角色标识 *</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="请输入角色标识"
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
                  <SelectTrigger><SelectValue /></SelectTrigger>
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

            {/* 菜单权限树 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>菜单权限</Label>
                <Button variant="ghost" size="sm" onClick={toggleAll}>
                  {selectedMenuIds.size > 0 ? '全不选' : '全选'}
                </Button>
              </div>
              <div className="border rounded-md p-3 max-h-60 overflow-y-auto">
                {menuTree.length === 0 ? (
                  <p className="text-sm text-muted-foreground">暂无菜单数据</p>
                ) : (
                  menuTree.map((menu) => (
                    <MenuCheckboxNode
                      key={menu.id}
                      menu={menu}
                      level={0}
                      selectedIds={selectedMenuIds}
                      onToggle={toggleMenu}
                    />
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                已选择 {selectedMenuIds.size} 个菜单/权限
              </p>
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

/** 菜单复选框树节点 */
function MenuCheckboxNode({
  menu,
  level,
  selectedIds,
  onToggle,
}: {
  menu: MenuItem;
  level: number;
  selectedIds: Set<string>;
  onToggle: (id: string, children?: MenuItem[]) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = menu.children && menu.children.length > 0;
  const isChecked = selectedIds.has(menu.id);
  const Icon = TYPE_ICON_MAP[menu.type] || FileText;
  const colorClass = TYPE_COLOR_MAP[menu.type] || 'text-muted-foreground';

  // 半选状态：有子菜单被选中但不是全部
  const isIndeterminate = useMemo(() => {
    if (!hasChildren) return false;
    const allChildIds = getAllChildIds(menu);
    const selectedCount = allChildIds.filter((id) => selectedIds.has(id)).length;
    return selectedCount > 0 && selectedCount < allChildIds.length;
  }, [menu, selectedIds, hasChildren]);

  return (
    <div>
      <div
        className="flex items-center gap-1 py-1 px-1 rounded hover:bg-muted/50 cursor-pointer"
        style={{ paddingLeft: `${level * 20}px` }}
      >
        {hasChildren ? (
          <button onClick={() => setExpanded(!expanded)} className="p-0.5">
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <label className="flex items-center gap-2 cursor-pointer flex-1">
          <input
            type="checkbox"
            checked={isChecked}
            ref={(el) => { if (el) el.indeterminate = isIndeterminate; }}
            onChange={() => onToggle(menu.id, menu.children)}
            className="rounded"
          />
          <Icon className={cn('h-4 w-4', colorClass)} />
          <span className={cn('text-sm', menu.type === 'BUTTON' && 'text-muted-foreground')}>
            {menu.name}
          </span>
          {menu.type === 'BUTTON' && (
            <Badge variant="outline" className="text-xs">按钮</Badge>
          )}
        </label>
      </div>
      {expanded && hasChildren && menu.children!.map((child) => (
        <MenuCheckboxNode
          key={child.id}
          menu={child}
          level={level + 1}
          selectedIds={selectedIds}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}

/** 递归获取所有子菜单 ID */
function getAllChildIds(menu: MenuItem): string[] {
  const ids: string[] = [];
  if (menu.children) {
    for (const child of menu.children) {
      ids.push(child.id);
      ids.push(...getAllChildIds(child));
    }
  }
  return ids;
}
