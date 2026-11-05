'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCheck,
  Trash2,
  RefreshCw,
  Megaphone,
  Info,
  Check,
} from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { DataTable, type Column } from '@/components/common/data-table';
import { Pagination } from '@/components/common/pagination';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useConfirm } from '@/hooks/use-confirm';
import { useNotification } from '@/hooks/use-notification';
import {
  notificationControllerFindAll,
  notificationControllerMarkAsRead,
  notificationControllerMarkAllAsRead,
  notificationControllerRemove,
} from '@/api/generated/endpoints/notification/notification';
import type { NotificationItemDto } from '@/api/generated/models';

export default function NotificationHistoryPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [type, setType] = useState<string>('all');
  const [isReadFilter, setIsReadFilter] = useState<string>('all');
  const { confirm, ConfirmDialog } = useConfirm();
  const { fetchUnreadCount } = useNotification();

  const queryParams = {
    page,
    pageSize,
    ...(type !== 'all' ? { type } : {}),
    ...(isReadFilter === 'read'
      ? { isRead: true }
      : isReadFilter === 'unread'
        ? { isRead: false }
        : {}),
  };

  const {
    data: response,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['notifications', page, pageSize, type, isReadFilter],
    queryFn: () => notificationControllerFindAll(queryParams),
  });

  const list = response?.data?.data || [];
  const total = response?.data?.pagination?.total || 0;
  const totalPages = response?.data?.pagination?.totalPages || 0;

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationControllerMarkAsRead(id);
      toast.success('已标记为已读');
      refetch();
      fetchUnreadCount();
    } catch {
      toast.error('操作失败');
    }
  };

  const handleMarkAllAsRead = async () => {
    const ok = await confirm({
      title: '全部已读',
      description: '确定将所有未读通知标记为已读吗？',
    });
    if (!ok) return;

    try {
      await notificationControllerMarkAllAsRead();
      toast.success('已全部标记为已读');
      refetch();
      fetchUnreadCount();
    } catch {
      toast.error('操作失败');
    }
  };

  const handleRemove = async (id: string) => {
    const ok = await confirm({
      title: '删除通知',
      description: '确定要删除这条通知吗？',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await notificationControllerRemove(id);
      toast.success('删除成功');
      refetch();
      fetchUnreadCount();
    } catch {
      toast.error('删除失败');
    }
  };

  const columns: Column<NotificationItemDto>[] = [
    {
      label: '类型',
      span: 1,
      render: (item) => {
        if (item.type === 'announcement') {
          return (
            <Badge variant="outline" className="gap-1 text-amber-500">
              <Megaphone className="h-3 w-3" />
              公告
            </Badge>
          );
        }
        return (
          <Badge variant="secondary" className="gap-1 text-blue-500">
            <Info className="h-3 w-3" />
            系统
          </Badge>
        );
      },
    },
    {
      label: '标题',
      span: 2,
      render: (item) => (
        <div className="flex items-center gap-2">
          {!item.isRead && (
            <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
          )}
          <span className={item.isRead ? 'text-muted-foreground' : 'font-medium'}>
            {item.title}
          </span>
        </div>
      ),
    },
    {
      label: '内容',
      span: 3,
      render: (item) => (
        <span className="line-clamp-1 text-xs text-muted-foreground">
          {item.content}
        </span>
      ),
    },
    {
      label: '发送人',
      span: 1,
      render: (item) => (
        <span className="text-xs text-muted-foreground">
          {item.senderName || '系统'}
        </span>
      ),
    },
    {
      label: '时间',
      span: 2,
      render: (item) => (
        <span className="text-xs text-muted-foreground">
          {new Date(item.createdAt).toLocaleString('zh-CN')}
        </span>
      ),
    },
    {
      label: '状态',
      span: 1,
      render: (item) =>
        item.isRead ? (
          <Badge variant="secondary" className="text-xs">
            已读
          </Badge>
        ) : (
          <Badge variant="destructive" className="text-xs">
            未读
          </Badge>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="通知中心"
        description="查看系统公告、业务消息与提醒历史"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="gap-1.5"
            >
              <CheckCheck className="h-4 w-4" />
              全部已读
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="gap-1.5"
            >
              <RefreshCw className="h-4 w-4" />
              刷新
            </Button>
          </div>
        }
      />

      <div className="flex items-center gap-3">
        <Select value={type} onValueChange={(val) => { setType(val); setPage(1); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="通知类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="announcement">系统公告</SelectItem>
            <SelectItem value="system">系统消息</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={isReadFilter}
          onValueChange={(val) => { setIsReadFilter(val); setPage(1); }}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="阅读状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="unread">未读</SelectItem>
            <SelectItem value="read">已读</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={list}
        isLoading={isLoading}
        emptyText="暂无通知记录"
        actions={(item) => (
          <div className="flex items-center gap-1">
            {!item.isRead && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleMarkAsRead(item.id)}
                title="标为已读"
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => handleRemove(item.id)}
              title="删除"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      />

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        totalPages={totalPages}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      <ConfirmDialog />
    </div>
  );
}
