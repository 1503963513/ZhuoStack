'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useConfirm } from '@/hooks/use-confirm';
import { useDebounce } from '@/hooks/use-debounce';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { toast } from 'sonner';
import {
  Trash2,
  RefreshCw,
  Database,
  HardDrive,
  Eye,
  Lock,
  Copy,
  Layers,
  Search,
} from 'lucide-react';
import { getErrorMessage, cn } from '@/lib/utils';
import { Pagination } from '@/components/common/pagination';
import {
  monitorControllerGetCacheInfo,
  monitorControllerGetCacheValue,
  monitorControllerDeleteCacheKey,
  monitorControllerClearAllCache,
} from '@/api/generated/endpoints/系统-系统监控/系统-系统监控';
import type { CacheKeyDetailDto, CacheValueDto } from '@/api/generated/models';

// 预定义的前缀分类定义
const CATEGORY_TABS = [
  { id: 'all', label: '全部键' },
  { id: 'menu:', label: '菜单缓存', prefixes: ['menu:'] },
  { id: 'dict:', label: '字典缓存', prefixes: ['dict:'] },
  { id: 'dept:', label: '部门缓存', prefixes: ['dept:'] },
  { id: 'captcha:', label: '验证码', prefixes: ['captcha:'] },
  { id: 'security', label: '会话安全', prefixes: ['token:', 'login:', 'kicked:', 'online:'] },
  { id: 'other', label: '其他' },
];

export default function CachePage() {
  const {
    data: response,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['cache-info'],
    queryFn: () => monitorControllerGetCacheInfo(),
  });

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [deleting, setDeleting] = useState<string | null>(null);
  const [activeValueModal, setActiveValueModal] = useState<CacheValueDto | null>(null);
  const [loadingValue, setLoadingValue] = useState(false);

  const { confirm, ConfirmDialog } = useConfirm();

  const cacheInfo = response?.data;
  const rawKeys: CacheKeyDetailDto[] = useMemo(() => cacheInfo?.keys || [], [cacheInfo]);

  // 各分类键数量统计
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: rawKeys.length, other: 0 };
    for (const cat of CATEGORY_TABS) {
      if (cat.id !== 'all' && cat.id !== 'other') {
        counts[cat.id] = 0;
      }
    }

    const allConfiguredPrefixes = CATEGORY_TABS.flatMap((c) => c.prefixes || []);

    for (const item of rawKeys) {
      let matched = false;
      for (const cat of CATEGORY_TABS) {
        if (cat.prefixes && cat.prefixes.some((p) => item.key.startsWith(p))) {
          counts[cat.id] = (counts[cat.id] || 0) + 1;
          matched = true;
          break;
        }
      }
      if (!matched && !allConfiguredPrefixes.some((p) => item.key.startsWith(p))) {
        counts['other'] = (counts['other'] || 0) + 1;
      }
    }
    return counts;
  }, [rawKeys]);

  // 根据分类、类型、关键词综合过滤
  const filteredKeys = useMemo(() => {
    let list = rawKeys;

    // 1. 前缀分类筛选
    if (activeCategory !== 'all') {
      if (activeCategory === 'other') {
        const allConfiguredPrefixes = CATEGORY_TABS.flatMap((c) => c.prefixes || []);
        list = list.filter((item) => !allConfiguredPrefixes.some((p) => item.key.startsWith(p)));
      } else {
        const cat = CATEGORY_TABS.find((c) => c.id === activeCategory);
        if (cat?.prefixes) {
          list = list.filter((item) => cat.prefixes.some((p) => item.key.startsWith(p)));
        }
      }
    }

    // 2. 数据类型筛选
    if (selectedType !== 'all') {
      list = list.filter((item) => item.type === selectedType);
    }

    // 3. 关键词搜索
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      list = list.filter((item) => item.key.toLowerCase().includes(q));
    }

    return list;
  }, [rawKeys, activeCategory, selectedType, debouncedSearch]);

  // 分页截取
  const total = filteredKeys.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const pagedKeys = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredKeys.slice(start, start + pageSize);
  }, [filteredKeys, page, pageSize]);

  // 查看具体键值
  const handleViewValue = async (key: string) => {
    setLoadingValue(true);
    try {
      const res = await monitorControllerGetCacheValue(key);
      if (res.data) {
        setActiveValueModal(res.data);
      }
    } catch (err: unknown) {
      toast.error('获取键值失败', { description: getErrorMessage(err) });
    } finally {
      setLoadingValue(false);
    }
  };

  const handleDeleteKey = async (key: string) => {
    const ok = await confirm({
      description: `确定要删除缓存键 "${key}" 吗？`,
      variant: 'destructive',
    });
    if (!ok) return;
    setDeleting(key);
    try {
      await monitorControllerDeleteCacheKey(key);
      toast.success('删除成功');
      refetch();
    } catch (error: unknown) {
      toast.error('删除失败', { description: getErrorMessage(error) });
    } finally {
      setDeleting(null);
    }
  };

  const handleClearAll = async () => {
    const ok = await confirm({
      description: '确定要清空所有常规缓存吗？安全会话键会被保留。',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await monitorControllerClearAllCache();
      toast.success('常规缓存已清空');
      refetch();
    } catch (error: unknown) {
      toast.error('清空失败', { description: getErrorMessage(error) });
    }
  };

  const copyContent = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('内容已复制到剪贴板');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">缓存列表</h1>
          <p className="text-muted-foreground">Redis 缓存状态监控、分类检索与键值详情管理</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} title="刷新">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="destructive" onClick={handleClearAll}>
            <Trash2 className="mr-2 h-4 w-4" />
            清空常规缓存
          </Button>
        </div>
      </div>

      {/* 概览卡片 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">连接状态</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {cacheInfo?.status === 'connected' ? (
                <Badge variant="default" className="bg-green-600 hover:bg-green-600">
                  正常运行
                </Badge>
              ) : (
                <Badge variant="destructive">未连接</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总键数量</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cacheInfo?.totalKeys ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已用内存</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cacheInfo?.usedMemory ?? 'N/A'}</div>
          </CardContent>
        </Card>
      </div>

      {/* 前缀分类 Tab 条 */}
      <div className="flex flex-wrap items-center gap-1.5 border-b pb-2">
        {CATEGORY_TABS.map((cat) => {
          const count = categoryCounts[cat.id] ?? 0;
          const isActive = activeCategory === cat.id;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setActiveCategory(cat.id);
                setPage(1);
              }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer',
                isActive
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <span>{cat.label}</span>
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.2 text-[10px]',
                  isActive
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-muted-foreground/10 text-muted-foreground',
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 搜索与类型过滤 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索键名..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>

        <Select
          value={selectedType}
          onValueChange={(val) => {
            setSelectedType(val);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="全部数据类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="string">string</SelectItem>
            <SelectItem value="hash">hash</SelectItem>
            <SelectItem value="list">list</SelectItem>
            <SelectItem value="set">set</SelectItem>
            <SelectItem value="zset">zset</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-xs text-muted-foreground ml-auto">共筛选出 {total} 个匹配键</span>
      </div>

      {/* 键列表表格 */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12 text-muted-foreground">加载中...</div>
          ) : pagedKeys.length === 0 ? (
            <div className="flex justify-center py-12 text-muted-foreground">
              未找到匹配的缓存键
            </div>
          ) : (
            <div className="divide-y">
              {pagedKeys.map((item) => (
                <div
                  key={item.key}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="space-y-1.5 flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="font-mono text-sm font-semibold truncate max-w-md block"
                        title={item.key}
                      >
                        {item.key}
                      </span>

                      <Badge variant="outline" className="text-xs font-mono">
                        {item.type}
                      </Badge>

                      {item.isProtected ? (
                        <Badge
                          variant="outline"
                          className="text-xs border-amber-500/50 text-amber-600 dark:text-amber-400 gap-1 bg-amber-50 dark:bg-amber-950/20"
                        >
                          <Lock className="h-3 w-3" />
                          受保护安全键
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          可清理缓存
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>TTL: {item.ttl === -1 ? '永久' : `${item.ttl} 秒`}</span>
                      <span>数据大小: {item.size}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewValue(item.key)}
                      disabled={loadingValue}
                    >
                      <Eye className="mr-1.5 h-3.5 w-3.5" />
                      查看值
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive disabled:opacity-30"
                      onClick={() => handleDeleteKey(item.key)}
                      disabled={deleting === item.key || item.isProtected}
                      title={item.isProtected ? '受保护安全键，禁止手动删除' : '删除该键'}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      删除
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
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

      {/* 键值详情弹窗 */}
      <Dialog open={!!activeValueModal} onOpenChange={() => setActiveValueModal(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-mono text-base break-all">
              {activeValueModal?.key}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-3 pt-1">
              <span>
                类型:{' '}
                <Badge variant="outline" className="font-mono text-xs ml-1">
                  {activeValueModal?.type}
                </Badge>
              </span>
              <span>
                TTL:{' '}
                <strong className="font-mono">
                  {activeValueModal?.ttl === -1 ? '永久' : `${activeValueModal?.ttl}s`}
                </strong>
              </span>
              {activeValueModal?.isProtected && (
                <Badge variant="outline" className="border-amber-500 text-amber-600 gap-1">
                  <Lock className="h-3 w-3" /> 受保护安全键
                </Badge>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto rounded-md bg-muted p-4 font-mono text-xs whitespace-pre-wrap break-all border">
            {activeValueModal?.value || '（空值）'}
          </div>

          <DialogFooter className="flex justify-between items-center sm:justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => activeValueModal && copyContent(activeValueModal.value || '')}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              复制值
            </Button>
            <Button variant="default" size="sm" onClick={() => setActiveValueModal(null)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog />
    </div>
  );
}
