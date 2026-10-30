'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useConfirm } from '@/hooks/use-confirm';
import { useDebounce } from '@/hooks/use-debounce';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
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
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Pagination } from '@/components/common/pagination';
import { toast } from 'sonner';
import {
  RefreshCw,
  UserMinus,
  Users,
  Globe,
  Clock,
  Laptop,
  Search,
  ShieldCheck,
  Eye,
  Copy,
  Monitor,
  CheckCircle2,
} from 'lucide-react';
import { getErrorMessage, fileUrl } from '@/lib/utils';
import {
  monitorControllerGetOnlineUsers,
  monitorControllerKickUser,
} from '@/api/generated/endpoints/系统-系统监控/系统-系统监控';
import type { OnlineUserItemDto } from '@/api/generated/models';

/** 计算登录时长辅助展示 */
function formatSessionDuration(loginTimeStr: string): string {
  const loginTime = new Date(loginTimeStr).getTime();
  const now = Date.now();
  const diffMinutes = Math.max(0, Math.floor((now - loginTime) / (1000 * 60)));

  if (diffMinutes < 1) return '刚刚登录';
  if (diffMinutes < 60) return `已在线 ${diffMinutes} 分钟`;
  const diffHours = Math.floor(diffMinutes / 60);
  const remMinutes = diffMinutes % 60;
  return `已在线 ${diffHours} 小时 ${remMinutes} 分`;
}

export default function OnlinePage() {
  const { user: currentUser } = useAuthStore();
  const { confirm, ConfirmDialog } = useConfirm();

  // 1. 列表数据获取（支持 30 秒自动轮询可切换）
  const [autoRefresh, setAutoRefresh] = useState(false);
  const {
    data: response,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['online-users'],
    queryFn: () => monitorControllerGetOnlineUsers(),
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const rawUsers: OnlineUserItemDto[] = useMemo(() => response?.data || [], [response]);

  // 2. 搜索与筛选状态
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [browserFilter, setBrowserFilter] = useState('all');
  const [osFilter, setOsFilter] = useState('all');

  // 3. 分页状态
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 4. 多选批量状态
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchKicking, setBatchKicking] = useState(false);

  // 5. 详情查看弹窗
  const [detailUser, setDetailUser] = useState<OnlineUserItemDto | null>(null);

  // 6. 统计卡片指标计算
  const stats = useMemo(() => {
    const total = rawUsers.length;
    const browserMap: Record<string, number> = {};
    const osMap: Record<string, number> = {};

    for (const u of rawUsers) {
      const b = u.browser || '其他';
      const o = u.os || '其他';
      browserMap[b] = (browserMap[b] || 0) + 1;
      osMap[o] = (osMap[o] || 0) + 1;
    }

    const topBrowser = Object.entries(browserMap).sort((a, b) => b[1] - a[1])[0];
    const topOs = Object.entries(osMap).sort((a, b) => b[1] - a[1])[0];

    return {
      total,
      topBrowser: topBrowser ? `${topBrowser[0]} (${topBrowser[1]})` : '暂无',
      topOs: topOs ? `${topOs[0]} (${topOs[1]})` : '暂无',
      browserOptions: Object.keys(browserMap),
      osOptions: Object.keys(osMap),
    };
  }, [rawUsers]);

  // 7. 过滤数据
  const filteredUsers = useMemo(() => {
    let list = rawUsers;

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      list = list.filter(
        (u) =>
          u.userName?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.ip?.toLowerCase().includes(q),
      );
    }

    if (browserFilter !== 'all') {
      list = list.filter((u) => (u.browser || '其他') === browserFilter);
    }

    if (osFilter !== 'all') {
      list = list.filter((u) => (u.os || '其他') === osFilter);
    }

    return list;
  }, [rawUsers, debouncedSearch, browserFilter, osFilter]);

  // 8. 分页数据
  const total = filteredUsers.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const pagedUsers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, page, pageSize]);

  // 9. 单个强退
  const handleKick = async (userId: string, username: string) => {
    if (userId === currentUser?.id) {
      toast.error('禁止操作', { description: '无法强制当前登录账号下线' });
      return;
    }

    const ok = await confirm({
      title: '确认强退用户',
      description: `确定要强制用户 "${username}" 下线吗？该用户将立即断开连接并返回登录页。`,
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await monitorControllerKickUser(userId);
      toast.success(`用户 ${username} 已强制下线`);
      setSelectedIds((prev) => prev.filter((id) => id !== userId));
      refetch();
    } catch (error: unknown) {
      toast.error('操作失败', { description: getErrorMessage(error) });
    }
  };

  // 10. 批量强退
  const handleBatchKick = async () => {
    const validTargets = selectedIds.filter((id) => id !== currentUser?.id);
    if (validTargets.length === 0) {
      toast.warning('请选择要强退的用户（不含当前账号）');
      return;
    }

    const ok = await confirm({
      title: '确认批量强退',
      description: `确定要强制选中的 ${validTargets.length} 个在线会话下线吗？此操作不可撤回。`,
      variant: 'destructive',
    });
    if (!ok) return;

    setBatchKicking(true);
    try {
      const results = await Promise.allSettled(
        validTargets.map((userId) => monitorControllerKickUser(userId)),
      );
      const successCount = results.filter((r) => r.status === 'fulfilled').length;
      toast.success(`成功强退 ${successCount} 个用户会话`);
      setSelectedIds([]);
      refetch();
    } catch (err: unknown) {
      toast.error('批量强退失败', { description: getErrorMessage(err) });
    } finally {
      setBatchKicking(false);
    }
  };

  // 全选/反选处理（自动排除自己）
  const selectablePagedIds = useMemo(
    () => pagedUsers.filter((u) => u.userId !== currentUser?.id).map((u) => u.userId),
    [pagedUsers, currentUser?.id],
  );

  const isAllSelected =
    selectablePagedIds.length > 0 && selectablePagedIds.every((id) => selectedIds.includes(id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds((prev) => prev.filter((id) => !selectablePagedIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...selectablePagedIds])));
    }
  };

  const toggleSelectOne = (userId: string) => {
    if (userId === currentUser?.id) return;
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label}已复制到剪贴板`);
  };

  return (
    <div className="space-y-6">
      {/* 头部标题与顶栏操作 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">在线用户</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            实时监控系统当前在线会话、客户端环境分布与安全下线管理
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* 自动刷新开关 */}
          <Button
            variant={autoRefresh ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => {
              setAutoRefresh(!autoRefresh);
              toast.info(autoRefresh ? '已关闭自动刷新' : '已开启每 30 秒自动刷新');
            }}
            className="text-xs"
          >
            <Clock className="mr-1.5 h-3.5 w-3.5" />
            {autoRefresh ? '自动刷新中 (30s)' : '自动刷新 (关)'}
          </Button>

          {/* 手动刷新 */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            title="刷新在线用户列表"
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            刷新
          </Button>

          {/* 批量强退 */}
          {selectedIds.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBatchKick}
              disabled={batchKicking}
            >
              <UserMinus className="mr-1.5 h-3.5 w-3.5" />
              批量强退 ({selectedIds.length})
            </Button>
          )}
        </div>
      </div>

      {/* 统计指标卡片 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">当前在线总数</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">Redis 会话有效期 30 分钟滑动续期</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">活跃环境分布</CardTitle>
            <Laptop className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold truncate">系统: {stats.topOs}</div>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              主流浏览器: {stats.topBrowser}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">当前管理员会话</CardTitle>
            <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold truncate">
                {currentUser?.name || currentUser?.email || '当前管理员'}
              </span>
              <Badge
                variant="outline"
                className="border-green-500 text-green-600 bg-green-50 dark:bg-green-950/30 text-[10px] py-0"
              >
                本账号受保护
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">不可强制自身账号下线，防误踢</p>
          </CardContent>
        </Card>
      </div>

      {/* 搜索过滤与工具栏 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索用户名、邮箱、IP地址..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>

        {/* 浏览器筛选 */}
        <Select
          value={browserFilter}
          onValueChange={(val) => {
            setBrowserFilter(val);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="全部浏览器" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部浏览器</SelectItem>
            {stats.browserOptions.map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 操作系统筛选 */}
        <Select
          value={osFilter}
          onValueChange={(val) => {
            setOsFilter(val);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="全部操作系统" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部操作系统</SelectItem>
            {stats.osOptions.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-xs text-muted-foreground ml-auto">
          匹配到 {total} 个会话 {selectedIds.length > 0 && `(已选 ${selectedIds.length} 项)`}
        </span>
      </div>

      {/* 在线用户表格 */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[48px] text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    disabled={selectablePagedIds.length === 0}
                    aria-label="全选"
                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary cursor-pointer accent-primary"
                  />
                </TableHead>
                <TableHead className="min-w-[200px]">用户档案</TableHead>
                <TableHead className="min-w-[150px]">登录 IP</TableHead>
                <TableHead className="min-w-[160px]">客户端环境</TableHead>
                <TableHead className="min-w-[170px]">登录时间 / 时长</TableHead>
                <TableHead className="min-w-[90px] text-center">状态</TableHead>
                <TableHead className="min-w-[140px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    加载在线用户数据中...
                  </TableCell>
                </TableRow>
              ) : pagedUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    未找到匹配的在线用户
                  </TableCell>
                </TableRow>
              ) : (
                pagedUsers.map((user) => {
                  const isCurrent = user.userId === currentUser?.id;
                  const isSelected = selectedIds.includes(user.userId);
                  const displayName = user.userName || user.email || '用户';
                  const initial = (displayName || 'U')[0].toUpperCase();

                  return (
                    <TableRow key={user.userId} className={isSelected ? 'bg-muted/40' : undefined}>
                      {/* 选择框 */}
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isCurrent}
                          onChange={() => toggleSelectOne(user.userId)}
                          title={isCurrent ? '当前登录账号受保护，无法选中' : '选择用户'}
                          className="h-4 w-4 rounded border-input text-primary focus:ring-primary cursor-pointer accent-primary disabled:opacity-40 disabled:cursor-not-allowed"
                        />
                      </TableCell>

                      {/* 用户档案 */}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 shrink-0">
                            {user.avatar && (
                              <AvatarImage src={fileUrl(user.avatar)} alt={displayName} />
                            )}
                            <AvatarFallback className="font-semibold bg-primary/10 text-primary text-xs">
                              {initial}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className="font-semibold text-sm truncate max-w-[130px]"
                                title={displayName}
                              >
                                {displayName}
                              </span>
                              {isCurrent && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/30"
                                >
                                  当前账号
                                </Badge>
                              )}
                            </div>
                            {user.email && (
                              <p
                                className="text-xs text-muted-foreground truncate max-w-[170px]"
                                title={user.email}
                              >
                                {user.email}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* 登录 IP */}
                      <TableCell>
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span>{user.ip}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(user.ip, 'IP 地址')}
                            className="text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
                            title="复制 IP"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      </TableCell>

                      {/* 客户端环境 */}
                      <TableCell>
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Monitor className="h-3.5 w-3.5 shrink-0" />
                            <span
                              className="truncate max-w-[140px]"
                              title={user.os || '未知操作系统'}
                            >
                              {user.os || '未知系统'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Laptop className="h-3.5 w-3.5 shrink-0" />
                            <span
                              className="truncate max-w-[140px]"
                              title={user.browser || '未知浏览器'}
                            >
                              {user.browser || '未知浏览器'}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* 登录时间 / 在线时长 */}
                      <TableCell>
                        <div className="space-y-0.5 text-xs">
                          <div className="flex items-center gap-1 font-mono text-foreground">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span>
                              {new Date(user.loginTime).toLocaleString('zh-CN', { hour12: false })}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground pl-4.5">
                            {formatSessionDuration(user.loginTime)}
                          </p>
                        </div>
                      </TableCell>

                      {/* 会话状态 */}
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className="gap-1 border-green-500/50 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20 text-xs inline-flex items-center"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                          在线
                        </Badge>
                      </TableCell>

                      {/* 操作 */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            onClick={() => setDetailUser(user)}
                          >
                            <Eye className="mr-1 h-3.5 w-3.5" />
                            详情
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isCurrent}
                            className="h-8 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 disabled:opacity-30 disabled:cursor-not-allowed"
                            title={isCurrent ? '无法强退自身当前会话' : '强制该用户下线'}
                            onClick={() => handleKick(user.userId, displayName)}
                          >
                            <UserMinus className="mr-1 h-3.5 w-3.5" />
                            强退
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 分页控制 */}
      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        totalPages={totalPages}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />

      {/* 会话详情弹窗 */}
      <Dialog open={!!detailUser} onOpenChange={() => setDetailUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              在线会话详情
            </DialogTitle>
            <DialogDescription>
              当前会话存储在 Redis 中，通过用户 ID 与滑动 TTL 维持活跃状态
            </DialogDescription>
          </DialogHeader>

          {detailUser && (
            <div className="space-y-4 py-2 text-sm">
              <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
                <Avatar className="h-12 w-12">
                  {detailUser.avatar && (
                    <AvatarImage src={fileUrl(detailUser.avatar)} alt={detailUser.userName || ''} />
                  )}
                  <AvatarFallback className="font-bold bg-primary/10 text-primary">
                    {(detailUser.userName || detailUser.email || 'U')[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold text-base flex items-center gap-2">
                    {detailUser.userName || '未知用户名'}
                    {detailUser.userId === currentUser?.id && (
                      <Badge variant="outline" className="text-xs border-blue-500 text-blue-600">
                        当前账号
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {detailUser.email || '无邮箱'}
                  </div>
                </div>
              </div>

              <div className="space-y-2 rounded-md border p-3 font-mono text-xs">
                <div className="flex justify-between items-center py-1 border-b">
                  <span className="text-muted-foreground font-sans">用户 ID (userId):</span>
                  <span className="font-semibold">{detailUser.userId}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b">
                  <span className="text-muted-foreground font-sans">Redis 会话 Key:</span>
                  <span className="font-semibold">online:user:{detailUser.userId}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b">
                  <span className="text-muted-foreground font-sans">登录 IP:</span>
                  <span className="font-semibold">{detailUser.ip}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b">
                  <span className="text-muted-foreground font-sans">操作系统:</span>
                  <span className="font-semibold">{detailUser.os || '未知'}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b">
                  <span className="text-muted-foreground font-sans">浏览器环境:</span>
                  <span className="font-semibold">{detailUser.browser || '未知'}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b">
                  <span className="text-muted-foreground font-sans">登录时间:</span>
                  <span className="font-semibold">
                    {new Date(detailUser.loginTime).toLocaleString('zh-CN', { hour12: false })}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground font-sans">在线时长:</span>
                  <span className="font-semibold text-primary">
                    {formatSessionDuration(detailUser.loginTime)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-between sm:justify-between items-center">
            {detailUser && detailUser.userId !== currentUser?.id ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  const target = detailUser;
                  setDetailUser(null);
                  handleKick(target.userId, target.userName || target.email || '用户');
                }}
              >
                <UserMinus className="mr-1.5 h-3.5 w-3.5" />
                强退此会话
              </Button>
            ) : (
              <div />
            )}
            <Button variant="outline" size="sm" onClick={() => setDetailUser(null)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog />
    </div>
  );
}
