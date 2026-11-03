'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/common/data-table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { RefreshCw, Play, Pause, Timer, Zap, History, PlayCircle, PauseCircle } from 'lucide-react';
import { getErrorMessage } from '@/lib/utils';
import {
  monitorControllerGetJobs,
  monitorControllerStartJob,
  monitorControllerStopJob,
  monitorControllerRunJob,
} from '@/api/generated/endpoints/系统-系统监控/系统-系统监控';
import type { JobItemDto } from '@/api/generated/models';

export default function JobsPage() {
  const {
    data: response,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => monitorControllerGetJobs(),
  });

  const jobs = response?.data || [];

  const handleJobAction = async (name: string, action: 'start' | 'stop' | 'run') => {
    try {
      if (action === 'start') await monitorControllerStartJob(name);
      else if (action === 'stop') await monitorControllerStopJob(name);
      else if (action === 'run') await monitorControllerRunJob(name);

      const actionMap = { start: '启动', stop: '停止', run: '执行' };
      toast.success(`任务 ${name} 已${actionMap[action]}`);
      refetch();
    } catch (error: unknown) {
      toast.error('操作失败', { description: getErrorMessage(error) });
    }
  };

  const runningCount = jobs.filter((j: JobItemDto) => j.status === 'running' || j.running).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">定时任务</h1>
          <p className="text-muted-foreground">系统定时任务管理（基于 @nestjs/schedule）</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/monitor/jobs/logs">
            <Button variant="outline">
              <History className="mr-2 h-4 w-4" />
              调度日志
            </Button>
          </Link>
          <Button variant="outline" size="icon" onClick={() => refetch()} title="刷新">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <Timer className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{jobs.length}</p>
              <p className="text-sm text-muted-foreground">任务总数</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <PlayCircle className="h-8 w-8 text-green-600 dark:text-green-500" />
            <div>
              <p className="text-2xl font-bold">{runningCount}</p>
              <p className="text-sm text-muted-foreground">运行中</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <PauseCircle className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{jobs.length - runningCount}</p>
              <p className="text-sm text-muted-foreground">已暂停</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 任务列表表格 */}
      <DataTable
        columns={[
          {
            label: '任务名称',
            span: 3,
            render: (job) => (
              <div className="space-y-0.5 min-w-0">
                <div className="font-semibold text-sm truncate" title={job.name}>
                  {job.name}
                </div>
                {job.description && (
                  <div className="text-xs text-muted-foreground truncate" title={job.description}>
                    {job.description}
                  </div>
                )}
              </div>
            ),
          },
          {
            label: 'Cron 表达式',
            span: 2,
            render: (job) =>
              job.cron ? (
                <Badge variant="outline" className="font-mono text-xs">
                  {job.cron}
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground">-</span>
              ),
          },
          {
            label: '状态',
            span: 1,
            render: (job) => {
              const isRunning = job.status === 'running' || Boolean(job.running);
              return (
                <Badge variant={isRunning ? 'default' : 'secondary'}>
                  {isRunning ? '运行中' : '已暂停'}
                </Badge>
              );
            },
          },
          {
            label: '上次执行时间',
            span: 2,
            render: (job) => (
              <span className="text-xs font-mono text-muted-foreground">
                {job.lastRun
                  ? new Date(job.lastRun).toLocaleString('zh-CN', { hour12: false })
                  : '-'}
              </span>
            ),
          },
          {
            label: '下次执行时间',
            span: 2,
            render: (job) => (
              <span className="text-xs font-mono text-muted-foreground">
                {job.nextRun
                  ? new Date(job.nextRun).toLocaleString('zh-CN', { hour12: false })
                  : '-'}
              </span>
            ),
          },
        ]}
        data={jobs.map((j: JobItemDto) => ({ ...j, id: j.name }))}
        isLoading={isLoading}
        emptyText="暂无定时任务"
        actionsSpan={3}
        minWidth="min-w-[900px]"
        actions={(job) => {
          const isRunning = job.status === 'running' || Boolean(job.running);
          return (
            <div className="flex items-center gap-1.5">
              <Link href={`/monitor/jobs/logs?jobName=${job.name}`}>
                <Button variant="ghost" size="sm" className="h-7 text-xs px-2.5">
                  <History className="mr-1 h-3 w-3" />
                  日志
                </Button>
              </Link>

              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => handleJobAction(job.name, 'run')}
              >
                <Zap className="mr-1 h-3 w-3" />
                执行
              </Button>

              {isRunning ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-2.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                  onClick={() => handleJobAction(job.name, 'stop')}
                >
                  <Pause className="mr-1 h-3 w-3" />
                  暂停
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-2.5 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/20"
                  onClick={() => handleJobAction(job.name, 'start')}
                >
                  <Play className="mr-1 h-3 w-3" />
                  启动
                </Button>
              )}
            </div>
          );
        }}
      />
    </div>
  );
}
