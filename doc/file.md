# 文件管理模块设计方案

---

## 一、功能概述

为系统提供统一的文件上传、存储、管理能力，采用本地磁盘存储 + Nginx 静态代理的方式，支持图片分类与来源管理，满足中小规模项目的文件管理需求。

---

## 二、功能需求

### 2.1 后端文件上传

| 需求项         | 说明                                             |
| -------------- | ------------------------------------------------ |
| 文件上传接口   | 支持单文件/多文件上传                            |
| 存储方式       | 本地磁盘存储                                     |
| 目录规则       | 按 `uploads/年/月/`分目录，如 `uploads/2025/01/` |
| 文件命名       | UUID 重命名，保留原始扩展名                      |
| 存储路径可配置 | 通过环境变量配置存储根目录                       |
| 文件大小限制   | 可配置，默认 10MB                                |
| 文件类型白名单 | 后端严格校验 MIME + 扩展名                       |
| 文件去重       | 基于 MD5 哈希去重，相同文件只存一份              |
| 图片压缩       | 上传时自动压缩（可配置开关）                     |
| 缩略图         | 自动生成缩略图，用于列表展示                     |

---

### 2.2 前端文件管理

#### 2.2.1 页面位置

```
系统管理
└── 文件管理
```

#### 2.2.2 功能列表

| 功能       | 说明                                                   |
| ---------- | ------------------------------------------------------ |
| 文件列表   | 分页展示，支持搜索                                     |
| 多条件筛选 | 文件名、文件类型、分类、来源、上传时间范围             |
| 上传文件   | 弹窗上传，支持拖拽，显示进度条                         |
| 查看详情   | 文件名、大小、类型、分类、来源、上传人、上传时间、预览 |
| 删除       | 单个删除、批量删除                                     |
| 批量操作   | 批量修改分类、批量修改来源                             |
| 图片预览   | 点击缩略图放大查看原图                                 |
| 复制链接   | 一键复制文件访问地址                                   |

#### 2.2.3 列表字段

| 字段        | 说明                               |
| ----------- | ---------------------------------- |
| 缩略图/图标 | 图片显示缩略图，非图片显示类型图标 |
| 原始文件名  | 用户上传时的文件名                 |
| 分类        | 图片分类标签                       |
| 来源        | 图片来源标签                       |
| 文件大小    | 格式化显示（KB/MB）                |
| 上传人      | 上传操作的用户                     |
| 上传时间    | 格式：YYYY-MM-DD HH:mm             |
| 操作        | 查看 / 复制链接 / 删除             |

---

### 2.3 图片分类与来源

#### 2.3.1 分类（category）

通过字典表管理，可动态扩展：

| 编码        | 名称   |
| ----------- | ------ |
| avatar      | 头像   |
| product     | 产品图 |
| certificate | 证件照 |
| screenshot  | 截图   |
| banner      | 轮播图 |
| other       | 其他   |

#### 2.3.2 来源（source）

通过字典表管理，可动态扩展：

| 编码         | 名称     |
| ------------ | -------- |
| user_upload  | 用户上传 |
| admin_upload | 后台录入 |
| api_fetch    | 接口抓取 |
| crawl        | 爬虫采集 |
| import       | 数据导入 |

---

### 2.4 Nginx 静态代理

| 需求项         | 说明                                         |
| -------------- | -------------------------------------------- |
| 访问路径       | `/files/`开头的请求由 Nginx 直接返回静态文件 |
| 映射目录       | 指向应用配置的存储根目录                     |
| 缓存策略       | 静态资源设置 Cache-Control                   |
| 防盗链         | 配置 Referer 白名单（可选）                  |
| 路径前缀可配置 | 访问前缀通过环境变量配置，迁移时只需改配置   |

---

## 三、环境变量配置

```bash
# 文件存储根目录（服务器磁盘路径）
FILE_STORAGE_PATH=/var/www/uploads

# 文件访问 URL 前缀（和 Nginx 配置对应）
FILE_URL_PREFIX=/files

# 最大文件大小（MB）
FILE_MAX_SIZE=10

# 允许的文件扩展名（逗号分隔）
FILE_ALLOWED_EXTENSIONS=jpg,jpeg,png,gif,bmp,webp,pdf,doc,docx,xls,xlsx

# 是否开启图片压缩
FILE_IMAGE_COMPRESS=true

# 压缩质量（0-100）
FILE_IMAGE_QUALITY=80

# 缩略图宽度（px）
FILE_THUMB_WIDTH=200
```

---

## 四、数据库设计

### 4.1 文件记录表（file_record）

```sql
CREATE TABLE file_record (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键',
    original_name   VARCHAR(255) NOT NULL COMMENT '原始文件名',
    stored_name     VARCHAR(255) NOT NULL COMMENT '存储文件名（UUID）',
    file_path       VARCHAR(500) NOT NULL COMMENT '相对路径，如 2025/01/abc.jpg',
    file_size       BIGINT NOT NULL COMMENT '文件大小（字节）',
    file_type       VARCHAR(100) COMMENT 'MIME类型',
    file_extension  VARCHAR(20) COMMENT '扩展名',
    md5_hash        VARCHAR(64) COMMENT '文件MD5哈希',
    category        VARCHAR(50) COMMENT '分类',
    source          VARCHAR(50) COMMENT '来源',
    ref_count       INT DEFAULT 0 COMMENT '被引用次数',
    upload_user_id  BIGINT COMMENT '上传人ID',
    upload_user_name VARCHAR(100) COMMENT '上传人姓名',
    thumb_path      VARCHAR(500) COMMENT '缩略图相对路径',
    create_time     DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    INDEX idx_category (category),
    INDEX idx_source (source),
    INDEX idx_md5 (md5_hash),
    INDEX idx_create_time (create_time)
) COMMENT '文件记录表';
```

### 4.2 字典表（如已有则复用）

```sql
-- 文件分类字典
('file_category', '头像', 'avatar', 1),
('file_category', '产品图', 'product', 2),
('file_category', '证件照', 'certificate', 3),
('file_category', '截图', 'screenshot', 4),
('file_category', '轮播图', 'banner', 5),
('file_category', '其他', 'other', 6);

-- 文件来源字典
('file_source', '用户上传', 'user_upload', 1),
('file_source', '后台录入', 'admin_upload', 2),
('file_source', '接口抓取', 'api_fetch', 3),
('file_source', '爬虫采集', 'crawl', 4),
('file_source', '数据导入', 'import', 5);
```

---

## 五、接口设计

### 5.1 文件上传

```
POST /api/file/upload
Content-Type: multipart/form-data

参数：
  file        - 文件（必填）
  category    - 分类（选填）
  source      - 来源（选填）

返回：
	......
```

### 5.2 文件列表（分页查询）

```
GET /api/file/list
参数：
  originalName  - 文件名（模糊搜索）
  fileType      - 文件类型（image/*、application/*）
  category      - 分类
  source        - 来源
  startTime     - 上传开始时间
  endTime       - 上传结束时间

返回：
	......
```

### 5.3 文件详情

```
GET /api/file/{id}
返回：同列表单条数据，额外包含 md5Hash、filePath 等
```

### 5.4 删除文件

```
DELETE /api/file/{id}
逻辑删除，物理文件保留（或定时清理）
```

### 5.5 批量删除

```
POST /api/file/batchDelete
Body: { "ids": [1, 2, 3] }
```

### 5.6 批量更新分类/来源

```
POST /api/file/batchUpdate
Body: {
  "ids": [1, 2, 3],
  "category": "product",
  "source": "admin_upload"
}
```

### 5.7 前置检查接口（被引用时拦截删除）

```
DELETE /api/file/{id}
返回：
{
  "code": 400,
  "msg": "该文件被3条数据引用，无法删除"
}
```

---

## 六、Nginx 配置

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 静态文件直接返回
    location /files/ {
        alias /var/www/uploads/;

        # 缓存策略
        expires 30d;
        add_header Cache-Control "public, immutable";

        # 防盗链（可选）
        # valid_referers none blocked your-domain.com *.your-domain.com;
        # if ($invalid_referer) {
        #     return 403;
        # }

        # 允许跨域（可选）
        add_header Access-Control-Allow-Origin *;
    }

    # 应用接口
    location /api/ {
        proxy_pass http://127.0.0.1:8080;
    }

    # 前端资源
    location / {
        root /var/www/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 七、安全措施

| 措施         | 实现方式                                 |
| ------------ | ---------------------------------------- |
| 文件类型校验 | 后端校验扩展名 + MIME 类型白名单双重验证 |
| 文件名安全   | UUID 重命名，过滤路径遍历字符 `../`      |
| 大小限制     | 前后端双重限制                           |
| 上传权限     | 接口加权限校验，非管理员不可调用         |
| 删除保护     | ref_count > 0 时拒绝删除                 |
| 执行权限     | 上传目录禁止脚本执行（Nginx 配置）       |

---

## 八、存储目录结构

```
/www/uploads/                  ← FILE_STORAGE_PATH
├── 2024/
│   ├── 11/
│   │   ├── abc123.jpg
│   │   ├── abc123_thumb.jpg
│   │   └── def456.png
│   └── 12/
└── 2025/
    ├── 01/
    │   ├── ghi789.jpg
    │   └── ghi789_thumb.jpg
    └── 02/
```

访问地址：`http://your-domain.com/files/2025/01/ghi789.jpg`

---

## 九、引用计数管理

业务模块上传文件后，需调用引用计数接口：

```
POST /api/file/ref/increase  → { "id": 1 }  // 业务绑定时 +1
POST /api/file/ref/decrease  → { "id": 1 }  // 业务解绑时 -1
```

或者在各业务模块中通过监听器自动维护。

---

## 十、迁移 OSS 方案

当项目规模增长需要迁移 OSS 时：

1. **改配置** ：`FILE_URL_PREFIX` 改为 OSS 地址
2. **迁移文件** ：写脚本将本地文件批量上传 OSS
3. **数据库无需变动** ：因为只存相对路径
4. **Nginx 去掉 files 映射** ：请求直接打到 OSS/CDN

---
