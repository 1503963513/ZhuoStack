'use client';

import { useApiQuery } from '@/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Server, Cpu, HardDrive, Clock } from 'lucide-react';

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

export default function ServerPage() {
  const { data, isLoading, refetch } = useApiQuery<ServerInfo>(['server-info'], '/api/monitor/server');

  const info = data?.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">服务器信息</h1>
          <p className="text-muted-foreground">服务器运行状态监控</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          刷新
        </Button>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">加载中...</div>
      ) : info ? (
        <>
          {/* 基本信息 */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="flex items-center gap-4 p-4">
                <Server className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">主机名</p>
                  <p className="font-medium">{info.hostname}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-4">
                <Cpu className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Node.js</p>
                  <p className="font-medium">{info.nodeVersion}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-4">
                <HardDrive className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">平台</p>
                  <p className="font-medium">{info.platform} / {info.arch}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-4">
                <Clock className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-sm text-muted-foreground">运行时间</p>
                  <p className="font-medium">{formatUptime(info.uptime)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 内存信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                内存使用
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span>已用: {formatBytes(info.usedMemory)}</span>
                  <span>可用: {formatBytes(info.freeMemory)}</span>
                  <span>总计: {formatBytes(info.totalMemory)}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-4">
                  <div
                    className="bg-primary h-4 rounded-full transition-all"
                    style={{ width: info.memoryUsage }}
                  />
                </div>
                <div className="text-center">
                  <Badge variant="outline">内存使用率: {info.memoryUsage}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CPU 信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="h-5 w-5" />
                CPU 信息
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">CPU 型号</p>
                  <p className="font-medium">{info.cpuModel}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">CPU 核数</p>
                  <p className="font-medium">{info.cpuCount} 核</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">系统负载</p>
                  <div className="flex gap-2">
                    <Badge variant="outline">1分钟: {info.loadAverage[0]}</Badge>
                    <Badge variant="outline">5分钟: {info.loadAverage[1]}</Badge>
                    <Badge variant="outline">15分钟: {info.loadAverage[2]}</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="p-8 text-center text-muted-foreground">无法获取服务器信息</div>
      )}
    </div>
  );
}
