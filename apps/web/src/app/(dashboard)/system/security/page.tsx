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
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ShieldAlert,
  ShieldCheck,
  Gauge,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  Flame,
  CheckCircle2,
  Ban,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  securityControllerGetStats,
  securityControllerFindIpRules,
  securityControllerCreateIpRule,
  securityControllerRemoveIpRule,
  securityControllerFindAllThrottleRules,
  securityControllerCreateThrottleRule,
  securityControllerUpdateThrottleRule,
  securityControllerRemoveThrottleRule,
} from '@/api/generated/endpoints/system-security/system-security';
import type {
  IpRuleItemDto,
  CreateIpRuleDto,
  ThrottleRuleItemDto,
  CreateThrottleRuleDto,
  UpdateThrottleRuleDto,
} from '@/api/generated/models';
import { cn } from '@/lib/utils';

export default function SecurityPage() {
  const [activeTab, setActiveTab] = useState<'throttle' | 'ip'>('throttle');
  const { confirm, ConfirmDialog } = useConfirm();

  // 1. 核心统计指标
  const { data: statsResponse, refetch: refetchStats } = useQuery({
    queryKey: ['system-security-stats'],
    queryFn: () => securityControllerGetStats(),
  });
  const stats = statsResponse?.data;

  // ========== 2. 接口限流与防刷 ==========
  const {
    data: throttleRulesResponse,
    
    refetch: refetchThrottle,
  } = useQuery({
    queryKey: ['system-throttle-rules'],
    queryFn: () => securityControllerFindAllThrottleRules(),
    enabled: activeTab === 'throttle',
  });
  const throttleList: ThrottleRuleItemDto[] = throttleRulesResponse?.data || [];

  const [throttleDialogOpen, setThrottleDialogOpen] = useState(false);
  const [editingThrottleId, setEditingThrottleId] = useState<string | null>(null);
  const [throttleForm, setThrottleForm] = useState<CreateThrottleRuleDto>({
    name: '',
    path: '',
    method: 'ALL',
    limit: 60,
    ttl: 60,
    dimension: 'IP',
    autoBlock: false,
    blockMinutes: 15,
  });

  const handleOpenThrottleCreate = () => {
    setEditingThrottleId(null);
    setThrottleForm({
      name: '',
      path: '',
      method: 'ALL',
      limit: 60,
      ttl: 60,
      dimension: 'IP',
      autoBlock: false,
      blockMinutes: 15,
    });
    setThrottleDialogOpen(true);
  };

  const handleOpenThrottleEdit = (item: ThrottleRuleItemDto) => {
    setEditingThrottleId(item.id);
    setThrottleForm({
      name: item.name,
      path: item.path,
      method: item.method,
      limit: item.limit,
      ttl: item.ttl,
      dimension: item.dimension as CreateThrottleRuleDto['dimension'],
      autoBlock: item.autoBlock,
      blockMinutes: item.blockMinutes,
    });
    setThrottleDialogOpen(true);
  };

  const handleToggleThrottleStatus = async (item: ThrottleRuleItemDto) => {
    const nextStatus = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await securityControllerUpdateThrottleRule(item.id, { status: nextStatus });
      toast.success(nextStatus === 'ACTIVE' ? '已启用该限流规则' : '已停用该限流规则');
      refetchThrottle();
      refetchStats();
    } catch {
      toast.error('切换状态失败');
    }
  };

  const handleDeleteThrottle = async (item: ThrottleRuleItemDto) => {
    const ok = await confirm({
      title: '删除限流规则',
      description: `确定要删除限流规则「${item.name} (${item.path})」吗？`,
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await securityControllerRemoveThrottleRule(item.id);
      toast.success('删除成功');
      refetchThrottle();
      refetchStats();
    } catch {
      toast.error('删除失败');
    }
  };

  const handleThrottleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingThrottleId) {
        await securityControllerUpdateThrottleRule(editingThrottleId, throttleForm as UpdateThrottleRuleDto);
        toast.success('更新限流规则成功');
      } else {
        await securityControllerCreateThrottleRule(throttleForm);
        toast.success('新增限流规则成功');
      }
      setThrottleDialogOpen(false);
      refetchThrottle();
      refetchStats();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '操作失败');
    }
  };

  // ========== 3. IP 黑白名单 ==========
  const [ipPage, setIpPage] = useState(1);
  const [ipPageSize, setIpPageSize] = useState(10);
  const [ipSearch, setIpSearch] = useState('');
  const [ipTypeFilter, setIpTypeFilter] = useState<string>('all');
  const debouncedIpSearch = useDebounce(ipSearch, 300);

  const {
    data: ipResponse,
    isLoading: isLoadingIp,
    refetch: refetchIp,
  } = useQuery({
    queryKey: ['system-ip-rules', ipPage, ipPageSize, debouncedIpSearch, ipTypeFilter],
    queryFn: () =>
      securityControllerFindIpRules({
        page: ipPage,
        pageSize: ipPageSize,
        search: debouncedIpSearch || undefined,
        type: ipTypeFilter !== 'all' ? ipTypeFilter : undefined,
      }),
    enabled: activeTab === 'ip',
  });

  const ipPaginated = ipResponse?.data;
  const ipList: IpRuleItemDto[] = ipPaginated?.data || [];
  const ipTotal = ipPaginated?.pagination?.total || 0;
  const ipTotalPages = ipPaginated?.pagination?.totalPages || 0;

  const [ipDialogOpen, setIpDialogOpen] = useState(false);
  const [ipForm, setIpForm] = useState<CreateIpRuleDto>({
    ip: '',
    type: 'BLACKLIST',
    reason: '',
    expireMinutes: 0,
  });

  const handleOpenIpCreate = (defaultType: 'BLACKLIST' | 'WHITELIST' = 'BLACKLIST') => {
    setIpForm({
      ip: '',
      type: defaultType,
      reason: '',
      expireMinutes: 0,
    });
    setIpDialogOpen(true);
  };

  const handleDeleteIpRule = async (item: IpRuleItemDto) => {
    const ok = await confirm({
      title: '解除名单限制',
      description: `确定要将「${item.ip}」从${item.type === 'BLACKLIST' ? '黑名单' : '白名单'}中移除吗？`,
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await securityControllerRemoveIpRule(item.id);
      toast.success('移除成功');
      refetchIp();
      refetchStats();
    } catch {
      toast.error('操作失败');
    }
  };

  const handleIpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await securityControllerCreateIpRule(ipForm);
      toast.success('添加成功');
      setIpDialogOpen(false);
      refetchIp();
      refetchStats();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '操作失败');
    }
  };

  const ipColumns: Column<IpRuleItemDto>[] = [
    {
      label: 'IP 地址 / 规则',
      span: 3,
      render: (item) => (
        <div>
          <span className="font-mono font-medium text-foreground">{item.ip}</span>
          {item.reason && <p className="text-xs text-muted-foreground mt-0.5">{item.reason}</p>}
        </div>
      ),
    },
    {
      label: '名单类型',
      span: 2,
      render: (item) =>
        item.type === 'BLACKLIST' ? (
          <Badge variant="destructive" className="gap-1 text-xs">
            <Ban className="h-3 w-3" />
            黑名单 (拦截)
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1 text-xs bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
            <CheckCircle2 className="h-3 w-3" />
            白名单 (放行)
          </Badge>
        ),
    },
    {
      label: '有效期限',
      span: 2,
      render: (item) => {
        if (!item.expiredAt) {
          return <span className="text-xs text-muted-foreground">永久有效</span>;
        }
        const isExpired = new Date(item.expiredAt).getTime() < Date.now();
        return (
          <div className="text-xs">
            <span className={cn(isExpired ? 'text-destructive font-medium' : 'text-muted-foreground')}>
              {isExpired ? '已过期' : `至 ${new Date(item.expiredAt).toLocaleString('zh-CN')}`}
            </span>
          </div>
        );
      },
    },
    {
      label: '创建时间',
      span: 2,
      render: (item) => (
        <span className="text-xs text-muted-foreground">
          {new Date(item.createdAt).toLocaleString('zh-CN')}
        </span>
      ),
    },
    {
      label: '操作',
      span: 1,
      render: (item) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleDeleteIpRule(item)}
          className="h-8 w-8 text-destructive hover:bg-destructive/10"
          title="移除"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="安全防护"
        description="管理系统高频接口限流防刷、异常防暴力破解与 IP 黑白名单"
        actions={
          <div className="flex items-center gap-2">
            {activeTab === 'throttle' ? (
              <Button size="sm" onClick={handleOpenThrottleCreate} className="gap-1.5">
                <Plus className="h-4 w-4" />
                新增限流规则
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleOpenIpCreate('BLACKLIST')} className="gap-1.5 bg-red-600 hover:bg-red-700">
                  <Ban className="h-4 w-4" />
                  拉黑 IP
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleOpenIpCreate('WHITELIST')} className="gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  添加白名单
                </Button>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchStats();
                if (activeTab === 'throttle') refetchThrottle();
                else refetchIp();
              }}
              className="gap-1.5"
            >
              <RefreshCw className="h-4 w-4" />
              刷新
            </Button>
          </div>
        }
      />

      {/* 核心指标统计卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今日安全拦截次数</CardTitle>
            <Flame className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.todayBlockedCount ?? 0} 次</div>
            <p className="text-xs text-muted-foreground mt-1">触发黑名单或频控拦截总量</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">活跃限流规则</CardTitle>
            <Gauge className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeThrottleRuleCount ?? 0} 条</div>
            <p className="text-xs text-muted-foreground mt-1">全局接口防刷策略生效中</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">封禁 IP 总数</CardTitle>
            <ShieldAlert className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats?.blackIpCount ?? 0} 个</div>
            <p className="text-xs text-muted-foreground mt-1">已被禁止访问的恶意来源</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">放行白名单 IP</CardTitle>
            <ShieldCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats?.whiteIpCount ?? 0} 个</div>
            <p className="text-xs text-muted-foreground mt-1">特许放行内网或专线来源</p>
          </CardContent>
        </Card>
      </div>

      {/* 顶部二级导航卡片式切换 */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab('throttle')}
          className={cn(
            'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
            activeTab === 'throttle'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <Gauge className="h-4 w-4" />
          接口访问频率限制 (限流规则)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('ip')}
          className={cn(
            'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
            activeTab === 'ip'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <Ban className="h-4 w-4" />
          IP 封禁与黑白名单
        </button>
      </div>

      {/* ========== Tab 1: 接口限流卡片网格 ========== */}
      {activeTab === 'throttle' && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {throttleList.map((rule) => {
              const isActive = rule.status === 'ACTIVE';
              return (
                <Card key={rule.id} className={cn('relative transition-all', !isActive && 'opacity-60 bg-muted/30')}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <CardTitle className="text-base font-semibold">{rule.name}</CardTitle>
                        <p className="text-xs font-mono text-muted-foreground break-all">{rule.path}</p>
                      </div>
                      <Switch
                        checked={isActive}
                        onCheckedChange={() => handleToggleThrottleStatus(rule)}
                        aria-label="启用/禁用状态"
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="font-mono">
                        {rule.method}
                      </Badge>
                      <Badge variant="secondary">
                        {rule.dimension === 'USER' ? '按用户' : rule.dimension === 'IP_AND_USER' ? '按IP+用户' : '按IP'}
                      </Badge>
                      {rule.autoBlock && (
                        <Badge variant="destructive" className="gap-1">
                          <Flame className="h-3 w-3" />
                          超限自动拉黑 {rule.blockMinutes}m
                        </Badge>
                      )}
                    </div>

                    <div className="rounded bg-muted p-2.5 space-y-1 font-mono text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">允许上限:</span>
                        <span className="font-semibold text-foreground">{rule.limit} 次</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">统计周期:</span>
                        <span className="font-semibold text-foreground">{rule.ttl} 秒</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenThrottleEdit(rule)}>
                        编辑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteThrottle(rule)}
                        className="text-destructive hover:bg-destructive/10"
                      >
                        删除
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ========== Tab 2: IP 黑白名单列表 ========== */}
      {activeTab === 'ip' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索 IP 或原因..."
                  value={ipSearch}
                  onChange={(e) => {
                    setIpSearch(e.target.value);
                    setIpPage(1);
                  }}
                  className="pl-8 text-xs"
                />
              </div>
              <Select
                value={ipTypeFilter}
                onValueChange={(val) => {
                  setIpTypeFilter(val);
                  setIpPage(1);
                }}
              >
                <SelectTrigger className="w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部名单</SelectItem>
                  <SelectItem value="BLACKLIST">仅黑名单</SelectItem>
                  <SelectItem value="WHITELIST">仅白名单</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DataTable
            columns={ipColumns}
            data={ipList}
            isLoading={isLoadingIp}
          />

          <Pagination
            page={ipPage}
            pageSize={ipPageSize}
            total={ipTotal}
            totalPages={ipTotalPages}
            onPageChange={setIpPage}
            onPageSizeChange={(ps) => {
              setIpPageSize(ps);
              setIpPage(1);
            }}
          />
        </div>
      )}

      {/* ========== 限流规则新增/编辑弹窗 ========== */}
      <Dialog open={throttleDialogOpen} onOpenChange={setThrottleDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingThrottleId ? '编辑接口限流规则' : '新增接口限流规则'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleThrottleSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="throttle-name">规则名称 *</Label>
              <Input
                id="throttle-name"
                required
                placeholder="例如：登录防爆破、大文件导出限制"
                value={throttleForm.name}
                onChange={(e) => setThrottleForm({ ...throttleForm, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="throttle-path">路由路径 *</Label>
                <Input
                  id="throttle-path"
                  required
                  placeholder="例如：/api/auth/login 或 /*"
                  className="font-mono text-xs"
                  value={throttleForm.path}
                  onChange={(e) => setThrottleForm({ ...throttleForm, path: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>请求方法</Label>
                <Select
                  value={throttleForm.method ?? 'ALL'}
                  onValueChange={(val) => setThrottleForm({ ...throttleForm, method: val })}
                >
                  <SelectTrigger className="font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">ALL (全部)</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="throttle-limit">周期允许上限 (次) *</Label>
                <Input
                  id="throttle-limit"
                  type="number"
                  min={1}
                  required
                  value={throttleForm.limit}
                  onChange={(e) =>
                    setThrottleForm({ ...throttleForm, limit: parseInt(e.target.value, 10) || 1 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="throttle-ttl">统计周期 (秒) *</Label>
                <Input
                  id="throttle-ttl"
                  type="number"
                  min={1}
                  required
                  value={throttleForm.ttl}
                  onChange={(e) =>
                    setThrottleForm({ ...throttleForm, ttl: parseInt(e.target.value, 10) || 1 })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>限流生效维度</Label>
              <Select
                value={throttleForm.dimension ?? 'IP'}
                onValueChange={(val) =>
                  setThrottleForm({ ...throttleForm, dimension: val as CreateThrottleRuleDto['dimension'] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IP">按客户端 IP (适用于匿名与公开接口)</SelectItem>
                  <SelectItem value="USER">按登录用户 (适用于已认证用户操作)</SelectItem>
                  <SelectItem value="IP_AND_USER">按 IP + 用户联合维度 (最严防刷)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">超限自动拉入黑名单</p>
                  <p className="text-xs text-muted-foreground">突破阈值时自动临时封禁该客户端 IP</p>
                </div>
                <Switch
                  checked={throttleForm.autoBlock ?? false}
                  onCheckedChange={(checked) => setThrottleForm({ ...throttleForm, autoBlock: checked })}
                />
              </div>

              {throttleForm.autoBlock && (
                <div className="flex items-center gap-2 pt-2 border-t text-xs">
                  <span className="text-muted-foreground">封禁持续时间:</span>
                  <Input
                    type="number"
                    min={1}
                    className="w-20 h-7 text-xs"
                    value={throttleForm.blockMinutes ?? 15}
                    onChange={(e) =>
                      setThrottleForm({
                        ...throttleForm,
                        blockMinutes: parseInt(e.target.value, 10) || 15,
                      })
                    }
                  />
                  <span>分钟</span>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setThrottleDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit">保存规则</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========== IP 规则新增弹窗 ========== */}
      <Dialog open={ipDialogOpen} onOpenChange={setIpDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{ipForm.type === 'BLACKLIST' ? '添加 IP 黑名单' : '添加 IP 白名单'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleIpSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ip-addr">IP 地址 *</Label>
              <Input
                id="ip-addr"
                required
                placeholder="例如：192.168.1.100 或 10.0.0.0/24"
                className="font-mono text-xs"
                value={ipForm.ip}
                onChange={(e) => setIpForm({ ...ipForm, ip: e.target.value.trim() })}
              />
            </div>

            <div className="space-y-2">
              <Label>名单类型</Label>
              <Select
                value={ipForm.type}
                onValueChange={(val) => setIpForm({ ...ipForm, type: val as 'BLACKLIST' | 'WHITELIST' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BLACKLIST">黑名单 (全站拦截)</SelectItem>
                  <SelectItem value="WHITELIST">白名单 (特权放行)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ip-expire">封禁时长 (分钟)</Label>
              <Input
                id="ip-expire"
                type="number"
                min={0}
                placeholder="0 或留空代表永久有效"
                value={ipForm.expireMinutes ?? 0}
                onChange={(e) =>
                  setIpForm({ ...ipForm, expireMinutes: parseInt(e.target.value, 10) || 0 })
                }
              />
              <p className="text-xs text-muted-foreground">填 0 为永久生效，或填写如 60 (1小时)、1440 (24小时)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ip-reason">封禁 / 加白原因（选填）</Label>
              <Input
                id="ip-reason"
                placeholder="例如：爬虫扫描封禁、研发内网加白"
                value={ipForm.reason ?? ''}
                onChange={(e) => setIpForm({ ...ipForm, reason: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIpDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit">提交保存</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog />
    </div>
  );
}
