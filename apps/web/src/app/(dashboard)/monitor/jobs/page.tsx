'use client';

import { useApiQuery } from '@/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { RefreshCw, Play, Pause, Timer, Zap } from 'lucide-react';

interface Job {
  id: string;
  name: string;
  cron: string;
  status: string;
  description: string;
  lastRun: string | null;
  nextRun: string | null;
}

export default function JobsPage() {
  const { data, isLoading, refetch } = useApiQuery<Job[]>(['jobs'], '/api/monitor/jobs');

  const jobs = data?.data || [];

  const handleJobAction = async (name: string, action: 'start' | 'stop' | 'run') => {
    try {
      const { post } = await import('@/lib/api-client');
      await post(`/api/monitor/jobs/${name}/${action}`);
      const actionMap = { start: '启动', stop: '停止', run: '执行' };
      toast.success(`任务 ${name} 已${actionMap[action]}`);
      refetch();
    } catch (err: any) {
      toast.error('操作失败', { description: err.message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">定时任务</h1>
          <p className="text-muted-foreground">系统定时任务管理（基于 @nestjs/schedule）</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          刷新
        </Button>
      </div>

      {/* 统计 */}
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
            <Play className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{jobs.filter((j) => j.status === 'running').length}</p>
              <p className="text-sm text-muted-foreground">运行中</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <Pause className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">{jobs.filter((j) => j.status !== 'running').length}</p>
              <p className="text-sm text-muted-foreground">已暂停</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 任务列表 */}
      <Card>
        <CardContent className="p-0">
          <div className="border-b px-4 py-3 font-medium">
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-2">任务名称</div>
              <div className="col-span-2">Cron 表达式</div>
              <div className="col-span-1">状态</div>
              <div className="col-span-2">描述</div>
              <div className="col-span-2">上次执行</div>
              <div className="col-span-1">下次执行</div>
              <div className="col-span-2">操作</div>
            </div>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">加载中...</div>
          ) : jobs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">暂无定时任务</div>
          ) : (
            jobs.map((job) => (
              <div key={job.id} className="border-b px-4 py-4 hover:bg-muted/50">
                <div className="grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-2 font-medium">{job.name}</div>
                  <div className="col-span-2">
                    <code className="rounded bg-muted px-2 py-1 text-xs">{job.cron}</code>
                  </div>
                  <div className="col-span-1">
                    <Badge variant={job.status === 'running' ? 'default' : 'secondary'}>
                      {job.status === 'running' ? '运行中' : '已暂停'}
                    </Badge>
                  </div>
                  <div className="col-span-2 text-sm text-muted-foreground">{job.description}</div>
                  <div className="col-span-2 text-sm text-muted-foreground">
                    {job.lastRun ? new Date(job.lastRun).toLocaleString('zh-CN') : '-'}
                  </div>
                  <div className="col-span-1 text-sm text-muted-foreground">
                    {job.nextRun ? new Date(job.nextRun).toLocaleString('zh-CN') : '-'}
                  </div>
                  <div className="col-span-2 flex gap-1">
                    {job.status === 'running' ? (
                      <Button variant="ghost" size="sm" onClick={() => handleJobAction(job.name, 'stop')} title="停止">
                        <Pause className="h-4 w-4 text-yellow-500" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => handleJobAction(job.name, 'start')} title="启动">
                        <Play className="h-4 w-4 text-green-500" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => handleJobAction(job.name, 'run')} title="立即执行">
                      <Zap className="h-4 w-4 text-blue-500" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
