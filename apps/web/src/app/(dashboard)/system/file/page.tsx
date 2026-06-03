'use client';

import { useState, useRef } from 'react';
import { useApiQuery } from '@/hooks/use-api';
import { useDebounce } from '@/hooks/use-debounce';
import { useConfirm } from '@/hooks/use-confirm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Upload,
  Download,
  Trash2,
  RefreshCw,
  Search,
  Image,
  FileText,
  Film,
  Music,
  Archive,
  File,
  Eye,
  X,
  Check,
  Copy,
} from 'lucide-react';
import { PermissionButton } from '@/components/common/permission-button';

interface FileItem {
  id: string;
  fileName: string;
  originalName: string;
  filePath: string;
  url: string;
  fileSize: number;
  mimeType: string;
  ext: string;
  storageType: string;
  md5: string | null;
  status: string;
  remark: string | null;
  createBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PaginatedResponse {
  data: FileItem[];
  pagination: { total: number; page: number; pageSize: number; totalPages: number };
}

/** 格式化文件大小 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/** 获取文件类型图标 */
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.startsWith('video/')) return Film;
  if (mimeType.startsWith('audio/')) return Music;
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return Archive;
  if (mimeType.includes('pdf') || mimeType.includes('word') || mimeType.includes('excel') || mimeType.includes('powerpoint') || mimeType.includes('text')) return FileText;
  return File;
}

/** 判断是否为图片 */
function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export default function FilePage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [mimeType, setMimeType] = useState('all');
  const debouncedSearch = useDebounce(search, 300);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  const { data, isLoading, refetch } = useApiQuery<PaginatedResponse>(
    ['files', String(page), debouncedSearch, mimeType],
    `/api/system/file?page=${page}&pageSize=12${debouncedSearch ? `&search=${debouncedSearch}` : ''}${mimeType !== 'all' ? `&mimeType=${mimeType}` : ''}`,
  );

  const files = data?.data?.data || [];
  const pagination = data?.data?.pagination;

  /** 上传文件 */
  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const { post } = await import('@/lib/api-client');

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const formData = new FormData();
        formData.append('file', file);

        setUploadProgress(Math.round(((i + 1) / fileList.length) * 100));

        // 使用 XMLHttpRequest 实现进度
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/system/file/upload');
          const stored = localStorage.getItem('auth-storage');
          if (stored) {
            try {
              const { state } = JSON.parse(stored);
              if (state?.token) {
                xhr.setRequestHeader('Authorization', `Bearer ${state.token}`);
              }
            } catch {}
          }

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const fileProgress = Math.round((e.loaded / e.total) * 100);
              setUploadProgress(Math.round(((i + fileProgress / 100) / fileList.length) * 100));
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`上传失败: ${xhr.statusText}`));
            }
          };

          xhr.onerror = () => reject(new Error('网络错误'));
          xhr.send(formData);
        });
      }

      toast.success(`成功上传 ${fileList.length} 个文件`);
      setUploadOpen(false);
      refetch();
    } catch (err: any) {
      toast.error('上传失败', { description: err.message });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  /** 拖拽上传 */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleUpload(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  /** 下载文件 */
  const handleDownload = (file: FileItem) => {
    const link = document.createElement('a');
    link.href = `/api/system/file/download/${file.id}`;
    link.download = file.originalName;
    link.click();
  };

  /** 删除文件 */
  const handleDelete = async (id: string) => {
    const ok = await confirm({ description: '确定要删除该文件吗？删除后不可恢复！', variant: 'destructive' });
    if (!ok) return;

    try {
      const { del } = await import('@/lib/api-client');
      await del(`/api/system/file/${id}`);
      toast.success('删除成功');
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      refetch();
    } catch (err: any) {
      toast.error('删除失败', { description: err.message });
    }
  };

  /** 批量删除 */
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) {
      toast.error('请先选择要删除的文件');
      return;
    }

    const ok = await confirm({
      description: `确定要删除选中的 ${selectedIds.size} 个文件吗？删除后不可恢复！`,
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      const apiClient = (await import('@/lib/api-client')).default;
      await apiClient.delete('/api/system/file/batch', { data: { ids: Array.from(selectedIds) } });
      toast.success(`成功删除 ${selectedIds.size} 个文件`);
      setSelectedIds(new Set());
      refetch();
    } catch (err: any) {
      toast.error('批量删除失败', { description: err.message });
    }
  };

  /** 切换选中 */
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  /** 全选/取消全选 */
  const toggleSelectAll = () => {
    if (selectedIds.size === files.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(files.map((f) => f.id)));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">文件管理</h1>
          <p className="text-muted-foreground">管理系统上传的文件</p>
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <Button variant="destructive" onClick={handleBatchDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              删除选中 ({selectedIds.size})
            </Button>
          )}
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
          <PermissionButton perm="file:upload" onClick={() => setUploadOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            上传文件
          </PermissionButton>
        </div>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索文件名"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={mimeType} onValueChange={(v) => { setMimeType(v); setPage(1); }}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="image">图片</SelectItem>
            <SelectItem value="video">视频</SelectItem>
            <SelectItem value="audio">音频</SelectItem>
            <SelectItem value="document">文档</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 文件列表 */}
      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">加载中...</div>
      ) : files.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">暂无文件</div>
      ) : (
        <>
          {/* 全选 */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              {selectedIds.size === files.length && files.length > 0 ? (
                <Check className="h-4 w-4 text-primary" />
              ) : (
                <div className="h-4 w-4 rounded border" />
              )}
              全选
            </button>
            {selectedIds.size > 0 && (
              <span className="text-sm text-muted-foreground">已选 {selectedIds.size} 个</span>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {files.map((file) => {
              const Icon = getFileIcon(file.mimeType);
              const selected = selectedIds.has(file.id);
              return (
                <Card
                  key={file.id}
                  className={`group relative cursor-pointer transition-colors ${selected ? 'ring-2 ring-primary' : 'hover:bg-muted/50'}`}
                  onClick={() => toggleSelect(file.id)}
                >
                  <CardContent className="p-4">
                    {/* 选中指示 */}
                    <div className="absolute top-2 left-2">
                      {selected ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : (
                        <div className="h-4 w-4 rounded border" />
                      )}
                    </div>

                    {/* 预览区域 */}
                    <div
                      className="mb-3 flex h-24 items-center justify-center rounded-md bg-muted/30 overflow-hidden"
                      onClick={(e) => { e.stopPropagation(); if (isImage(file.mimeType)) setPreviewFile(file); }}
                    >
                      {isImage(file.mimeType) ? (
                        <img
                          src={file.url}
                          alt={file.originalName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Icon className="h-10 w-10 text-muted-foreground" />
                      )}
                    </div>

                    {/* 文件信息 */}
                    <div className="space-y-1">
                      <p className="text-sm font-medium truncate" title={file.originalName}>
                        {file.originalName}
                      </p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatFileSize(file.fileSize)}</span>
                        <span>{file.ext.toUpperCase()}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(file.createdAt).toLocaleDateString('zh-CN')}
                      </p>
                    </div>

                    {/* 操作按钮 */}
                    <div className="mt-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isImage(file.mimeType) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); setPreviewFile(file); }}
                          title="预览"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          const url = `${window.location.origin}${file.url}`;
                          navigator.clipboard.writeText(url);
                          toast.success('链接已复制');
                        }}
                        title="复制链接"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <PermissionButton
                        perm="file:download"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleDownload(file); }}
                        title="下载"
                      >
                        <Download className="h-3 w-3" />
                      </PermissionButton>
                      <PermissionButton
                        perm="file:delete"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleDelete(file.id); }}
                        title="删除"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </PermissionButton>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* 分页 */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</Button>
          <span className="flex items-center px-4">第 {page} / {pagination.totalPages} 页</span>
          <Button variant="outline" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>下一页</Button>
        </div>
      )}

      {/* 上传对话框 */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>上传文件</DialogTitle>
            <DialogDescription>支持图片、文档、视频、音频、压缩包，单文件最大 50MB</DialogDescription>
          </DialogHeader>
          <div
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors hover:border-primary"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            {uploading ? (
              <div className="w-full space-y-2">
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  上传中... {uploadProgress}%
                </p>
              </div>
            ) : (
              <>
                <Upload className="mb-4 h-10 w-10 text-muted-foreground" />
                <p className="mb-2 text-sm text-muted-foreground">拖拽文件到此处，或点击选择文件</p>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  选择文件
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => handleUpload(e.target.files)}
                />
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 图片预览对话框 */}
      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewFile?.originalName}</DialogTitle>
            <DialogDescription>
              {previewFile && `${formatFileSize(previewFile.fileSize)} · ${previewFile.mimeType}`}
            </DialogDescription>
          </DialogHeader>
          {previewFile && (
            <div className="flex justify-center">
              <img
                src={previewFile.url}
                alt={previewFile.originalName}
                className="max-h-[60vh] rounded-md object-contain"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewFile(null)}>关闭</Button>
            {previewFile && (
              <Button onClick={() => handleDownload(previewFile)}>
                <Download className="mr-2 h-4 w-4" />
                下载
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog />
    </div>
  );
}
