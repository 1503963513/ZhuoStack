'use client';

import { useApiQuery } from '@/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { PageHeader } from '@/components/common/page-header';
import { Loading } from '@/components/common/loading';
import { RefreshCw, Server, Cpu, MemoryStick, Clock } from 'lucide-react';

interface ServerInfo {
  hostname: string;
  platform: string;
  arch: string;
  nodeVersion: string;
  uptime: number;
  systemUptime: number;
  totalMemory: number;
  usedMemory: number;
  freeMemory: number;
  memoryUsage: string;
  cpuCount: number;
  cpuModel: string;
  loadAverage: string[];
}

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
  const { data, isLoading, refetch } = useApiQuery<ServerInfo>(['server-info'], '/api/monitor/server');

  const info = data?.data;
  const memoryPercent = info ? parseFloat(info.memoryUsage) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="服务器信息"
        description="服务器运行状态监控"
        actions={
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
        }
      />

      {isLoading ? (
        <Loading />
      ) : info ? (
        <>
          {/* 概览卡片 */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">主机名</CardTitle>
                <Server className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold truncate">{info.hostname}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {info.platform} / {info.arch}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Node.js</CardTitle>
                <Cpu className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold">{info.nodeVersion}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {info.cpuCount} 核 CPU
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">内存使用率</CardTitle>
                <MemoryStick className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold">{info.memoryUsage}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatBytes(info.usedMemory)} / {formatBytes(info.totalMemory)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">运行时间</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold">{formatUptime(info.uptime)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  进程运行时长
                </p>
              </CardContent>
            </Card>
          </div>

          {/* CPU 详情 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Cpu className="h-5 w-5" />
                CPU 信息
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-xs text-muted-foreground">CPU 型号</p>
                  <p className="text-sm font-semibold mt-1">{info.cpuModel}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-xs text-muted-foreground">CPU 核数</p>
                  <p className="text-sm font-semibold mt-1">{info.cpuCount} 核</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-3">系统负载（Load Average）</p>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: '1 分钟', value: info.loadAverage[0] },
                    { label: '5 分钟', value: info.loadAverage[1] },
                    { label: '15 分钟', value: info.loadAverage[2] },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg bg-muted/50 p-3 text-center">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="text-lg font-bold mt-1">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 内存详情 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MemoryStick className="h-5 w-5" />
                内存使用
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress
                value={memoryPercent}
                className="h-3"
                indicatorClassName={getProgressColor(memoryPercent)}
              />
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">已用</p>
                  <p className="text-sm font-semibold mt-1">{formatBytes(info.usedMemory)}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">可用</p>
                  <p className="text-sm font-semibold mt-1">{formatBytes(info.freeMemory)}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">总计</p>
                  <p className="text-sm font-semibold mt-1">{formatBytes(info.totalMemory)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Server className="h-12 w-12 mb-3 opacity-30" />
            <p>无法获取服务器信息</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
