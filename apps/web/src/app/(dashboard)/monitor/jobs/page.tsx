'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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

      {/* 任务列表 */}
      <Card>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="flex justify-center py-8 text-muted-foreground">加载中...</div>
          ) : jobs.length === 0 ? (
            <div className="flex justify-center py-8 text-muted-foreground">暂无定时任务</div>
          ) : (
            <div className="divide-y">
              {jobs.map((job: JobItemDto) => {
                const isRunning = job.status === 'running' || Boolean(job.running);

                return (
                  <div
                    key={job.name}
                    className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2.5">
                        <span className="font-semibold text-base">{job.name}</span>
                        {job.description && (
                          <span className="text-xs text-muted-foreground">{job.description}</span>
                        )}
                        <Badge variant={isRunning ? 'default' : 'secondary'}>
                          {isRunning ? '运行中' : '已暂停'}
                        </Badge>
                        {job.cron && (
                          <Badge variant="outline" className="font-mono text-xs">
                            {job.cron}
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
                        {job.lastRun && (
                          <span>
                            上次执行:{' '}
                            {new Date(job.lastRun).toLocaleString('zh-CN', {
                              hour12: false,
                            })}
                          </span>
                        )}
                        {job.nextRun && (
                          <span>
                            下次执行:{' '}
                            {new Date(job.nextRun).toLocaleString('zh-CN', {
                              hour12: false,
                            })}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Link href={`/monitor/jobs/logs?jobName=${job.name}`}>
                        <Button variant="ghost" size="sm">
                          <History className="mr-1 h-3.5 w-3.5" />
                          日志
                        </Button>
                      </Link>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleJobAction(job.name, 'run')}
                      >
                        <Zap className="mr-1 h-3.5 w-3.5" />
                        立即执行
                      </Button>

                      {isRunning ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleJobAction(job.name, 'stop')}
                        >
                          <Pause className="mr-1 h-3.5 w-3.5" />
                          暂停
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleJobAction(job.name, 'start')}
                        >
                          <Play className="mr-1 h-3.5 w-3.5" />
                          启动
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
