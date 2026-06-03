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
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown } from 'lucide-react';
import { PermissionButton } from '@/components/common/permission-button';
import { useConfirm } from '@/hooks/use-confirm';

interface Dept {
  id: string;
  name: string;
  parentId: string | null;
  sort: number;
  status: string;
  remark: string | null;
  children?: Dept[];
}

/**
 * 将树形部门扁平化为带缩进的选项列表
 */
function flattenDepts(depts: Dept[], level = 0): { id: string; label: string }[] {
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
  const [editingDept, setEditingDept] = useState<Dept | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    parentId: '',
    sort: 0,
    status: 'ACTIVE',
    remark: '',
  });

  const { data, isLoading, refetch } = useApiQuery<Dept[]>(['depts'], '/api/system/dept/tree');

  const createMutation = useApiMutation('post', '/api/system/dept', {
    onSuccess: () => {
      toast.success('创建成功');
      setDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => toast.error('创建失败', { description: error.message }),
  });

  const updateMutation = useApiMutation('put', `/api/system/dept/${editingDept?.id || ''}`, {
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

  /** 新增子部门 */
  const handleCreateChild = (parentDept: Dept) => {
    resetForm();
    setFormData((prev) => ({ ...prev, parentId: parentDept.id }));
    setDialogOpen(true);
  };

  const handleEdit = (dept: Dept) => {
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
    const ok = await confirm({ description: '确定要删除吗？', variant: 'destructive' });
    if (!ok) return;
    import('@/lib/api-client').then((m) =>
      m.del(`/api/system/dept/${id}`).then(() => {
        toast.success('删除成功');
        refetch();
      }).catch((err) => toast.error('删除失败', { description: err.message }))
    );
  };

  const handleSubmit = () => {
    if (!formData.name) {
      toast.error('请输入部门名称');
      return;
    }

    const payload = {
      ...formData,
      parentId: formData.parentId || undefined,
    };

    if (editingDept) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const depts = data?.data || [];
  const parentOptions = flattenDepts(depts);
  // 编辑时不能选择自己作为父部门
  const filteredParentOptions = parentOptions.filter((opt) => opt.id !== editingDept?.id);

  const renderTree = (items: Dept[], level = 0) => {
    return items.map((dept) => (
      <DeptRow
        key={dept.id}
        dept={dept}
        level={level}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onCreateChild={handleCreateChild}
      />
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">部门管理</h1>
          <p className="text-muted-foreground">管理系统组织架构</p>
        </div>
        <PermissionButton perm="system:dept:add" onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          新增部门
        </PermissionButton>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="border-b px-4 py-3 font-medium">
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-4">部门名称</div>
              <div className="col-span-2">排序</div>
              <div className="col-span-2">状态</div>
              <div className="col-span-4">操作</div>
            </div>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">加载中...</div>
          ) : depts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">暂无数据</div>
          ) : (
            renderTree(depts)
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDept ? '编辑部门' : '新增部门'}</DialogTitle>
            <DialogDescription>请填写部门信息</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>父部门</Label>
              <Select
                value={formData.parentId || 'none'}
                onValueChange={(v) => setFormData({ ...formData, parentId: v === 'none' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="无（顶级部门）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">无（顶级部门）</SelectItem>
                  {filteredParentOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>部门名称 *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="请输入部门名称"
              />
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
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v })}
                >
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
      <ConfirmDialog />
    </div>
  );
}

function DeptRow({
  dept,
  level,
  onEdit,
  onDelete,
  onCreateChild,
}: {
  dept: Dept;
  level: number;
  onEdit: (dept: Dept) => void;
  onDelete: (id: string) => void;
  onCreateChild: (dept: Dept) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = dept.children && dept.children.length > 0;

  return (
    <>
      <div className="border-b px-4 py-3 hover:bg-muted/50">
        <div className="grid grid-cols-12 gap-4 items-center">
          <div className="col-span-4 flex items-center" style={{ paddingLeft: `${level * 20}px` }}>
            {hasChildren ? (
              <button onClick={() => setExpanded(!expanded)} className="mr-1">
                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            ) : (
              <span className="mr-5" />
            )}
            {dept.name}
          </div>
          <div className="col-span-2">{dept.sort}</div>
          <div className="col-span-2">
            <Badge variant={dept.status === 'ACTIVE' ? 'default' : 'secondary'}>
              {dept.status === 'ACTIVE' ? '启用' : '停用'}
            </Badge>
          </div>
          <div className="col-span-4 flex gap-1">
            <PermissionButton perm="system:dept:add" variant="ghost" size="sm" onClick={() => onCreateChild(dept)} title="新增子部门">
              <Plus className="h-4 w-4" />
            </PermissionButton>
            <PermissionButton perm="system:dept:edit" variant="ghost" size="sm" onClick={() => onEdit(dept)}>
              <Pencil className="h-4 w-4" />
            </PermissionButton>
            <PermissionButton perm="system:dept:delete" variant="ghost" size="sm" onClick={() => onDelete(dept.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </PermissionButton>
          </div>
        </div>
      </div>
      {expanded && hasChildren && dept.children!.map((child) => (
        <DeptRow key={child.id} dept={child} level={level + 1} onEdit={onEdit} onDelete={onDelete} onCreateChild={onCreateChild} />
      ))}
    </>
  );
}
