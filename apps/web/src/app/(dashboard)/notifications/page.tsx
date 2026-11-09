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
  Plus,
} from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { DataTable, type Column } from '@/components/common/data-table';
import { Pagination } from '@/components/common/pagination';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
import { useConfirm } from '@/hooks/use-confirm';
import { useNotification } from '@/hooks/use-notification';
import {
  notificationControllerFindAll,
  notificationControllerMarkAsRead,
  notificationControllerMarkAllAsRead,
  notificationControllerRemove,
  notificationControllerCreateAnnouncement,
  notificationControllerSendNotification,
} from '@/api/generated/endpoints/notification/notification';
import { userControllerFindAll } from '@/api/generated/endpoints/user/user';
import type { NotificationItemDto, UserItemDto } from '@/api/generated/models';

export default function NotificationHistoryPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [type, setType] = useState<string>('all');
  const [isReadFilter, setIsReadFilter] = useState<string>('all');
  const { confirm, ConfirmDialog } = useConfirm();
  const { fetchUnreadCount } = useNotification();

  // 发布弹窗状态
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createType, setCreateType] = useState<'announcement' | 'system'>('announcement');
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    userId: '',
    remark: '',
  });

  // 当选择“个人系统消息”时，动态加载用户列表供选择
  const { data: usersResponse, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['users-for-notification'],
    queryFn: () => userControllerFindAll({ page: 1, pageSize: 100 }),
    enabled: dialogOpen && createType === 'system',
  });
  const userList: UserItemDto[] = usersResponse?.data?.data || [];

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

  const handleOpenDialog = () => {
    setFormData({
      title: '',
      content: '',
      userId: '',
      remark: '',
    });
    setCreateType('announcement');
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('请输入标题');
      return;
    }
    if (!formData.content.trim()) {
      toast.error('请输入内容');
      return;
    }

    setIsSubmitting(true);
    try {
      if (createType === 'announcement') {
        await notificationControllerCreateAnnouncement({
          title: formData.title.trim(),
          content: formData.content.trim(),
          status: 'published',
          remark: formData.remark.trim() || undefined,
        });
        toast.success('公告发布成功');
      } else {
        if (!formData.userId) {
          toast.error('请选择目标用户');
          setIsSubmitting(false);
          return;
        }
        await notificationControllerSendNotification({
          title: formData.title.trim(),
          content: formData.content.trim(),
          userId: formData.userId,
          remark: formData.remark.trim() || undefined,
        });
        toast.success('个人消息发送成功');
      }
      setDialogOpen(false);
      refetch();
      fetchUnreadCount();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '发送失败');
    } finally {
      setIsSubmitting(false);
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
              size="sm"
              onClick={handleOpenDialog}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              发布通知 / 公告
            </Button>
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

      {/* 发布通知 / 公告弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>发布通知 / 公告</DialogTitle>
            <DialogDescription>
              向系统全体用户发布全员公告，或向指定单个用户发送个人系统消息。
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>类型 *</Label>
              <Select
                value={createType}
                onValueChange={(val: 'announcement' | 'system') => setCreateType(val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="announcement">系统公告（全体用户可见）</SelectItem>
                  <SelectItem value="system">个人系统消息（指定用户单发）</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {createType === 'system' && (
              <div className="space-y-2">
                <Label>目标用户 *</Label>
                <Select
                  value={formData.userId}
                  onValueChange={(val) => setFormData({ ...formData, userId: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingUsers ? '正在加载用户列表...' : '请选择接收用户'} />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {userList.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name || u.email} ({u.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notice-title">标题 *</Label>
              <Input
                id="notice-title"
                required
                maxLength={100}
                placeholder={createType === 'announcement' ? '例如：系统维护通知 / 版本更新公告' : '例如：审批待处理 / 任务提醒'}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notice-content">内容 *</Label>
              <Textarea
                id="notice-content"
                required
                rows={4}
                maxLength={500}
                placeholder="请输入详细内容..."
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notice-remark">备注（选填）</Label>
              <Input
                id="notice-remark"
                placeholder="内部备注信息"
                value={formData.remark}
                onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isSubmitting}
              >
                取消
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? '发送中...' : '立即发送'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog />
    </div>
  );
}
