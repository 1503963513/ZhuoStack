'use client';

import { useState } from 'react';
import { useApiQuery, useApiMutation } from '@/hooks/use-api';
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
import { buildUrl } from '@/lib/utils';
import { Plus, Pencil, Trash2, List } from 'lucide-react';
import { PermissionButton } from '@/components/common/permission-button';
import { PageHeader } from '@/components/common/page-header';
import { DataTable, type Column } from '@/components/common/data-table';
import { Pagination } from '@/components/common/pagination';
import { useConfirm } from '@/hooks/use-confirm';

interface Dict {
  id: string;
  name: string;
  code: string;
  status: string;
  remark: string | null;
  dictData?: DictData[];
}

interface DictData {
  id: string;
  dictId: string;
  label: string;
  value: string;
  sort: number;
  status: string;
  remark: string | null;
}

interface PaginatedResponse {
  data: Dict[];
  pagination: { total: number; page: number; pageSize: number; totalPages: number };
}

export default function DictPage() {
  const { confirm, ConfirmDialog } = useConfirm();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dataDialogOpen, setDataDialogOpen] = useState(false);
  const [editingDict, setEditingDict] = useState<Dict | null>(null);
  const [selectedDict, setSelectedDict] = useState<Dict | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    status: 'ACTIVE',
    remark: '',
  });
  const [dataFormData, setDataFormData] = useState({
    label: '',
    value: '',
    sort: 0,
    status: 'ACTIVE',
    remark: '',
  });

  const { data, isLoading, refetch } = useApiQuery<PaginatedResponse>(
    ['dicts', String(page), String(pageSize), debouncedSearch],
    buildUrl('/api/system/dict', { page, pageSize, search: debouncedSearch || undefined }),
  );

  const { data: dictDataList, refetch: refetchDictData } = useApiQuery<DictData[]>(
    ['dict-data', selectedDict?.id || ''],
    `/api/system/dict/data/${selectedDict?.id || ''}`,
    { enabled: !!selectedDict },
  );

  const createMutation = useApiMutation('post', '/api/system/dict', {
    onSuccess: () => {
      toast.success('创建成功');
      setDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => toast.error('创建失败', { description: error.message }),
  });

  const updateMutation = useApiMutation('put', `/api/system/dict/${editingDict?.id || ''}`, {
    onSuccess: () => {
      toast.success('更新成功');
      setDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => toast.error('更新失败', { description: error.message }),
  });

  const createDataMutation = useApiMutation('post', '/api/system/dict/data', {
    invalidateKeys: [['dict-data']],
    onSuccess: () => {
      toast.success('创建成功');
      setDataFormData({ label: '', value: '', sort: 0, status: 'ACTIVE', remark: '' });
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

  const handleEdit = (dict: Dict) => {
    setEditingDict(dict);
    setFormData({
      name: dict.name,
      code: dict.code,
      status: dict.status,
      remark: dict.remark || '',
    });
    setDialogOpen(true);
  };

  const handleManageData = (dict: Dict) => {
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
    const ok = await confirm({ description: '确定要删除该字典吗？删除后字典数据也会一并删除！', variant: 'destructive' });
    if (ok) {
      import('@/lib/api-client').then((m) =>
        m.del(`/api/system/dict/${id}`).then(() => {
          toast.success('删除成功');
          refetch();
        }).catch((err) => toast.error('删除失败', { description: err.message }))
      );
    }
  };

  const handleDeleteData = async (id: string) => {
    const ok = await confirm({ description: '确定要删除吗？', variant: 'destructive' });
    if (ok) {
      import('@/lib/api-client').then((m) =>
        m.del(`/api/system/dict/data/${id}`).then(() => {
          toast.success('删除成功');
          refetchDictData();
        }).catch((err) => toast.error('删除失败', { description: err.message }))
      );
    }
  };

  const dicts = data?.data?.data || [];
  const pagination = data?.data?.pagination;

  const columns: Column<Dict>[] = [
    { label: '字典名称', key: 'name', span: 3 },
    { label: '字典编码', key: 'code', span: 3 },
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
        title="字典管理"
        description="管理系统字典数据"
        actions={
          <PermissionButton perm="system:dict:add" onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            新增字典
          </PermissionButton>
        }
      />

      <div className="flex gap-4">
        <Input
          placeholder="搜索字典名称/编码"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-sm"
        />
      </div>

      <DataTable
        columns={columns}
        data={dicts}
        isLoading={isLoading}
        emptyText="暂无字典数据"
        actionsSpan={3}
        actions={(row) => (
          <>
            <PermissionButton perm="system:dict:data" variant="ghost" size="sm" onClick={() => handleManageData(row)} title="字典数据">
              <List className="h-4 w-4" />
            </PermissionButton>
            <PermissionButton perm="system:dict:edit" variant="ghost" size="sm" onClick={() => handleEdit(row)}>
              <Pencil className="h-4 w-4" />
            </PermissionButton>
            <PermissionButton perm="system:dict:delete" variant="ghost" size="sm" onClick={() => handleDelete(row.id)}>
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

      {/* 字典编辑弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDict ? '编辑字典' : '新增字典'}</DialogTitle>
            <DialogDescription>请填写字典信息</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>字典名称 *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="请输入字典名称"
                />
              </div>
              <div className="space-y-2">
                <Label>字典编码 *</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="请输入字典编码"
                />
              </div>
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

      {/* 字典数据管理弹窗 */}
      <Dialog open={dataDialogOpen} onOpenChange={setDataDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>字典数据 - {selectedDict?.name}</DialogTitle>
            <DialogDescription>管理字典 {selectedDict?.code} 的数据项</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="标签"
                value={dataFormData.label}
                onChange={(e) => setDataFormData({ ...dataFormData, label: e.target.value })}
              />
              <Input
                placeholder="值"
                value={dataFormData.value}
                onChange={(e) => setDataFormData({ ...dataFormData, value: e.target.value })}
              />
              <Input
                type="number"
                placeholder="排序"
                value={dataFormData.sort}
                onChange={(e) => setDataFormData({ ...dataFormData, sort: parseInt(e.target.value) || 0 })}
                className="w-20"
              />
              <Button onClick={handleAddData} disabled={createDataMutation.isPending}>
                {createDataMutation.isPending ? '添加中...' : '添加'}
              </Button>
            </div>
            <div className="border rounded-md">
              <div className="border-b px-4 py-2 font-medium grid grid-cols-12 gap-4">
                <div className="col-span-3">标签</div>
                <div className="col-span-3">值</div>
                <div className="col-span-2">排序</div>
                <div className="col-span-2">状态</div>
                <div className="col-span-2">操作</div>
              </div>
              {dictDataList?.data?.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">暂无数据</div>
              ) : (
                dictDataList?.data?.map((item) => (
                  <div key={item.id} className="border-b px-4 py-2 grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-3">{item.label}</div>
                    <div className="col-span-3">{item.value}</div>
                    <div className="col-span-2">{item.sort}</div>
                    <div className="col-span-2">
                      <Badge variant={item.status === 'ACTIVE' ? 'default' : 'secondary'}>
                        {item.status === 'ACTIVE' ? '启用' : '停用'}
                      </Badge>
                    </div>
                    <div className="col-span-2">
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteData(item.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog />
    </div>
  );
}
