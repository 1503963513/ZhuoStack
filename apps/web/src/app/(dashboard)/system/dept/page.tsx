'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
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
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { TreeTable } from '@/components/common/tree-table';
import { PermissionButton } from '@/components/common/permission-button';
import { PageHeader } from '@/components/common/page-header';
import { useConfirm } from '@/hooks/use-confirm';
import {
  deptControllerFindTree,
  deptControllerCreate,
  deptControllerUpdate,
  deptControllerRemove,
} from '@/api/generated/endpoints/system-dept/system-dept';
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
    isFetching,
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
            <PermissionButton perm="system:dept:add" onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              新增部门
            </PermissionButton>
          </div>
        }
      />

      <TreeTable
        columns={[
          {
            label: '部门名称',
            span: 4,
            render: (dept) => <span className="font-semibold">{dept.name}</span>,
          },
          {
            label: '状态',
            span: 2,
            render: (dept) => (
              <Badge variant={dept.status === 'ACTIVE' ? 'default' : 'secondary'}>
                {dept.status === 'ACTIVE' ? '正常' : '停用'}
              </Badge>
            ),
          },
          {
            label: '排序',
            span: 1,
            key: 'sort',
          },
          {
            label: '备注',
            span: 3,
            render: (dept) => (
              <span
                className="text-xs text-muted-foreground truncate block"
                title={dept.remark || ''}
              >
                {dept.remark || '-'}
              </span>
            ),
          },
        ]}
        data={depts}
        isLoading={isLoading}
        emptyText="暂无部门数据"
        searchable
        searchPlaceholder="搜索部门名称或备注..."
        getSearchText={(dept) => [dept.name, dept.remark].filter(Boolean).join(' ')}
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        actionsSpan={2}
        minWidth="min-w-[680px]"
        actions={(dept) => (
          <div className="flex items-center gap-1">
            <PermissionButton
              perm="system:dept:add"
              variant="ghost"
              size="sm"
              onClick={() => handleCreateChild(dept)}
              title="新增子部门"
            >
              <Plus className="h-3.5 w-3.5" />
            </PermissionButton>
            <PermissionButton
              perm="system:dept:edit"
              variant="ghost"
              size="sm"
              onClick={() => handleEdit(dept)}
              title="编辑"
            >
              <Pencil className="h-3.5 w-3.5" />
            </PermissionButton>
            <PermissionButton
              perm="system:dept:delete"
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(dept.id)}
              title="删除"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </PermissionButton>
          </div>
        )}
      />

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
