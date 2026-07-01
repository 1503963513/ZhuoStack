---
name: file-upload
description: 集成文件/图片上传功能时使用。涵盖 @fastify/multipart 上传、FileService.saveFile、前端 FileUpload 组件、静态文件服务（开发 @fastify/static / 生产 Nginx）、SysFile 模型字段。
---

# 文件管理模块

本项目实现了统一的文件管理功能，包含上传、下载、预览、删除等操作。

## 架构概览

```
前端 FileUpload 组件 → POST /api/system/file/upload → FileService.saveFile() → uploads/目录 + sys_files 表
浏览器访问 /files/xxx → @fastify/static（本地开发）/ Nginx（生产环境）→ 直接返回文件
```

## 环境变量配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `FILE_STORAGE_PATH` | `uploads` | 存储目录，支持绝对路径和相对路径 |
| `FILE_URL_PREFIX` | `/files` | URL 前缀，数据库中存储的 URL 以此开头 |
| `FILE_MAX_SIZE_MB` | `50` | 最大文件大小（MB） |
| `FILE_ALLOWED_MIME_TYPES` | 18 种类型 | 允许的 MIME 类型（逗号分隔） |

**路径处理逻辑**：
- 绝对路径（如 `/www/test/uploads`）→ 直接使用
- 相对路径（如 `uploads`）→ 拼接 `process.cwd()`

## 后端接口

| 方法 | 路由 | 说明 | 权限 |
|------|------|------|------|
| POST | /api/system/file/upload | 上传文件 | 登录用户 |
| POST | /api/system/file/upload/image | 上传图片（5MB 限制） | 登录用户 |
| GET | /api/system/file | 分页查询 | 登录用户 |
| GET | /api/system/file/:id | 文件详情 | 登录用户 |
| PUT | /api/system/file/:id | 更新备注/状态 | ADMIN |
| DELETE | /api/system/file/:id | 删除文件 | ADMIN |
| DELETE | /api/system/file/batch | 批量删除 | ADMIN |
| GET | /api/system/file/download/:id | 下载文件 | 登录用户 |

**上传接口使用 `@fastify/multipart`**（不是 Express 的 multer），通过 `req.file()` 接收文件。

## 前端 FileUpload 组件

位于 `components/common/file-upload.tsx`，可复用的上传组件：

```tsx
import { FileUpload } from '@/components/common/file-upload';

// 单张图片上传（如头像）
<FileUpload
  mode="image"
  maxCount={1}
  value={avatar ? [{ id: 'avatar', url: avatar, originalName: '头像', fileSize: 0 }] : []}
  onChange={(files) => setAvatar(files[0]?.url || '')}
/>

// 多文件上传
<FileUpload
  mode="file"
  maxCount={5}
  value={files}
  onChange={setFiles}
/>
```

**组件特性**：
- `mode="image"`：仅允许图片，5MB 限制
- `mode="file"`：允许所有配置的 MIME 类型
- `maxCount`：最大文件数（1 = 单文件，0 = 不限）
- 拖拽上传、上传进度、预览缩略图
- 使用 XMLHttpRequest 实现进度回调

## 静态文件服务

### 本地开发
- Fastify `@fastify/static` 注册在 `main.ts`
- `/files/xxx` → `uploads/xxx`（或配置的存储目录）
- Next.js `next.config.mjs` 配置了 `/files/*` 代理到后端

### 生产环境
- Nginx 直接从磁盘读取 `/files/xxx`，不经过应用
- 应用只处理 `/api/*` 请求

```nginx
location /files/ {
    alias /www/test/uploads/;
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

## 数据库模型

`SysFile` 模型（`sys_files` 表）：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键（cuid） |
| fileName | String | 存储文件名（UUID.ext） |
| originalName | String | 原始文件名 |
| filePath | String | 相对路径（uploads/2026/06/03/xxx.ext） |
| url | String | 访问 URL（/files/2026/06/03/xxx.ext） |
| fileSize | Int | 文件大小（字节） |
| mimeType | String | MIME 类型 |
| ext | String | 扩展名 |
| storageType | String | 存储类型（默认 local） |
| md5 | String? | MD5 哈希 |
| status | Status | 状态（ACTIVE/INACTIVE） |
| remark | String? | 备注 |
| createBy | String? | 上传者 ID |

## 在其他模块中集成文件上传

### 后端：接收上传文件

```typescript
// controller 中
@Post('upload')
async upload(@Req() req: any, @CurrentUser('id') userId: string) {
  const data = await req.file(); // @fastify/multipart 的方法
  const buffer = await data.toBuffer();
  return this.fileService.saveFile(data.filename, data.mimetype, buffer, userId);
}
```

### 前端：使用 FileUpload 组件

```tsx
// 在表单中集成头像上传
<FileUpload
  mode="image"
  maxCount={1}
  value={formData.avatar ? [{ id: 'a', url: formData.avatar, originalName: '', fileSize: 0 }] : []}
  onChange={(files) => setFormData({ ...formData, avatar: files[0]?.url || '' })}
/>
```

### 前端：复制文件链接

```typescript
const url = `${window.location.origin}${file.url}`;
// HTTP 环境降级方案
if (navigator.clipboard) {
  navigator.clipboard.writeText(url);
} else {
  const textarea = document.createElement('textarea');
  textarea.value = url;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}
```

## 种子数据权限标识

| 权限标识 | 说明 |
|----------|------|
| `file:upload` | 上传文件 |
| `file:download` | 下载文件 |
| `file:delete` | 删除文件 |
| `file:edit` | 编辑文件信息 |

## 注意事项

1. **文件删除**：通过 `url` 反推磁盘路径（`url` 去掉 `urlPrefix` 前缀 → 拼接 `uploadsDir`），不使用 `filePath` 字段
2. **MIME 类型验证**：在 `FileService` 构造时从 `FILE_ALLOWED_MIME_TYPES` 读取，不在 controller 层硬编码
3. **图片上传**：固定 5MB 限制，仅允许 JPG/PNG/GIF/WebP
4. **`@fastify/multipart`**：使用 v8（兼容 Fastify 4.x），v10 需要 Fastify 5.x
5. **Prisma 模型同步**：新增模型后需手动复制到 `schema.active/models/` 并执行 `prisma:generate`
