'use client';

import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { PageHeader } from '@/components/common/page-header';
import { Loading } from '@/components/common/loading';
import { RefreshCw, Server, Cpu, MemoryStick, Clock } from 'lucide-react';
import { monitorControllerGetServerInfo } from '@/api/generated/endpoints/系统-系统监控/系统-系统监控';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}天 ${h}小时 ${m}分钟`;
}

/** 根据使用率返回对应的进度条颜色 */
function getProgressColor(usage: number): string {
  if (usage >= 90) return 'bg-red-500';
  if (usage >= 70) return 'bg-yellow-500';
  return 'bg-primary';
}

export default function ServerPage() {
  const {
    data: response,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['server-info'],
    queryFn: () => monitorControllerGetServerInfo(),
  });

  const info = response?.data;
  const memoryPercent = info ? parseFloat(info.memoryUsage) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="服务器信息"
        description="服务器运行状态监控"
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
        }
      />

      {isLoading ? (
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
                <div className="text-xl font-bold">{formatUptime(info.uptime)}</div>
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
                    <dd className="font-medium">{formatUptime(info.systemUptime)}</dd>
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
    </div>
  );
}
