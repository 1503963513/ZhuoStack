'use client';

import { useState, useRef, type ReactNode } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { fileUrl } from '@/lib/utils';
import { CSRF_HEADER_NAME, getCsrfToken } from '@/lib/csrf';
import { Upload, X, Loader2 } from 'lucide-react';

interface UploadedFile {
  id: string;
  url: string;
  originalName: string;
  fileSize: number;
}

interface FileUploadProps {
  /** 上传模式 */
  mode?: 'file' | 'image';
  /** 最大文件数（0 表示不限） */
  maxCount?: number;
  /** 已上传的文件列表 */
  value?: UploadedFile[];
  /** 上传完成回调 */
  onChange?: (files: UploadedFile[]) => void;
  /** 自定义触发按钮 */
  children?: ReactNode;
  /** 接受的文件类型 */
  accept?: string;
  /** 按钮变体 */
  variant?: 'default' | 'outline' | 'ghost';
  /** 按钮大小 */
  size?: 'default' | 'sm' | 'lg';
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * 可复用的文件上传组件
 *
 * @example
 * // 图片上传（单张）
 * <FileUpload mode="image" value={avatar} onChange={setAvatar} />
 *
 * // 文件上传（多张）
 * <FileUpload mode="file" maxCount={5} value={files} onChange={setFiles} />
 */
export function FileUpload({
  mode = 'file',
  maxCount = 1,
  value = [],
  onChange,
  children,
  accept,
  variant = 'outline',
  size = 'default',
  disabled = false,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptTypes = accept || (mode === 'image' ? 'image/jpeg,image/png,image/gif,image/webp' : undefined);

  /** 文件大小限制（字节）：普通文件 50MB，图片 5MB */
  const maxSizeBytes = mode === 'image' ? 5 * 1024 * 1024 : 50 * 1024 * 1024;

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    // 检查数量限制
    if (maxCount > 0 && value.length + fileList.length > maxCount) {
      toast.error(`最多上传 ${maxCount} 个文件`);
      return;
    }

    // 前端预检文件大小，避免上传到一半才报错
    const oversized = Array.from(fileList).find((f) => f.size > maxSizeBytes);
    if (oversized) {
      const maxLabel = mode === 'image' ? '5MB' : '50MB';
      toast.error(`文件「${oversized.name}」超过 ${maxLabel} 大小限制`);
      return;
    }

    setUploading(true);

    try {
      const uploaded: UploadedFile[] = [];

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const formData = new FormData();
        formData.append('file', file);

        const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
        const endpoint = mode === 'image'
          ? `${apiBase}/api/system/file/upload/image`
          : `${apiBase}/api/system/file/upload`;

        const result = await new Promise<UploadedFile>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', endpoint);
          xhr.withCredentials = true;
          const csrfToken = getCsrfToken();
          if (csrfToken) xhr.setRequestHeader(CSRF_HEADER_NAME, csrfToken);

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              const json = JSON.parse(xhr.responseText);
              resolve(json.data || json);
            } else {
              // 尝试从后端响应中提取错误信息
              try {
                const json = JSON.parse(xhr.responseText);
                reject(new Error(json.message || `上传失败 (${xhr.status})`));
              } catch {
                reject(new Error(`上传失败: ${xhr.statusText || '服务器错误'} (${xhr.status})`));
              }
            }
          };

          xhr.onerror = () => reject(new Error('网络错误，请检查网络连接'));
          xhr.send(formData);
        });

        uploaded.push({
          id: result.id,
          url: result.url,
          originalName: result.originalName || file.name,
          fileSize: result.fileSize || file.size,
        });
      }

      const newFiles = maxCount === 1 ? uploaded : [...value, ...uploaded];
      onChange?.(newFiles);
      toast.success(`成功上传 ${uploaded.length} 个文件`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '上传失败';
      toast.error('上传失败', { description: message });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = (index: number) => {
    const newFiles = value.filter((_, i) => i !== index);
    onChange?.(newFiles);
  };

  return (
    <div className="space-y-2">
      {/* 已上传文件列表 */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((file, index) => (
            <div key={file.id} className="group relative">
              {mode === 'image' ? (
                <div className="relative h-20 w-20 overflow-hidden rounded-md border">
                  <Image
                    src={fileUrl(file.url) ?? file.url}
                    alt={file.originalName}
                    fill
                    sizes="80px"
                    className="h-full w-full object-cover"
                  />
                  {!disabled && (
                    <button
                      onClick={() => handleRemove(index)}
                      className="absolute right-0 top-0 rounded-bl-md bg-destructive p-0.5 text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                  <span className="max-w-[150px] truncate">{file.originalName}</span>
                  {!disabled && (
                    <button
                      onClick={() => handleRemove(index)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 上传按钮 */}
      {((maxCount === 0) || (maxCount > 0 && value.length < maxCount)) && !disabled && (
        <>
          {children ? (
            <div onClick={() => fileInputRef.current?.click()} className="cursor-pointer">
              {children}
            </div>
          ) : (
            <Button
              type="button"
              variant={variant}
              size={size}
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {uploading ? '上传中...' : (mode === 'image' ? '上传图片' : '上传文件')}
            </Button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptTypes}
            multiple={maxCount !== 1}
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
        </>
      )}
    </div>
  );
}
