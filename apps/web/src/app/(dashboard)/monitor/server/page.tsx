'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { PageHeader } from '@/components/common/page-header';
import { Loading } from '@/components/common/loading';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  RefreshCw,
  Server,
  Cpu,
  MemoryStick,
  Clock,
  Terminal,
  Trash2,
  Search,
  Activity,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  Download,
  Copy,
  Check,
} from 'lucide-react';
import { formatBytes, formatDuration, cn } from '@/lib/utils';
import {
  monitorControllerGetServerInfo,
  monitorControllerGetRecentLogs,
  monitorControllerClearRecentLogs,
  monitorControllerGetLogConfig,
  monitorControllerUpdateLogConfig,
} from '@/api/generated/endpoints/system-monitor/system-monitor';
import type {
  UpdateRuntimeLogConfigDto,
  MonitorControllerGetRecentLogsLevel,
} from '@/api/generated/models';
import { toast } from 'sonner';
import { useConfirm } from '@/hooks/use-confirm';

/** 根据使用率返回对应的进度条颜色 */
function getProgressColor(usage: number): string {
  if (usage >= 90) return 'bg-red-500';
  if (usage >= 70) return 'bg-yellow-500';
  return 'bg-primary';
}

const LEVEL_BADGE_STYLE: Record<string, { label: string; className: string }> = {
  error: { label: 'ERROR', className: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' },
  warn: { label: 'WARN', className: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20' },
  info: { label: 'INFO', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  debug: { label: 'DEBUG', className: 'bg-muted text-muted-foreground border-border' },
};

export default function ServerPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'logs'>('overview');
  const { confirm, ConfirmDialog } = useConfirm();

  // 1. 服务器硬件与进程指标
  const {
    data: serverResponse,
    isLoading: isLoadingServer,
    refetch: refetchServer,
  } = useQuery({
    queryKey: ['server-info'],
    queryFn: () => monitorControllerGetServerInfo(),
    refetchInterval: activeTab === 'overview' ? 10000 : false,
  });

  const info = serverResponse?.data;
  const memoryPercent = info ? parseFloat(info.memoryUsage) : 0;

  // 2. 实时系统日志流状态
  const [windowMinutes, setWindowMinutes] = useState<number>(30);
  const [levelFilter, setLevelFilter] = useState<MonitorControllerGetRecentLogsLevel>('all');
  const [keyword, setKeyword] = useState<string>('');
  const [autoPoll, setAutoPoll] = useState<boolean>(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // 3. 运行时配置弹窗
  const [configOpen, setConfigOpen] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [clearingLogs, setClearingLogs] = useState(false);

  const {
    data: logsResponse,
    isLoading: isLoadingLogs,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: ['system-recent-logs', windowMinutes, levelFilter, keyword],
    queryFn: () =>
      monitorControllerGetRecentLogs({
        windowMinutes,
        level: levelFilter,
        keyword: keyword || undefined,
        limit: 300,
      }),
    enabled: activeTab === 'logs',
    refetchInterval: activeTab === 'logs' && autoPoll ? 4000 : false,
  });

  const logsList = useMemo(() => logsResponse?.data?.list || [], [logsResponse?.data?.list]);
  // 日志级别统计
  const logStats = useMemo(() => {
    let error = 0;
    let warn = 0;
    let info = 0;
    let debug = 0;
    for (const item of logsList) {
      if (item.level === "error") error++;
      else if (item.level === "warn") warn++;
      else if (item.level === "info") info++;
      else if (item.level === "debug") debug++;
    }
    return { error, warn, info, debug, total: logsList.length };
  }, [logsList]);

  const [copiedAll, setCopiedAll] = useState(false);

  // 一键复制全部可见日志
  const handleCopyAll = () => {
    if (logsList.length === 0) return;
    const text = logsList
      .map(
        (l) =>
          `[${new Date(l.timestamp).toISOString()}] [${l.level.toUpperCase()}] [${l.context}] ${
            l.caller ? `[${l.caller}] ` : ""
          }${l.message}${l.stack ? `\n${l.stack}` : ""}`
      )
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    toast.success("已复制全部日志文本至剪贴板");
    setTimeout(() => setCopiedAll(false), 2000);
  };

  // 一键导出日志为 .log 文件
  const handleExportLogs = () => {
    if (logsList.length === 0) {
      toast.info("暂无可导出的日志");
      return;
    }
    const text = logsList
      .map(
        (l) =>
          `[${new Date(l.timestamp).toISOString()}] [${l.level.toUpperCase()}] [${l.context}] ${
            l.caller ? `[${l.caller}] ` : ""
          }${l.message}${l.stack ? `\n${l.stack}` : ""}`
      )
      .join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `system_logs_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.log`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("日志导出成功");
  };

  // 关键词高亮渲染辅助函数
  const renderHighlightedText = (text: string, highlight?: string) => {
    if (!highlight || !highlight.trim()) return text;
    const escaped = highlight.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    const parts = text.split(new RegExp(`(${escaped})`, "gi"));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={i} className="bg-yellow-400 text-black px-0.5 rounded font-bold">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  // 4. 运行时动态策略配置
  const { data: configResponse, refetch: refetchConfig } = useQuery({
    queryKey: ['system-log-config'],
    queryFn: () => monitorControllerGetLogConfig(),
    enabled: configOpen,
  });

  const currentConfig = configResponse?.data;
  const [configDraft, setConfigDraft] = useState<UpdateRuntimeLogConfigDto>({});

  const handleOpenConfig = () => {
    if (currentConfig) {
      setConfigDraft({
        level: currentConfig.level,
        bufferSize: currentConfig.bufferSize,
        sampleRate: currentConfig.sampleRate,
        trackCallers: currentConfig.trackCallers,
        stackThreshold: currentConfig.stackThreshold,
        retentionHours: currentConfig.retentionHours,
        dbRetentionDays: currentConfig.dbRetentionDays,
      });
    }
    setConfigOpen(true);
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await monitorControllerUpdateLogConfig(configDraft);
      toast.success('运行时日志策略已即时生效');
      setConfigOpen(false);
      refetchConfig();
      refetchLogs();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '更新配置失败');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleClearLogs = async () => {
    const ok = await confirm({
      title: '清空运行日志',
      description: '确定要清空当前的系统运行日志缓冲区吗？此操作无法恢复。',
      variant: 'destructive',
    });
    if (!ok) return;

    setClearingLogs(true);
    try {
      const res = await monitorControllerClearRecentLogs();
      toast.success(res.data?.message || '日志已清空');
      refetchLogs();
    } catch {
      toast.error('清理失败');
    } finally {
      setClearingLogs(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="服务监控"
        description="实时监控服务器运行健康指标与系统服务运行日志"
        actions={
          <div className="flex items-center gap-2">
            {activeTab === 'logs' ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportLogs}
                  disabled={logsList.length === 0}
                  className="gap-1.5"
                >
                  <Download className="h-4 w-4" />
                  导出日志
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyAll}
                  disabled={logsList.length === 0}
                  className="gap-1.5"
                >
                  {copiedAll ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  {copiedAll ? '已复制' : '复制全部'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenConfig}
                  className="gap-1.5"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  日志策略
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={clearingLogs}
                  onClick={handleClearLogs}
                  className="gap-1.5 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                  清空日志
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchLogs()}
                  className="gap-1.5"
                >
                  <RefreshCw className="h-4 w-4" />
                  刷新
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchServer()}
                className="gap-1.5"
              >
                <RefreshCw className="h-4 w-4" />
                刷新
              </Button>
            )}
          </div>
        }
      />

      {/* 顶部二级导航卡片式切换 */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={cn(
            'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
            activeTab === 'overview'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <Activity className="h-4 w-4" />
          系统与硬件概览
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={cn(
            'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
            activeTab === 'logs'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <Terminal className="h-4 w-4" />
          运行日志流水 (近 30 分钟)
          {logsList.length > 0 && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              {logsList.length}
            </Badge>
          )}
        </button>
      </div>

      {/* ========== 1. 概览视图 ========== */}
      {activeTab === 'overview' && (
        <>
          {isLoadingServer ? (
            <Loading />
          ) : !info ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                无法获取服务器信息
              </CardContent>
            </Card>
          ) : (
            <>
              {/* 概览卡片 */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">服务器名称</CardTitle>
                    <Server className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold truncate" title={info.hostname}>
                      {info.hostname}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {info.platform} ({info.arch})
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">CPU 核心数</CardTitle>
                    <Cpu className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{info.cpuCount} 核</div>
                    <p className="text-xs text-muted-foreground mt-1 truncate" title={info.cpuModel}>
                      {info.cpuModel}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">内存使用率</CardTitle>
                    <MemoryStick className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{info.memoryUsage}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatBytes(info.usedMemory)} / {formatBytes(info.totalMemory)}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Node.js 运行时间</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold">{formatDuration(info.uptime)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Node {info.nodeVersion}</p>
                  </CardContent>
                </Card>
              </div>

              {/* 内存使用详情 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">内存使用详情</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>使用率</span>
                      <span className="font-medium">{info.memoryUsage}</span>
                    </div>
                    <Progress value={memoryPercent} className={getProgressColor(memoryPercent)} />
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-2 text-center">
                    <div className="rounded-lg bg-muted p-3">
                      <div className="text-xs text-muted-foreground">总内存</div>
                      <div className="text-lg font-bold mt-1">{formatBytes(info.totalMemory)}</div>
                    </div>
                    <div className="rounded-lg bg-muted p-3">
                      <div className="text-xs text-muted-foreground">已用内存</div>
                      <div className="text-lg font-bold mt-1 text-primary">
                        {formatBytes(info.usedMemory)}
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted p-3">
                      <div className="text-xs text-muted-foreground">空闲内存</div>
                      <div className="text-lg font-bold mt-1 text-green-600 dark:text-green-400">
                        {formatBytes(info.freeMemory)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 系统信息与负载 */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">系统信息</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="divide-y text-sm">
                      <div className="flex justify-between py-2">
                        <dt className="text-muted-foreground">主机名称</dt>
                        <dd className="font-medium">{info.hostname}</dd>
                      </div>
                      <div className="flex justify-between py-2">
                        <dt className="text-muted-foreground">操作系统</dt>
                        <dd className="font-medium">{info.platform}</dd>
                      </div>
                      <div className="flex justify-between py-2">
                        <dt className="text-muted-foreground">系统架构</dt>
                        <dd className="font-medium">{info.arch}</dd>
                      </div>
                      <div className="flex justify-between py-2">
                        <dt className="text-muted-foreground">Node 版本</dt>
                        <dd className="font-medium font-mono">{info.nodeVersion}</dd>
                      </div>
                      <div className="flex justify-between py-2">
                        <dt className="text-muted-foreground">系统开机时间</dt>
                        <dd className="font-medium">{formatDuration(info.systemUptime)}</dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">CPU 负载</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="divide-y text-sm">
                      <div className="flex justify-between py-2">
                        <dt className="text-muted-foreground">CPU 型号</dt>
                        <dd
                          className="font-medium text-right truncate max-w-[240px]"
                          title={info.cpuModel}
                        >
                          {info.cpuModel}
                        </dd>
                      </div>
                      <div className="flex justify-between py-2">
                        <dt className="text-muted-foreground">核心数量</dt>
                        <dd className="font-medium">{info.cpuCount} 核心</dd>
                      </div>
                      <div className="flex justify-between py-2">
                        <dt className="text-muted-foreground">1 分钟负载</dt>
                        <dd className="font-medium font-mono">{info.loadAverage[0] || '-'}</dd>
                      </div>
                      <div className="flex justify-between py-2">
                        <dt className="text-muted-foreground">5 分钟负载</dt>
                        <dd className="font-medium font-mono">{info.loadAverage[1] || '-'}</dd>
                      </div>
                      <div className="flex justify-between py-2">
                        <dt className="text-muted-foreground">15 分钟负载</dt>
                        <dd className="font-medium font-mono">{info.loadAverage[2] || '-'}</dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </>
      )}

      {/* ========== 2. 运行日志流水 ========== */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          {/* 日志过滤工具条 */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {/* 时间窗口快捷选择 */}
                  <div className="flex items-center rounded-md border bg-muted/40 p-0.5 text-xs">
                    {[
                      { val: 10, label: '近10分' },
                      { val: 30, label: '近30分 (默认)' },
                      { val: 60, label: '近1小时' },
                      { val: 360, label: '近6小时' },
                    ].map((item) => (
                      <button
                        key={item.val}
                        type="button"
                        onClick={() => setWindowMinutes(item.val)}
                        className={cn(
                          'rounded px-2.5 py-1 font-medium transition-colors',
                          windowMinutes === item.val
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  {/* 级别筛选 */}
                  <Select
                    value={levelFilter}
                    onValueChange={(val) => setLevelFilter(val as MonitorControllerGetRecentLogsLevel)}
                  >
                    <SelectTrigger className="w-28 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部级别</SelectItem>
                      <SelectItem value="error">仅 ERROR</SelectItem>
                      <SelectItem value="warn">仅 WARN</SelectItem>
                      <SelectItem value="info">仅 INFO</SelectItem>
                      <SelectItem value="debug">仅 DEBUG</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* 关键词检索 */}
                  <div className="relative w-48 sm:w-64">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="搜索模块名、内容、ReqId..."
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      className="pl-8 h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleExportLogs}
                    disabled={logsList.length === 0}
                    className="h-8 gap-1.5 text-xs"
                    title="导出当前可见日志为文本文件"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">导出</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyAll}
                    disabled={logsList.length === 0}
                    className="h-8 gap-1.5 text-xs"
                    title="复制当前可见日志到剪贴板"
                  >
                    {copiedAll ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                    <span className="hidden sm:inline">{copiedAll ? '已复制' : '复制'}</span>
                  </Button>
                  <div className="h-4 w-px bg-border mx-1" />
                  <div className="flex items-center gap-2">
                    <Label htmlFor="auto-poll-switch" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                      实时 (4s)
                    </Label>
                    <Switch
                      id="auto-poll-switch"
                      checked={autoPoll}
                      onCheckedChange={setAutoPoll}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 日志终端展示区域 */}
          <div className="rounded-lg border bg-zinc-950 text-zinc-100 font-mono text-xs shadow-inner overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-4 py-2 text-zinc-400">
              <div className="flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5 text-green-400" />
                <span className="font-semibold text-zinc-200">System Runtime Logs Console</span>
                <span className="text-[11px] text-zinc-500">
                  (按时间倒序排列 · 最新优先)
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                {/* 错误概览统计条 */}
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    "px-1.5 py-0.5 rounded font-bold text-[10.5px]",
                    logStats.error > 0 ? "bg-red-500/20 text-red-400 animate-pulse border border-red-500/40" : "text-zinc-500"
                  )}>
                    ERR: {logStats.error}
                  </span>
                  <span className="text-zinc-600">·</span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded font-bold text-[10.5px]",
                    logStats.warn > 0 ? "bg-yellow-500/20 text-yellow-400" : "text-zinc-500"
                  )}>
                    WARN: {logStats.warn}
                  </span>
                  <span className="text-zinc-600">·</span>
                  <span className="text-zinc-400">INFO: {logStats.info}</span>
                </div>
                <span className="text-zinc-600">|</span>
                <span>共 {logsList.length} 条</span>
                {isLoadingLogs && <span className="text-zinc-500 animate-pulse">更新中...</span>}
              </div>
            </div>

            <div className="divide-y divide-zinc-900 max-h-[640px] overflow-y-auto p-1">
              {logsList.length === 0 ? (
                <div className="py-12 text-center text-zinc-500">
                  {isLoadingLogs ? '正在加载日志...' : '所选时间范围内暂无匹配的运行日志'}
                </div>
              ) : (
                logsList.map((log) => {
                  const badge = LEVEL_BADGE_STYLE[log.level] || LEVEL_BADGE_STYLE.info;
                  const isExpanded = expandedLogId === log.id;
                  const timeStr = new Date(log.timestamp).toLocaleTimeString('zh-CN', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  }) + `.${String(log.timestamp % 1000).padStart(3, '0')}`;

                  return (
                    <div
                      key={log.id}
                      className={cn(
                        'p-2 hover:bg-zinc-900/60 transition-colors cursor-pointer',
                        log.level === 'error' && 'bg-red-950/20',
                      )}
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="text-zinc-500 shrink-0 select-none">
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />
                          )}
                        </span>
                        <span className="text-zinc-500 shrink-0">{timeStr}</span>
                        <span
                          className={cn(
                            'px-1.5 py-0.2 rounded border text-[10px] font-bold uppercase shrink-0 select-none',
                            badge.className,
                          )}
                        >
                          {badge.label}
                        </span>
                        <span className="text-cyan-400 shrink-0 font-semibold select-none">
                          [{log.context}]
                        </span>
                        {log.caller && (
                          <span className="text-zinc-400 text-[11px] bg-zinc-800/80 px-1 rounded shrink-0">
                            {log.caller}
                          </span>
                        )}
                        <span className="text-zinc-200 break-all flex-1">
                          {renderHighlightedText(log.message, keyword)}
                        </span>
                      </div>

                      {/* 展开的详情上下文与堆栈 */}
                      {isExpanded && (
                        <div className="mt-2.5 ml-6 space-y-2 rounded bg-zinc-900 p-3 text-[11px] border border-zinc-800">
                          <div className="grid grid-cols-2 gap-2 text-zinc-400">
                            <div>
                              <span className="text-zinc-500">Log ID: </span>
                              <span className="text-zinc-300 select-all">{log.id}</span>
                            </div>
                            <div>
                              <span className="text-zinc-500">Request ID: </span>
                              <span className="text-zinc-300 select-all">{log.requestId || '-'}</span>
                            </div>
                            <div>
                              <span className="text-zinc-500">时间戳: </span>
                              <span className="text-zinc-300">{new Date(log.timestamp).toISOString()}</span>
                            </div>
                            <div>
                              <span className="text-zinc-500">调用端: </span>
                              <span className="text-zinc-300">{log.caller || '-'}</span>
                            </div>
                          </div>

                          {log.stack && (
                            <div className="mt-2">
                              <p className="text-red-400 font-semibold mb-1">异常堆栈 (Stack Trace):</p>
                              <pre className="p-2 bg-black/60 rounded text-red-300 overflow-x-auto text-[10.5px] leading-relaxed">
                                {log.stack}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========== 运行时日志配置弹窗 ========== */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-primary" />
              运行时日志动态策略 (立即生效)
            </DialogTitle>
            <DialogDescription>
              热更新后端日志级别、内存采样与保留机制，无需重启 Node.js 进程
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>最低记录日志级别</Label>
                <Select
                  value={configDraft.level ?? 'info'}
                  onValueChange={(val) =>
                    setConfigDraft({ ...configDraft, level: val as UpdateRuntimeLogConfigDto['level'] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debug">DEBUG (包含详细排查信息)</SelectItem>
                    <SelectItem value="info">INFO (常规业务信息，推荐)</SelectItem>
                    <SelectItem value="warn">WARN (仅告警与异常)</SelectItem>
                    <SelectItem value="error">ERROR (仅严重错误)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">调低可实时追踪排查，排查完调回减少损耗</p>
              </div>

              <div className="space-y-2">
                <Label>请求采样比例 (1% - 100%)</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={configDraft.sampleRate ?? 100}
                  onChange={(e) =>
                    setConfigDraft({ ...configDraft, sampleRate: parseInt(e.target.value, 10) || 100 })
                  }
                />
                <p className="text-[11px] text-muted-foreground">高并发高流量场景下防日志打爆内存</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>内存环形缓冲区容量 (条)</Label>
                <Input
                  type="number"
                  min={200}
                  max={10000}
                  value={configDraft.bufferSize ?? 2000}
                  onChange={(e) =>
                    setConfigDraft({ ...configDraft, bufferSize: parseInt(e.target.value, 10) || 2000 })
                  }
                />
                <p className="text-[11px] text-muted-foreground">内存中容纳的最大日志条数 (FIFO 溢出)</p>
              </div>

              <div className="space-y-2">
                <Label>堆栈输出阈值</Label>
                <Select
                  value={configDraft.stackThreshold ?? 'error'}
                  onValueChange={(val) =>
                    setConfigDraft({
                      ...configDraft,
                      stackThreshold: val as UpdateRuntimeLogConfigDto['stackThreshold'],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="error">仅 error 级别输出堆栈</SelectItem>
                    <SelectItem value="warn">warn 及以上均输出堆栈</SelectItem>
                    <SelectItem value="never">完全禁用堆栈跟踪</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">避免普通警告打印大段堆栈占用空间</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>热点日志保留时长 (小时)</Label>
                <Input
                  type="number"
                  min={1}
                  max={168}
                  value={configDraft.retentionHours ?? 24}
                  onChange={(e) =>
                    setConfigDraft({ ...configDraft, retentionHours: parseInt(e.target.value, 10) || 24 })
                  }
                />
                <p className="text-[11px] text-muted-foreground">Redis 环形时序日志的最长留存期限</p>
              </div>

              <div className="space-y-2">
                <Label>数据库持久化日志保留天数</Label>
                <Input
                  type="number"
                  min={1}
                  max={90}
                  value={configDraft.dbRetentionDays ?? 7}
                  onChange={(e) =>
                    setConfigDraft({ ...configDraft, dbRetentionDays: parseInt(e.target.value, 10) || 7 })
                  }
                />
                <p className="text-[11px] text-muted-foreground">定时任务清理数据库操作/登录日志天数</p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">区分并追踪调用方标识</p>
                <p className="text-xs text-muted-foreground">
                  自动识别 Client Header、客户端应用与来源标签
                </p>
              </div>
              <Switch
                checked={configDraft.trackCallers ?? true}
                onCheckedChange={(checked) => setConfigDraft({ ...configDraft, trackCallers: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigOpen(false)}>
              取消
            </Button>
            <Button disabled={savingConfig} onClick={handleSaveConfig}>
              {savingConfig ? '正在应用...' : '立即应用策略'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog />
    </div>
  );
}
