'use client';

import { useState } from 'react';
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
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown, RefreshCw } from 'lucide-react';
import { PermissionButton } from '@/components/common/permission-button';
import { PageHeader } from '@/components/common/page-header';
import { useConfirm } from '@/hooks/use-confirm';
import {
  deptControllerFindTree,
  deptControllerCreate,
  deptControllerUpdate,
  deptControllerRemove,
} from '@/api/generated/endpoints/系统-部门管理/系统-部门管理';
import type { DeptTreeNodeDto, CreateDeptDtoStatus } from '@/api/generated/models';

/**
 * 将树形部门扁平化为带缩进的选项列表
 */
function flattenDepts(depts: DeptTreeNodeDto[], level = 0): { id: string; label: string }[] {
  const result: { id: string; label: string }[] = [];
  for (const dept of depts) {
    const prefix = level > 0 ? '│  '.repeat(level - 1) + '├─ ' : '';
    result.push({ id: dept.id, label: prefix + dept.name });
    if (dept.children && dept.children.length > 0) {
      result.push(...flattenDepts(dept.children, level + 1));
    }
  }
  return result;
}

export default function DeptPage() {
  const { confirm, ConfirmDialog } = useConfirm();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DeptTreeNodeDto | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    parentId: '',
    sort: 0,
    status: 'ACTIVE' as CreateDeptDtoStatus,
    remark: '',
  });

  const {
    data: response,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['depts-tree'],
    queryFn: () => deptControllerFindTree(),
  });

  const depts = response?.data || [];

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      deptControllerCreate({
        name: data.name,
        parentId: data.parentId || undefined,
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
      if (!editingDept) throw new Error('未选择编辑部门');
      return deptControllerUpdate(editingDept.id, {
        name: data.name,
        parentId: data.parentId || undefined,
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
    setFormData({ name: '', parentId: '', sort: 0, status: 'ACTIVE', remark: '' });
    setEditingDept(null);
  };

  const handleCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleCreateChild = (parentDept: DeptTreeNodeDto) => {
    resetForm();
    setFormData((prev) => ({ ...prev, parentId: parentDept.id }));
    setDialogOpen(true);
  };

  const handleEdit = (dept: DeptTreeNodeDto) => {
    setEditingDept(dept);
    setFormData({
      name: dept.name,
      parentId: dept.parentId || '',
      sort: dept.sort,
      status: dept.status,
      remark: dept.remark || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({ description: '确定要删除该部门吗？', variant: 'destructive' });
    if (!ok) return;
    try {
      await deptControllerRemove(id);
      toast.success('删除成功');
      refetch();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '删除失败';
      toast.error('删除失败', { description: errorMsg });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingDept) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const deptOptions = flattenDepts(depts);

  return (
    <div className="space-y-6">
      <PageHeader
        title="部门管理"
        description="管理企业组织架构与层级关系"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => refetch()} title="刷新">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <PermissionButton perm="system:dept:add" onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              新增部门
            </PermissionButton>
          </div>
        }
      />

      <Card>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="flex justify-center py-8 text-muted-foreground">加载中...</div>
          ) : depts.length === 0 ? (
            <div className="flex justify-center py-8 text-muted-foreground">暂无部门数据</div>
          ) : (
            <div className="space-y-2">
              {depts.map((dept) => (
                <DeptTreeItem
                  key={dept.id}
                  dept={dept}
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
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingDept ? '编辑部门' : '新增部门'}</DialogTitle>
              <DialogDescription>
                {editingDept ? '修改部门信息' : '创建新的部门节点'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">部门名称 *</Label>
                <Input
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="如：技术部"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="parentId">上级部门</Label>
                <Select
                  value={formData.parentId || 'root'}
                  onValueChange={(val) =>
                    setFormData({ ...formData, parentId: val === 'root' ? '' : val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="顶级部门" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="root">顶级部门（无上级）</SelectItem>
                    {deptOptions
                      .filter((d) => d.id !== editingDept?.id)
                      .map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
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
                      setFormData({ ...formData, status: val as CreateDeptDtoStatus })
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

function DeptTreeItem({
  dept,
  onEdit,
  onDelete,
  onAddChild,
  level = 0,
}: {
  dept: DeptTreeNodeDto;
  onEdit: (dept: DeptTreeNodeDto) => void;
  onDelete: (id: string) => void;
  onAddChild: (dept: DeptTreeNodeDto) => void;
  level?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = dept.children && dept.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 border border-transparent hover:border-border transition-colors"
        style={{ paddingLeft: `${level * 24 + 12}px` }}
      >
        <div className="flex items-center gap-2">
          {hasChildren ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 p-0"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          ) : (
            <span className="w-6" />
          )}
          <span className="font-medium text-sm">{dept.name}</span>
          <Badge variant={dept.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-xs">
            {dept.status === 'ACTIVE' ? '正常' : '停用'}
          </Badge>
          <span className="text-xs text-muted-foreground">排序: {dept.sort}</span>
          {dept.remark && <span className="text-xs text-muted-foreground">({dept.remark})</span>}
        </div>

        <div className="flex items-center gap-1">
          <PermissionButton
            perm="system:dept:add"
            variant="ghost"
            size="sm"
            onClick={() => onAddChild(dept)}
            title="新增子部门"
          >
            <Plus className="h-3.5 w-3.5" />
          </PermissionButton>
          <PermissionButton
            perm="system:dept:edit"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(dept)}
            title="编辑"
          >
            <Pencil className="h-3.5 w-3.5" />
          </PermissionButton>
          <PermissionButton
            perm="system:dept:delete"
            variant="ghost"
            size="sm"
            onClick={() => onDelete(dept.id)}
            title="删除"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </PermissionButton>
        </div>
      </div>

      {hasChildren && expanded && (
        <div className="space-y-1 mt-1">
          {dept.children!.map((child) => (
            <DeptTreeItem
              key={child.id}
              dept={child}
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
