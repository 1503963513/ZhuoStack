'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
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
import {
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  Folder,
  FileText,
  MousePointer,
  RefreshCw,
  Eye,
  EyeOff,
} from 'lucide-react';
import { IconPicker } from '@/components/common/icon-picker';
import { cn } from '@/lib/utils';
import { PermissionButton } from '@/components/common/permission-button';
import { PageHeader } from '@/components/common/page-header';
import { useConfirm } from '@/hooks/use-confirm';
import {
  menuControllerFindTree,
  menuControllerCreate,
  menuControllerUpdate,
  menuControllerRemove,
} from '@/api/generated/endpoints/系统-菜单管理/系统-菜单管理';
import type {
  MenuTreeNodeDto,
  CreateMenuDtoType,
  CreateMenuDtoStatus,
} from '@/api/generated/models';

const MENU_TYPE_MAP: Record<
  string,
  { label: string; icon: typeof Folder; color: string; rowBg: string }
> = {
  DIRECTORY: {
    label: '目录',
    icon: Folder,
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    rowBg: '',
  },
  MENU: {
    label: '菜单',
    icon: FileText,
    color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    rowBg: '',
  },
  BUTTON: {
    label: '按钮',
    icon: MousePointer,
    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
    rowBg: 'bg-muted/30',
  },
};

/**
 * 递归收集指定节点及其所有子孙节点的 ID
 */
function getDescendantIds(node: MenuTreeNodeDto): Set<string> {
  const ids = new Set<string>();
  const collect = (item: MenuTreeNodeDto) => {
    ids.add(item.id);
    if (item.children) {
      item.children.forEach(collect);
    }
  };
  collect(node);
  return ids;
}

/**
 * 查找指定 ID 的菜单节点
 */
function findNodeById(list: MenuTreeNodeDto[], targetId: string): MenuTreeNodeDto | undefined {
  for (const item of list) {
    if (item.id === targetId) return item;
    if (item.children) {
      const found = findNodeById(item.children, targetId);
      if (found) return found;
    }
  }
}

/**
 * 将树形菜单扁平化为上级菜单选项列表：
 * 1. 严格排除 BUTTON 按钮类型（按钮不能作为上级）
 * 2. 排除正在编辑的当前节点及其所有子孙节点（防止循环引用）
 */
function getParentMenuOptions(
  menus: MenuTreeNodeDto[],
  editingMenuId?: string,
  level = 0,
  excludeIds?: Set<string>,
): { id: string; label: string; type: string }[] {
  let actualExcludeIds = excludeIds;
  if (!actualExcludeIds && editingMenuId) {
    const editingNode = findNodeById(menus, editingMenuId);
    actualExcludeIds = editingNode ? getDescendantIds(editingNode) : new Set([editingMenuId]);
  }

  const result: { id: string; label: string; type: string }[] = [];
  for (const menu of menus) {
    // 排除被禁用的自身/子孙节点，且按钮不可作为任何项的上级
    if (actualExcludeIds?.has(menu.id)) continue;
    if (menu.type === 'BUTTON') continue;

    const prefix = level > 0 ? '│  '.repeat(level - 1) + '├─ ' : '';
    const typeLabel = menu.type === 'DIRECTORY' ? '[目录] ' : '[菜单] ';
    result.push({
      id: menu.id,
      label: prefix + typeLabel + menu.name,
      type: menu.type,
    });

    if (menu.children && menu.children.length > 0) {
      result.push(
        ...getParentMenuOptions(menu.children, editingMenuId, level + 1, actualExcludeIds),
      );
    }
  }
  return result;
}

export default function MenuPage() {
  const { confirm, ConfirmDialog } = useConfirm();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<MenuTreeNodeDto | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    parentId: '',
    type: 'MENU' as CreateMenuDtoType,
    path: '',
    component: '',
    icon: '',
    sort: 0,
    status: 'ACTIVE' as CreateMenuDtoStatus,
    hidden: false,
    perms: '',
    remark: '',
  });

  const {
    data: response,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['menus-tree'],
    queryFn: () => menuControllerFindTree(),
  });

  const menus = useMemo(() => response?.data || [], [response]);

  // ========== 展开 / 收起状态控制（默认全部展开，记录被手动收起的节点） ==========
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  // 收集所有拥有子节点的菜单 ID
  const allParentIds = useMemo(() => {
    const ids = new Set<string>();
    const collect = (items: MenuTreeNodeDto[]) => {
      for (const item of items) {
        if (item.children && item.children.length > 0) {
          ids.add(item.id);
          collect(item.children);
        }
      }
    };
    collect(menus);
    return ids;
  }, [menus]);

  // 是否当前为全部展开状态（没有被收起的节点）
  const isAllExpanded = useMemo(() => {
    return allParentIds.size > 0 && collapsedIds.size === 0;
  }, [allParentIds, collapsedIds]);

  // 一键切换全部展开 / 全部收起
  const toggleExpandAll = () => {
    if (isAllExpanded) {
      // 全部收起：将所有父节点加入收起集合
      setCollapsedIds(new Set(allParentIds));
    } else {
      // 全部展开：清空收起集合
      setCollapsedIds(new Set());
    }
  };

  // 单个节点切换展开 / 收起
  const toggleExpand = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ========== 创建与更新 Mutation ==========
  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      menuControllerCreate({
        name: data.name,
        parentId: data.parentId || undefined,
        type: data.type,
        path: data.path || undefined,
        component: data.component || undefined,
        icon: data.icon || undefined,
        sort: data.sort,
        status: data.status,
        hidden: data.hidden,
        perms: data.perms || undefined,
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
      if (!editingMenu) throw new Error('未选择编辑菜单');
      return menuControllerUpdate(editingMenu.id, {
        name: data.name,
        parentId: data.parentId || undefined,
        type: data.type,
        path: data.path || undefined,
        component: data.component || undefined,
        icon: data.icon || undefined,
        sort: data.sort,
        status: data.status,
        hidden: data.hidden,
        perms: data.perms || undefined,
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
    setFormData({
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
    setEditingMenu(null);
  };

  const handleCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleCreateChild = (parentMenu: MenuTreeNodeDto) => {
    resetForm();
    // 默认类型：若父级为目录，新增项默认为菜单；若父级为菜单，新增项默认为按钮
    const defaultType: CreateMenuDtoType = parentMenu.type === 'DIRECTORY' ? 'MENU' : 'BUTTON';
    setFormData((prev) => ({
      ...prev,
      parentId: parentMenu.id,
      type: defaultType,
    }));
    // 确保父节点处于展开状态（从收起集合中移除）
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      next.delete(parentMenu.id);
      return next;
    });
    setDialogOpen(true);
  };

  const handleEdit = (menu: MenuTreeNodeDto) => {
    setEditingMenu(menu);
    setFormData({
      name: menu.name,
      parentId: menu.parentId || '',
      type: (menu.type as CreateMenuDtoType) || 'MENU',
      path: menu.path || '',
      component: menu.component || '',
      icon: menu.icon || '',
      sort: menu.sort,
      status: (menu.status as CreateMenuDtoStatus) || 'ACTIVE',
      hidden: menu.hidden ?? false,
      perms: (menu as unknown as { perms?: string }).perms || '',
      remark: (menu as unknown as { remark?: string }).remark || '',
    });
    setDialogOpen(true);
  };

  /** 快捷就地切换显示/隐藏状态 */
  const handleToggleHidden = async (menu: MenuTreeNodeDto) => {
    const nextHidden = !menu.hidden;
    try {
      await menuControllerUpdate(menu.id, { hidden: nextHidden });
      toast.success(nextHidden ? `已隐藏「${menu.name}」` : `已显示「${menu.name}」`);
      refetch();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '切换失败';
      toast.error('切换失败', { description: errorMsg });
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({ description: '确定要删除该菜单吗？', variant: 'destructive' });
    if (!ok) return;
    try {
      await menuControllerRemove(id);
      toast.success('删除成功');
      refetch();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '删除失败';
      toast.error('删除失败', { description: errorMsg });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingMenu) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  // 获取严格合法的上级菜单选项（只包含目录和菜单，排除按钮与自身子树）
  const parentMenuOptions = useMemo(() => {
    return getParentMenuOptions(menus, editingMenu?.id);
  }, [menus, editingMenu?.id]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="菜单管理"
        description="管理系统的导航目录、菜单页面与操作按钮"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleExpandAll}
              title={isAllExpanded ? '一键折叠全部菜单' : '一键展开全部菜单'}
            >
              <ChevronsUpDown className="mr-1.5 h-3.5 w-3.5" />
              {isAllExpanded ? '全部折叠' : '全部展开'}
            </Button>
            <Button variant="outline" size="icon" onClick={() => refetch()} title="刷新">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <PermissionButton perm="system:menu:add" onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              新增菜单
            </PermissionButton>
          </div>
        }
      />

      <Card>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="flex justify-center py-8 text-muted-foreground">加载中...</div>
          ) : menus.length === 0 ? (
            <div className="flex justify-center py-8 text-muted-foreground">暂无菜单数据</div>
          ) : (
            <div className="space-y-1">
              {menus.map((menu) => (
                <MenuTreeItem
                  key={menu.id}
                  menu={menu}
                  collapsedIds={collapsedIds}
                  onToggleExpand={toggleExpand}
                  onToggleHidden={handleToggleHidden}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onAddChild={handleCreateChild}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingMenu ? '编辑菜单' : '新增菜单'}</DialogTitle>
              <DialogDescription>
                {editingMenu ? '修改菜单信息。' : '创建新的菜单或权限节点。'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-1.5">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="type">菜单类型</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(val) =>
                      setFormData({ ...formData, type: val as CreateMenuDtoType })
                    }
                  >
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

                <div className="grid gap-2">
                  <Label htmlFor="parentId">上级菜单</Label>
                  <Select
                    value={formData.parentId || 'root'}
                    onValueChange={(val) =>
                      setFormData({ ...formData, parentId: val === 'root' ? '' : val })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="顶级菜单（无上级）" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="root">顶级菜单（无上级）</SelectItem>
                      {parentMenuOptions.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="name">菜单名称 *</Label>
                <Input
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="如：用户管理"
                />
              </div>

              {formData.type !== 'BUTTON' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="path">路由地址</Label>
                      <Input
                        id="path"
                        value={formData.path}
                        onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                        placeholder="/system/user"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="icon">图标</Label>
                      <IconPicker
                        value={formData.icon}
                        onChange={(name) => setFormData({ ...formData, icon: name })}
                      />
                    </div>
                  </div>

                  {formData.type === 'MENU' && (
                    <div className="grid gap-2">
                      <Label htmlFor="component">组件路径</Label>
                      <Input
                        id="component"
                        value={formData.component}
                        onChange={(e) => setFormData({ ...formData, component: e.target.value })}
                        placeholder="system/user/page"
                      />
                    </div>
                  )}
                </>
              )}

              {formData.type === 'BUTTON' && (
                <div className="grid gap-2">
                  <Label htmlFor="perms">权限标识</Label>
                  <Input
                    id="perms"
                    value={formData.perms}
                    onChange={(e) => setFormData({ ...formData, perms: e.target.value })}
                    placeholder="如：system:user:add"
                  />
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
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
                      setFormData({ ...formData, status: val as CreateMenuDtoStatus })
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

                <div className="grid gap-2">
                  <Label htmlFor="hidden">显示状态</Label>
                  <Select
                    value={formData.hidden ? 'true' : 'false'}
                    onValueChange={(val) => setFormData({ ...formData, hidden: val === 'true' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="false">显示</SelectItem>
                      <SelectItem value="true">隐藏</SelectItem>
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

function MenuTreeItem({
  menu,
  collapsedIds,
  onToggleExpand,
  onToggleHidden,
  onEdit,
  onDelete,
  onAddChild,
  level = 0,
}: {
  menu: MenuTreeNodeDto;
  collapsedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onToggleHidden: (menu: MenuTreeNodeDto) => void;
  onEdit: (menu: MenuTreeNodeDto) => void;
  onDelete: (id: string) => void;
  onAddChild: (menu: MenuTreeNodeDto) => void;
  level?: number;
}) {
  const hasChildren = menu.children && menu.children.length > 0;
  const isExpanded = !collapsedIds.has(menu.id);
  const typeConfig = MENU_TYPE_MAP[menu.type] || MENU_TYPE_MAP.MENU;
  const TypeIcon = typeConfig.icon;

  return (
    <div>
      <div
        className={cn(
          'flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 border border-transparent hover:border-border transition-colors',
          typeConfig.rowBg,
        )}
        style={{ paddingLeft: `${level * 24 + 12}px` }}
      >
        <div className="flex items-center gap-2">
          {hasChildren ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 p-0"
              onClick={() => onToggleExpand(menu.id)}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          ) : (
            <span className="w-6" />
          )}

          <TypeIcon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">{menu.name}</span>

          <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', typeConfig.color)}>
            {typeConfig.label}
          </span>

          <Badge variant={menu.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-xs">
            {menu.status === 'ACTIVE' ? '正常' : '停用'}
          </Badge>

          {menu.type !== 'BUTTON' && (
            <Badge
              variant={menu.hidden ? 'outline' : 'secondary'}
              className={cn(
                'text-xs cursor-pointer select-none transition-colors gap-1',
                menu.hidden
                  ? 'border-dashed text-muted-foreground hover:bg-muted'
                  : 'text-foreground hover:bg-secondary/80',
              )}
              onClick={() => onToggleHidden(menu)}
              title="点击切换显示/隐藏状态"
            >
              {menu.hidden ? (
                <>
                  <EyeOff className="h-3 w-3 text-muted-foreground" />
                  隐藏
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3 text-primary" />
                  显示
                </>
              )}
            </Badge>
          )}

          {menu.path && (
            <span className="text-xs text-muted-foreground font-mono">{menu.path}</span>
          )}

          {(menu as unknown as { perms?: string }).perms && (
            <Badge variant="outline" className="text-xs font-mono">
              {(menu as unknown as { perms: string }).perms}
            </Badge>
          )}

          <span className="text-xs text-muted-foreground">排序: {menu.sort}</span>
        </div>

        <div className="flex items-center gap-1">
          {menu.type !== 'BUTTON' && (
            <PermissionButton
              perm="system:menu:add"
              variant="ghost"
              size="sm"
              onClick={() => onAddChild(menu)}
              title="新增子项"
            >
              <Plus className="h-3.5 w-3.5" />
            </PermissionButton>
          )}
          <PermissionButton
            perm="system:menu:edit"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(menu)}
            title="编辑"
          >
            <Pencil className="h-3.5 w-3.5" />
          </PermissionButton>
          <PermissionButton
            perm="system:menu:delete"
            variant="ghost"
            size="sm"
            onClick={() => onDelete(menu.id)}
            title="删除"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </PermissionButton>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="space-y-1 mt-1">
          {menu.children!.map((child) => (
            <MenuTreeItem
              key={child.id}
              menu={child}
              collapsedIds={collapsedIds}
              onToggleExpand={onToggleExpand}
              onToggleHidden={onToggleHidden}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
