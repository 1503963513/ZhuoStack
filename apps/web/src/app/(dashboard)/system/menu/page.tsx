'use client';

import { useState } from 'react';
import { useApiQuery, useApiMutation } from '@/hooks/use-api';
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
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown, Folder, FileText, MousePointer } from 'lucide-react';
import { IconPicker } from '@/components/common/icon-picker';
import { cn } from '@/lib/utils';

interface Menu {
  id: string;
  name: string;
  parentId: string | null;
  type: string;
  path: string | null;
  component: string | null;
  icon: string | null;
  sort: number;
  status: string;
  hidden: boolean;
  perms: string | null;
  remark: string | null;
  children?: Menu[];
}

const MENU_TYPE_MAP: Record<string, { label: string; icon: typeof Folder; color: string; rowBg: string }> = {
  DIRECTORY: { label: '目录', icon: Folder, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', rowBg: '' },
  MENU: { label: '菜单', icon: FileText, color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', rowBg: '' },
  BUTTON: { label: '按钮', icon: MousePointer, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', rowBg: 'bg-muted/30' },
};

/**
 * 将树形菜单扁平化为带缩进的选项列表
 */
function flattenMenus(menus: Menu[], level = 0): { id: string; label: string }[] {
  const result: { id: string; label: string }[] = [];
  for (const menu of menus) {
    const prefix = level > 0 ? '│  '.repeat(level - 1) + '├─ ' : '';
    result.push({ id: menu.id, label: prefix + menu.name });
    if (menu.children && menu.children.length > 0) {
      result.push(...flattenMenus(menu.children, level + 1));
    }
  }
  return result;
}

export default function MenuPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    parentId: '',
    type: 'MENU',
    path: '',
    component: '',
    icon: '',
    sort: 0,
    status: 'ACTIVE',
    hidden: false,
    perms: '',
    remark: '',
  });

  const { data, isLoading, refetch } = useApiQuery<Menu[]>(['menus'], '/api/system/menu/tree');

  const createMutation = useApiMutation('post', '/api/system/menu', {
    onSuccess: () => {
      toast.success('创建成功');
      setDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => toast.error('创建失败', { description: error.message }),
  });

  const updateMutation = useApiMutation('put', `/api/system/menu/${editingMenu?.id || ''}`, {
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
      name: '', parentId: '', type: 'MENU', path: '', component: '',
      icon: '', sort: 0, status: 'ACTIVE', hidden: false, perms: '', remark: '',
    });
    setEditingMenu(null);
  };

  const handleCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  /** 新增子菜单 */
  const handleCreateChild = (parentMenu: Menu) => {
    resetForm();
    setFormData((prev) => ({
      ...prev,
      parentId: parentMenu.id,
      type: 'MENU',
    }));
    setDialogOpen(true);
  };

  const handleEdit = (menu: Menu) => {
    setEditingMenu(menu);
    setFormData({
      name: menu.name,
      parentId: menu.parentId || '',
      type: menu.type,
      path: menu.path || '',
      component: menu.component || '',
      icon: menu.icon || '',
      sort: menu.sort,
      status: menu.status,
      hidden: menu.hidden ?? false,
      perms: menu.perms || '',
      remark: menu.remark || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('确定要删除吗？')) {
      import('@/lib/api-client').then((m) =>
        m.del(`/api/system/menu/${id}`).then(() => {
          toast.success('删除成功');
          refetch();
        }).catch((err) => toast.error('删除失败', { description: err.message }))
      );
    }
  };

  const handleSubmit = () => {
    if (!formData.name) {
      toast.error('请输入菜单名称');
      return;
    }

    const payload = {
      ...formData,
      parentId: formData.parentId || undefined,
      path: formData.path || undefined,
      component: formData.component || undefined,
      icon: formData.icon || undefined,
      perms: formData.perms || undefined,
    };

    if (editingMenu) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const menus = data?.data || [];
  const parentOptions = flattenMenus(menus);

  const renderTree = (items: Menu[], level = 0) => {
    return items.map((menu) => (
      <MenuRow
        key={menu.id}
        menu={menu}
        level={level}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onCreateChild={handleCreateChild}
      />
    ));
  };

  // 当前正在编辑的菜单不能作为自己的父菜单
  const filteredParentOptions = parentOptions.filter((opt) => opt.id !== editingMenu?.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">菜单管理</h1>
          <p className="text-muted-foreground">管理系统菜单和权限</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          新增菜单
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="border-b px-4 py-3 font-medium">
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-3">菜单名称</div>
              <div className="col-span-1">类型</div>
              <div className="col-span-2">路由路径</div>
              <div className="col-span-2">权限标识</div>
              <div className="col-span-1">排序</div>
              <div className="col-span-1">状态</div>
              <div className="col-span-2">操作</div>
            </div>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">加载中...</div>
          ) : menus.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">暂无数据</div>
          ) : (
            renderTree(menus)
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingMenu ? '编辑菜单' : '新增菜单'}</DialogTitle>
            <DialogDescription>请填写菜单信息</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>父菜单</Label>
              <Select
                value={formData.parentId || 'none'}
                onValueChange={(v) => setFormData({ ...formData, parentId: v === 'none' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="无（顶级菜单）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">无（顶级菜单）</SelectItem>
                  {filteredParentOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>菜单名称 *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="请输入菜单名称"
                />
              </div>
              <div className="space-y-2">
                <Label>菜单类型 *</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DIRECTORY">目录</SelectItem>
                    <SelectItem value="MENU">菜单</SelectItem>
                    <SelectItem value="BUTTON">按钮</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>路由路径</Label>
                <Input
                  value={formData.path}
                  onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                  placeholder="例如: /system/user"
                />
              </div>
              <div className="space-y-2">
                <Label>组件路径</Label>
                <Input
                  value={formData.component}
                  onChange={(e) => setFormData({ ...formData, component: e.target.value })}
                  placeholder="例如: system/user/index"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>图标</Label>
                <IconPicker
                  value={formData.icon}
                  onChange={(v) => setFormData({ ...formData, icon: v })}
                />
              </div>
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
              <div className="space-y-2">
                <Label>隐藏菜单</Label>
                <Select value={formData.hidden ? 'true' : 'false'} onValueChange={(v) => setFormData({ ...formData, hidden: v === 'true' })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">显示</SelectItem>
                    <SelectItem value="true">隐藏（不显示在侧边栏）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>权限标识</Label>
              <Input
                value={formData.perms}
                onChange={(e) => setFormData({ ...formData, perms: e.target.value })}
                placeholder="例如: system:user:list"
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

function MenuRow({
  menu,
  level,
  onEdit,
  onDelete,
  onCreateChild,
}: {
  menu: Menu;
  level: number;
  onEdit: (menu: Menu) => void;
  onDelete: (id: string) => void;
  onCreateChild: (menu: Menu) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = menu.children && menu.children.length > 0;
  const typeInfo = MENU_TYPE_MAP[menu.type] || MENU_TYPE_MAP.MENU;
  const Icon = typeInfo.icon;

  return (
    <>
      <div className={cn('border-b px-4 py-3 hover:bg-muted/50', typeInfo.rowBg)}>
        <div className="grid grid-cols-12 gap-4 items-center">
          <div className="col-span-3 flex items-center" style={{ paddingLeft: `${level * 20}px` }}>
            {hasChildren ? (
              <button onClick={() => setExpanded(!expanded)} className="mr-1">
                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            ) : (
              <span className="mr-5" />
            )}
            <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
            {menu.name}
          </div>
          <div className="col-span-1">
            <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', typeInfo.color)}>
              {typeInfo.label}
            </span>
          </div>
          <div className="col-span-2 text-sm text-muted-foreground">{menu.path || '-'}</div>
          <div className="col-span-2 text-sm text-muted-foreground">{menu.perms || '-'}</div>
          <div className="col-span-1">{menu.sort}</div>
          <div className="col-span-1">
            <Badge variant={menu.status === 'ACTIVE' ? 'default' : 'secondary'}>
              {menu.status === 'ACTIVE' ? '启用' : '停用'}
            </Badge>
            {menu.hidden && (
              <Badge variant="outline" className="ml-1">隐藏</Badge>
            )}
          </div>
          <div className="col-span-2 flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => onCreateChild(menu)} title="新增子菜单">
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onEdit(menu)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(menu.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </div>
      {expanded && hasChildren && menu.children!.map((child) => (
        <MenuRow key={child.id} menu={child} level={level + 1} onEdit={onEdit} onDelete={onDelete} onCreateChild={onCreateChild} />
      ))}
    </>
  );
}
