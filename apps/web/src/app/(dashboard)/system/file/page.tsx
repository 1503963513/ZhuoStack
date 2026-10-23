'use client';

import { useState, useRef } from 'react';
import NextImage from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/use-debounce';
import { useConfirm } from '@/hooks/use-confirm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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
import { toast } from 'sonner';
import { fileUrl } from '@/lib/utils';
import { CSRF_HEADER_NAME, getCsrfToken } from '@/lib/csrf';
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
  Check,
  Copy,
} from 'lucide-react';
import { PermissionButton } from '@/components/common/permission-button';
import { Pagination } from '@/components/common/pagination';
import {
  fileControllerFindAll,
  fileControllerRemove,
  fileControllerRemoveBatch,
} from '@/api/generated/endpoints/系统-文件管理/系统-文件管理';
import type { FileEntity } from '@/api/generated/models';

/** 格式化文件大小 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/** 获取文件类型图标 */
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.startsWith('video/')) return Film;
  if (mimeType.startsWith('audio/')) return Music;
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z'))
    return Archive;
  if (
    mimeType.includes('pdf') ||
    mimeType.includes('word') ||
    mimeType.includes('excel') ||
    mimeType.includes('powerpoint') ||
    mimeType.includes('text')
  )
    return FileText;
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
  const [previewFile, setPreviewFile] = useState<FileEntity | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  const {
    data: response,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['files', page, debouncedSearch, mimeType],
    queryFn: () =>
      fileControllerFindAll({
        page,
        pageSize: 12,
        search: debouncedSearch || undefined,
        mimeType: mimeType !== 'all' ? mimeType : undefined,
      }),
  });

  const files = response?.data?.data || [];
  const pagination = response?.data?.pagination || {
    total: 0,
    page: 1,
    pageSize: 12,
    totalPages: 0,
  };

  /** 文件大小限制：50MB */
  const MAX_FILE_SIZE = 50 * 1024 * 1024;

  /** 上传文件 */
  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const oversized = Array.from(fileList).find((f) => f.size > MAX_FILE_SIZE);
    if (oversized) {
      toast.error(`文件「${oversized.name}」超过 50MB 大小限制`);
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const formData = new FormData();
        formData.append('file', file);

        const endpoint = `${process.env.NEXT_PUBLIC_API_URL || ''}/api/system/file/upload`;

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', endpoint);
          xhr.withCredentials = true;

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percent = Math.round((event.loaded / event.total) * 100);
              setUploadProgress(percent);
            }
          };

          const csrfToken = getCsrfToken();
          if (csrfToken) xhr.setRequestHeader(CSRF_HEADER_NAME, csrfToken);

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const json = JSON.parse(xhr.responseText);
                if (
                  json &&
                  typeof json === 'object' &&
                  'code' in json &&
                  (json as { code: number }).code >= 400
                ) {
                  reject(
                    new Error(
                      (json as { message?: string }).message || `文件「${file.name}」上传失败`,
                    ),
                  );
                  return;
                }
                resolve();
              } catch {
                reject(new Error(`文件「${file.name}」上传响应格式无效`));
              }
            } else {
              try {
                const json = JSON.parse(xhr.responseText);
                reject(new Error(json.message || `文件「${file.name}」上传失败`));
              } catch {
                reject(new Error(`文件「${file.name}」上传失败 (${xhr.status})`));
              }
            }
          };

          xhr.onerror = () => reject(new Error('网络错误，请检查网络连接'));
          xhr.send(formData);
        });
      }

      toast.success(`成功上传 ${fileList.length} 个文件`);
      setUploadOpen(false);
      refetch();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '上传失败';
      toast.error('上传失败', { description: message });
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
  const handleDownload = async (file: FileEntity) => {
    try {
      const { default: apiClient } = await import('@/lib/api-client');
      const res = await apiClient.get(`/api/system/file/download/${file.id}`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: file.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.originalName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '下载失败';
      toast.error('下载失败', { description: message });
    }
  };

  /** 单个删除 */
  const handleDelete = async (id: string) => {
    const ok = await confirm({
      description: '确定要删除该文件吗？此操作不可恢复。',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await fileControllerRemove(id);
      toast.success('删除成功');
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      refetch();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '删除失败';
      toast.error('删除失败', { description: message });
    }
  };

  /** 批量删除 */
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    const ok = await confirm({
      description: `确定要删除选中的 ${selectedIds.size} 个文件吗？此操作不可恢复。`,
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await fileControllerRemoveBatch({ ids: Array.from(selectedIds) });
      toast.success(`成功删除 ${selectedIds.size} 个文件`);
      setSelectedIds(new Set());
      refetch();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '批量删除失败';
      toast.error('批量删除失败', { description: message });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === files.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(files.map((f) => f.id)));
    }
  };

  const copyUrl = (url: string) => {
    const full = fileUrl(url || '') || '';
    navigator.clipboard.writeText(full);
    toast.success('已复制链接到剪贴板');
  };

  return (
    <div className="space-y-6">
      {/* 顶部标题与操作栏 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">文件管理</h1>
          <p className="text-muted-foreground">管理系统上传的文件与图片资源</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <PermissionButton
              perm="file:delete"
              variant="destructive"
              size="sm"
              onClick={handleBatchDelete}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              删除选中 ({selectedIds.size})
            </PermissionButton>
          )}
          <Button variant="outline" size="icon" onClick={() => refetch()} title="刷新">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <PermissionButton perm="file:upload" onClick={() => setUploadOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            上传文件
          </PermissionButton>
        </div>
      </div>

      {/* 搜索与筛选 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索文件名称..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={mimeType}
          onValueChange={(val) => {
            setMimeType(val);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="全部类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="image/">图片</SelectItem>
            <SelectItem value="video/">视频</SelectItem>
            <SelectItem value="audio/">音频</SelectItem>
            <SelectItem value="application/pdf">PDF</SelectItem>
            <SelectItem value="application/zip">压缩包</SelectItem>
          </SelectContent>
        </Select>
        {files.length > 0 && (
          <Button variant="ghost" size="sm" onClick={selectAll}>
            <Check className="mr-1 h-4 w-4" />
            {selectedIds.size === files.length ? '取消全选' : '全选'}
          </Button>
        )}
      </div>

      {/* 文件网格 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : files.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Upload className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">暂无文件</p>
            <p className="text-sm text-muted-foreground/75 mt-1">点击右上角「上传文件」按钮添加</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {files.map((file) => {
            const isSelected = selectedIds.has(file.id);
            const isImg = isImage(file.mimeType);
            const FileIconComponent = getFileIcon(file.mimeType);

            return (
              <Card
                key={file.id}
                className={`group relative overflow-hidden transition-all hover:shadow-md cursor-pointer ${
                  isSelected ? 'ring-2 ring-primary border-primary' : ''
                }`}
                onClick={() => toggleSelect(file.id)}
              >
                <div className="relative aspect-square w-full overflow-hidden bg-muted flex items-center justify-center">
                  {isImg ? (
                    <NextImage
                      src={fileUrl(file.url || '') || ''}
                      alt={file.originalName}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 16vw"
                      className="object-cover transition-transform group-hover:scale-105"
                      unoptimized
                    />
                  ) : (
                    <FileIconComponent className="h-12 w-12 text-muted-foreground/50" />
                  )}

                  <div
                    className={`absolute top-2 left-2 h-5 w-5 rounded border bg-background flex items-center justify-center transition-opacity ${
                      isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                  </div>

                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 p-2">
                    {isImg && (
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8 rounded-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewFile(file);
                        }}
                        title="预览"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8 rounded-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyUrl(file.url);
                      }}
                      title="复制链接"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8 rounded-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(file);
                      }}
                      title="下载"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <PermissionButton
                      perm="file:delete"
                      size="icon"
                      variant="destructive"
                      className="h-8 w-8 rounded-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(file.id);
                      }}
                      title="删除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </PermissionButton>
                  </div>
                </div>

                <div className="p-2 space-y-0.5">
                  <p className="text-xs font-medium truncate" title={file.originalName}>
                    {file.originalName}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatFileSize(file.fileSize)}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 分页 */}
      {pagination && (
        <Pagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          totalPages={pagination.totalPages}
          onPageChange={setPage}
        />
      )}

      {/* 上传弹窗 */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>上传文件</DialogTitle>
            <DialogDescription>支持单文件或多文件上传，单个文件不超过 50MB。</DialogDescription>
          </DialogHeader>

          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              uploading ? 'bg-muted/50 cursor-not-allowed' : 'hover:bg-muted/30 cursor-pointer'
            }`}
            onClick={() => !uploading && fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
              disabled={uploading}
            />
            <div className="flex flex-col items-center justify-center space-y-2">
              <Upload
                className={`h-8 w-8 ${uploading ? 'animate-bounce text-primary' : 'text-muted-foreground'}`}
              />
              <div className="text-sm font-medium">
                {uploading ? `正在上传 (${uploadProgress}%)...` : '点击选择文件，或拖拽文件到此处'}
              </div>
              <p className="text-xs text-muted-foreground">
                支持常见文档、图片、视频、音频和压缩包
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={uploading}>
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 图片预览弹窗 */}
      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewFile?.originalName}</DialogTitle>
            <DialogDescription>
              大小: {previewFile && formatFileSize(previewFile.fileSize)} | 类型:{' '}
              {previewFile?.mimeType}
            </DialogDescription>
          </DialogHeader>
          <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted flex items-center justify-center">
            {previewFile && isImage(previewFile.mimeType) && (
              <NextImage
                src={fileUrl(previewFile.url || '') || ''}
                alt={previewFile.originalName}
                fill
                className="object-contain"
                unoptimized
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => previewFile && copyUrl(previewFile.url)}>
              <Copy className="mr-2 h-4 w-4" />
              复制链接
            </Button>
            <Button variant="default" onClick={() => previewFile && handleDownload(previewFile)}>
              <Download className="mr-2 h-4 w-4" />
              下载
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog />
    </div>
  );
}
