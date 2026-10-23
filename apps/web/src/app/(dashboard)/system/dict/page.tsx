'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/use-debounce';
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
import { Plus, Pencil, Trash2, List, RefreshCw } from 'lucide-react';
import { PermissionButton } from '@/components/common/permission-button';
import { PageHeader } from '@/components/common/page-header';
import { DataTable, type Column } from '@/components/common/data-table';
import { Pagination } from '@/components/common/pagination';
import { useConfirm } from '@/hooks/use-confirm';
import {
  dictControllerFindAll,
  dictControllerCreate,
  dictControllerUpdate,
  dictControllerRemove,
  dictControllerFindDataByDictId,
  dictControllerCreateData,
  dictControllerRemoveData,
} from '@/api/generated/endpoints/系统-字典管理/系统-字典管理';
import type {
  DictItemDto,
  DictDataItemDto,
  CreateDictDtoStatus,
  CreateDictDataDtoStatus,
} from '@/api/generated/models';

export default function DictPage() {
  const { confirm, ConfirmDialog } = useConfirm();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dataDialogOpen, setDataDialogOpen] = useState(false);
  const [editingDict, setEditingDict] = useState<DictItemDto | null>(null);
  const [selectedDict, setSelectedDict] = useState<DictItemDto | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    status: 'ACTIVE' as CreateDictDtoStatus,
    remark: '',
  });
  const [dataFormData, setDataFormData] = useState({
    label: '',
    value: '',
    sort: 0,
    status: 'ACTIVE' as CreateDictDataDtoStatus,
    remark: '',
  });

  // 1. 获取分页字典列表
  const {
    data: dictResponse,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['dicts', page, pageSize, debouncedSearch],
    queryFn: () =>
      dictControllerFindAll({
        page,
        pageSize,
        search: debouncedSearch || undefined,
      }),
  });

  // 2. 获取当前选中字典的数据项列表
  const { data: dictDataResponse, refetch: refetchDictData } = useQuery({
    queryKey: ['dict-data', selectedDict?.id || ''],
    queryFn: () => dictControllerFindDataByDictId(selectedDict!.id),
    enabled: !!selectedDict,
  });

  const dicts = dictResponse?.data?.data || [];
  const dictDataList = dictDataResponse?.data || [];
  const pagination = dictResponse?.data?.pagination || {
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 0,
  };

  // 3. 字典操作 Mutation
  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      dictControllerCreate({
        name: data.name,
        code: data.code,
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
      if (!editingDict) throw new Error('未选择编辑字典');
      return dictControllerUpdate(editingDict.id, {
        name: data.name,
        code: data.code,
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

  const createDataMutation = useMutation({
    mutationFn: (data: typeof dataFormData & { dictId: string }) =>
      dictControllerCreateData({
        dictId: data.dictId,
        label: data.label,
        value: data.value,
        sort: data.sort,
        status: data.status,
        remark: data.remark || undefined,
      }),
    onSuccess: () => {
      toast.success('创建成功');
      setDataFormData({ label: '', value: '', sort: 0, status: 'ACTIVE', remark: '' });
      refetchDictData();
    },
    onError: (error) => toast.error('创建失败', { description: error.message }),
  });

  const resetForm = () => {
    setFormData({ name: '', code: '', status: 'ACTIVE', remark: '' });
    setEditingDict(null);
  };

  const handleCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleEdit = (dict: DictItemDto) => {
    setEditingDict(dict);
    setFormData({
      name: dict.name,
      code: dict.code,
      status: dict.status,
      remark: dict.remark || '',
    });
    setDialogOpen(true);
  };

  const handleManageData = (dict: DictItemDto) => {
    setSelectedDict(dict);
    setDataDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.code) {
      toast.error('请填写必填项');
      return;
    }

    if (editingDict) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleAddData = () => {
    if (!dataFormData.label || !dataFormData.value || !selectedDict) {
      toast.error('请填写必填项');
      return;
    }

    createDataMutation.mutate({ ...dataFormData, dictId: selectedDict.id });
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      description: '确定要删除该字典吗？删除后字典数据也会一并删除！',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await dictControllerRemove(id);
      toast.success('删除成功');
      refetch();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '删除失败';
      toast.error('删除失败', { description: errorMsg });
    }
  };

  const handleDeleteData = async (dataId: string) => {
    const ok = await confirm({ description: '确定要删除该字典数据吗？', variant: 'destructive' });
    if (!ok) return;
    try {
      await dictControllerRemoveData(dataId);
      toast.success('删除成功');
      refetchDictData();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '删除失败';
      toast.error('删除失败', { description: errorMsg });
    }
  };

  const columns: Column<DictItemDto>[] = [
    { label: '字典名称', span: 2, key: 'name' },
    { label: '字典类型', span: 2, key: 'code' },
    {
      label: '状态',
      span: 2,
      render: (d) => (
        <Badge variant={d.status === 'ACTIVE' ? 'default' : 'secondary'}>
          {d.status === 'ACTIVE' ? '正常' : '停用'}
        </Badge>
      ),
    },
    { label: '备注', span: 2, render: (d) => d.remark || '-' },
    {
      label: '创建时间',
      span: 2,
      render: (d) => new Date(d.createdAt).toLocaleDateString('zh-CN'),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="字典管理"
        description="管理系统各类下拉选项与数据字典"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => refetch()} title="刷新">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <PermissionButton perm="system:dict:add" onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              新增字典
            </PermissionButton>
          </div>
        }
      />

      <div className="flex items-center gap-4">
        <Input
          placeholder="搜索字典名称或编码..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <DataTable
        columns={columns}
        data={dicts}
        isLoading={isLoading}
        emptyText="暂无字典数据"
        actions={(d) => (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => handleManageData(d)} title="字典数据">
              <List className="mr-1 h-3.5 w-3.5" />
              数据
            </Button>
            <PermissionButton
              perm="system:dict:edit"
              variant="ghost"
              size="sm"
              onClick={() => handleEdit(d)}
            >
              <Pencil className="mr-1 h-3.5 w-3.5" />
              编辑
            </PermissionButton>
            <PermissionButton
              perm="system:dict:delete"
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(d.id)}
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

      {/* 字典表单弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDict ? '编辑字典' : '新增字典'}</DialogTitle>
            <DialogDescription>
              {editingDict ? '修改字典基本信息。' : '填写字典基本信息。'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">字典名称 *</Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="如：用户性别"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="code">字典类型 *</Label>
              <Input
                id="code"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="如：sys_user_sex"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="status">状态</Label>
              <Select
                value={formData.status}
                onValueChange={(val) =>
                  setFormData({ ...formData, status: val as CreateDictDtoStatus })
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
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 字典数据管理弹窗 */}
      <Dialog open={dataDialogOpen} onOpenChange={setDataDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedDict?.name} - 字典数据管理</DialogTitle>
            <DialogDescription>管理「{selectedDict?.code}」下的所有字典选项。</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-y-auto pr-1">
            {/* 新增数据项行 */}
            <div className="p-3 bg-muted/40 rounded-lg space-y-3">
              <div className="text-sm font-medium">新增字典数据项</div>
              <div className="grid grid-cols-4 gap-2">
                <Input
                  placeholder="标签 *"
                  value={dataFormData.label}
                  onChange={(e) => setDataFormData({ ...dataFormData, label: e.target.value })}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="键值 *"
                  value={dataFormData.value}
                  onChange={(e) => setDataFormData({ ...dataFormData, value: e.target.value })}
                  className="h-8 text-xs"
                />
                <Input
                  type="number"
                  placeholder="排序"
                  value={dataFormData.sort}
                  onChange={(e) =>
                    setDataFormData({ ...dataFormData, sort: parseInt(e.target.value) || 0 })
                  }
                  className="h-8 text-xs"
                />
                <Button
                  size="sm"
                  className="h-8"
                  onClick={handleAddData}
                  disabled={createDataMutation.isPending}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  添加
                </Button>
              </div>
            </div>

            {/* 数据项列表 */}
            <div className="border rounded-md divide-y">
              {dictDataList.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-6">暂无字典数据项</div>
              ) : (
                dictDataList.map((item: DictDataItemDto) => (
                  <div key={item.id} className="flex items-center justify-between p-3 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{item.label}</span>
                      <Badge variant="outline" className="font-mono text-xs">
                        {item.value}
                      </Badge>
                      <Badge
                        variant={item.status === 'ACTIVE' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {item.status === 'ACTIVE' ? '正常' : '停用'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">排序: {item.sort}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteData(item.id)}
                      className="text-destructive hover:text-destructive h-7 px-2"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDataDialogOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog />
    </div>
  );
}
