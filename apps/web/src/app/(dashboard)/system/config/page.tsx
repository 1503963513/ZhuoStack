'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/use-debounce';
import { useConfirm } from '@/hooks/use-confirm';
import { PageHeader } from '@/components/common/page-header';
import { DataTable, type Column } from '@/components/common/data-table';
import { Pagination } from '@/components/common/pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, RefreshCw, Key, Shield, HardDrive, Sliders } from 'lucide-react';
import { toast } from 'sonner';
import {
  configControllerFindAll,
  configControllerCreate,
  configControllerUpdate,
  configControllerRemove,
} from '@/api/generated/endpoints/system-config/system-config';
import type { ConfigItemDto, CreateConfigDto, UpdateConfigDto } from '@/api/generated/models';
import { useConfigStore } from '@/stores/config-store';

const GROUP_OPTIONS = [
  { value: 'all', label: '全部分组', icon: Sliders },
  { value: 'basic', label: '常规设置', icon: Key },
  { value: 'security', label: '安全登录', icon: Shield },
  { value: 'system', label: '系统运维', icon: HardDrive },
];

export default function ConfigPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('all');
  const debouncedSearch = useDebounce(search, 300);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ConfigItemDto | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();
  const fetchPublicConfigs = useConfigStore((s) => s.fetchPublicConfigs);

  const [formData, setFormData] = useState<CreateConfigDto>({
    name: '',
    key: '',
    value: '',
    group: 'basic',
    type: 'string',
    isPublic: false,
    status: 'ACTIVE',
    remark: '',
  });

  const queryParams = {
    page,
    pageSize,
    search: debouncedSearch || undefined,
    group: group !== 'all' ? group : undefined,
  };

  const {
    data: response,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['system-configs', page, pageSize, debouncedSearch, group],
    queryFn: () => configControllerFindAll(queryParams),
  });

  const paginatedData = response?.data;
  const configList = Array.isArray(paginatedData?.data) ? paginatedData.data : [];
  const total = paginatedData?.pagination?.total || 0;
  const totalPages = paginatedData?.pagination?.totalPages || 0;

  const resetForm = () => {
    setFormData({
      name: '',
      key: '',
      value: '',
      group: 'basic',
      type: 'string',
      isPublic: false,
      status: 'ACTIVE',
      remark: '',
    });
    setEditingConfig(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleEdit = (item: ConfigItemDto) => {
    setEditingConfig(item);
    setFormData({
      name: item.name,
      key: item.key,
      value: item.value,
      group: item.group,
      type: item.type,
      isPublic: item.isPublic,
      status: item.status,
      remark: item.remark || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (item: ConfigItemDto) => {
    const ok = await confirm({
      title: '删除配置',
      description: `确定要删除参数「${item.name} (${item.key})」吗？删除后可能影响系统运行。`,
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await configControllerRemove(item.id);
      toast.success('删除成功');
      refetch();
      fetchPublicConfigs();
    } catch {
      toast.error('删除失败');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingConfig) {
        await configControllerUpdate(editingConfig.id, formData as UpdateConfigDto);
        toast.success('修改成功');
      } else {
        await configControllerCreate(formData);
        toast.success('创建成功');
      }
      setDialogOpen(false);
      resetForm();
      refetch();
      fetchPublicConfigs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '操作失败';
      toast.error(msg);
    }
  };

  const columns: Column<ConfigItemDto>[] = [
    {
      label: '参数名称',
      span: 2,
      render: (item) => (
        <div>
          <p className="font-medium text-foreground">{item.name}</p>
          <p className="text-xs font-mono text-muted-foreground">{item.key}</p>
        </div>
      ),
    },
    {
      label: '分组',
      span: 1,
      render: (item) => {
        const g = GROUP_OPTIONS.find((opt) => opt.value === item.group);
        return (
          <Badge variant="outline" className="text-xs font-normal">
            {g ? g.label : item.group}
          </Badge>
        );
      },
    },
    {
      label: '类型',
      span: 1,
      render: (item) => {
        const typeLabels: Record<string, string> = {
          string: '文本',
          boolean: '开关判断',
          number: '数值',
          json: 'JSON',
        };
        return (
          <span className="text-xs text-muted-foreground">
            {typeLabels[item.type] || item.type}
          </span>
        );
      },
    },
    {
      label: '参数键值',
      span: 3,
      render: (item) => {
        if (item.type === 'boolean') {
          const isTrue = item.value === 'true' || item.value === '1';
          return (
            <Badge
              variant={isTrue ? 'default' : 'secondary'}
              className="text-xs font-mono"
            >
              {isTrue ? 'true (开启)' : 'false (关闭)'}
            </Badge>
          );
        }

        return (
          <span
            className="line-clamp-2 text-xs font-mono bg-muted/50 rounded px-1.5 py-0.5 break-all"
            title={item.value}
          >
            {item.value}
          </span>
        );
      },
    },
    {
      label: '公开访问',
      span: 1,
      render: (item) => (
        <Badge variant={item.isPublic ? 'secondary' : 'outline'} className="text-xs">
          {item.isPublic ? '前端公开' : '内部保密'}
        </Badge>
      ),
    },
    {
      label: '更新时间',
      span: 2,
      render: (item) => (
        <span className="text-xs text-muted-foreground">
          {new Date(item.updatedAt).toLocaleString('zh-CN')}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="参数设置"
        description="动态管理系统全局运行参数、基础信息与安全策略"
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleOpenCreate} className="gap-1.5">
              <Plus className="h-4 w-4" />
              新增参数
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
              <RefreshCw className="h-4 w-4" />
              刷新
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="搜索参数名称或键名..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-64"
        />

        <Select
          value={group}
          onValueChange={(val) => {
            setGroup(val);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="全部分组" />
          </SelectTrigger>
          <SelectContent>
            {GROUP_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={configList}
        isLoading={isLoading}
        emptyText="暂无配置项"
        actions={(item) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => handleEdit(item)}
              title="编辑"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => handleDelete(item)}
              title="删除"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      />

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        totalPages={totalPages}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      {/* 创建 / 编辑弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingConfig ? '编辑系统参数' : '新增系统参数'}</DialogTitle>
            <DialogDescription>
              配置系统的全局动态参数。请谨慎修改系统级安全键名。
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cfg-name">参数名称 *</Label>
              <Input
                id="cfg-name"
                required
                placeholder="例如：系统名称 / 初始密码"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cfg-key">参数键名 *</Label>
              <Input
                id="cfg-key"
                required
                disabled={!!editingConfig}
                className="font-mono"
                placeholder="例如：sys.app.name"
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cfg-group">分组 *</Label>
                <Select
                  value={formData.group}
                  onValueChange={(val) => setFormData({ ...formData, group: val })}
                >
                  <SelectTrigger id="cfg-group">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">常规设置 (basic)</SelectItem>
                    <SelectItem value="security">安全登录 (security)</SelectItem>
                    <SelectItem value="system">系统运维 (system)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cfg-type">类型 *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(val) => {
                    const newType = val;
                    let nextVal = formData.value;
                    if (newType === 'boolean' && nextVal !== 'true' && nextVal !== 'false') {
                      nextVal = 'false';
                    }
                    setFormData({ ...formData, type: newType, value: nextVal });
                  }}
                >
                  <SelectTrigger id="cfg-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="string">文本 (string)</SelectItem>
                    <SelectItem value="boolean">开关判断 (boolean)</SelectItem>
                    <SelectItem value="number">数值 (number)</SelectItem>
                    <SelectItem value="json">JSON 结构体</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 根据 type 决定展示 Switch 还是 Input/Textarea */}
            <div className="space-y-2">
              <Label htmlFor="cfg-value">参数键值 *</Label>
              {formData.type === 'boolean' ? (
                <div className="flex items-center justify-between rounded-md border p-3 bg-muted/20">
                  <span className="text-sm font-medium">
                    {formData.value === 'true' ? '开启 (true)' : '关闭 (false)'}
                  </span>
                  <Switch
                    id="cfg-value"
                    checked={formData.value === 'true'}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, value: checked ? 'true' : 'false' })
                    }
                  />
                </div>
              ) : formData.type === 'number' ? (
                <Input
                  id="cfg-value"
                  type="number"
                  required
                  className="font-mono text-xs"
                  placeholder="请输入数字"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                />
              ) : (
                <Textarea
                  id="cfg-value"
                  required
                  rows={3}
                  className="font-mono text-xs"
                  placeholder="请输入参数具体值"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                />
              )}
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="cfg-public" className="text-sm font-medium">
                  前端公开访问
                </Label>
                <p className="text-xs text-muted-foreground">
                  开启后免登录前端可直接读取（如网站名称、Logo、验证码开关）
                </p>
              </div>
              <Switch
                id="cfg-public"
                checked={formData.isPublic}
                onCheckedChange={(checked) => setFormData({ ...formData, isPublic: checked })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cfg-remark">备注（选填）</Label>
              <Input
                id="cfg-remark"
                placeholder="该参数的用途或约束说明"
                value={formData.remark}
                onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit">保存</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog />
    </div>
  );
}
