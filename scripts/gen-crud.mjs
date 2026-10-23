#!/usr/bin/env node

/**
 * ZhuoStack CRUD 模块骨架生成器
 *
 * 作用：为新业务快速生成一套简单、可读、容易修改的全栈 CRUD 骨架代码：
 * 1. 后端：Prisma Schema (PG + MySQL)、DTO、Controller、Service、Module
 * 2. 前端：Next.js App Router 页面 (PageHeader + DataTable + Pagination + Dialog)
 * 3. 权限：菜单与按钮权限 Seed 片段
 *
 * 使用方式：
 *   node scripts/gen-crud.mjs <模块名> <中文名> [字段定义...]
 *
 * 示例：
 *   node scripts/gen-crud.mjs banner 轮播图 title:string:标题:search url:string:跳转链接 sort:number:排序 status:enum:状态
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// 字符串转换辅助工具
const toPascalCase = (str) =>
  str.replace(/(^\w|-\w)/g, (clear) => clear.replace('-', '').toUpperCase());

const toCamelCase = (str) => {
  const p = toPascalCase(str);
  return p.charAt(0).toLowerCase() + p.slice(1);
};

const toSnakeCase = (str) =>
  str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');

// 解析命令行参数
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log(`
📋 使用方式:
  node scripts/gen-crud.mjs <模块名> <中文名> [字段列表...]

示例:
  node scripts/gen-crud.mjs banner 轮播图 title:string:标题:search url:string:链接 sort:number:排序 status:enum:状态

字段格式:
  字段名:类型:中文名[:search]
  支持的类型: string, number, enum, text
`);
  process.exit(1);
}

const moduleName = args[0].toLowerCase();
const moduleLabel = args[1];
const fieldArgs = args.slice(2);

// 解析字段
const fields = fieldArgs.map((arg) => {
  const [name, type = 'string', label = name, isSearch] = arg.split(':');
  return {
    name,
    type,
    label,
    isSearch: isSearch === 'search',
  };
});

// 如果没有指定字段，给一组通用默认字段
if (fields.length === 0) {
  fields.push(
    { name: 'name', type: 'string', label: `${moduleLabel}名称`, isSearch: true },
    { name: 'sort', type: 'number', label: '显示排序', isSearch: false },
    { name: 'status', type: 'enum', label: '状态', isSearch: false },
    { name: 'remark', type: 'text', label: '备注', isSearch: false },
  );
}

const pascal = toPascalCase(moduleName);
const camel = toCamelCase(moduleName);
const snake = toSnakeCase(moduleName);
const pluralSnake = snake.endsWith('s') ? snake : `${snake}s`;

console.log(`\n🚀 开始为「${moduleLabel} (${moduleName})」生成 CRUD 骨架...`);

// 确保目录存在
const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// 写入文件（安全覆盖前提示）
const writeFile = (filePath, content) => {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content.trimStart(), 'utf-8');
  console.log(`  ✓ 生成: ${path.relative(ROOT_DIR, filePath)}`);
};

// =============================================================================
// 1. 生成 Prisma Schema (Postgres & MySQL)
// =============================================================================

function generatePrismaModel(dbType) {
  const isMysql = dbType === 'mysql';
  const lines = [];

  lines.push(`model ${pascal} {`);
  lines.push(`  id        String   @id @default(cuid())`);

  for (const f of fields) {
    if (f.name === 'id') continue;
    if (f.type === 'string') {
      const typeStr = isMysql ? 'String   @db.VarChar(255)' : 'String';
      lines.push(`  ${f.name.padEnd(9)} ${typeStr}`);
    } else if (f.type === 'number') {
      lines.push(`  ${f.name.padEnd(9)} Int      @default(0)`);
    } else if (f.type === 'enum') {
      lines.push(`  ${f.name.padEnd(9)} Status   @default(ACTIVE)`);
    } else if (f.type === 'text') {
      const typeStr = isMysql ? 'String?  @db.Text' : 'String?';
      lines.push(`  ${f.name.padEnd(9)} ${typeStr}`);
    }
  }

  lines.push(`  createdAt DateTime @default(now())`);
  lines.push(`  updatedAt DateTime @updatedAt`);
  lines.push(``);
  lines.push(`  @@map("${pluralSnake}")`);
  lines.push(`}`);
  lines.push(``);

  return lines.join('\n');
}

writeFile(
  path.join(ROOT_DIR, `apps/api/prisma/postgres/models/${moduleName}.prisma`),
  generatePrismaModel('postgres'),
);

writeFile(
  path.join(ROOT_DIR, `apps/api/prisma/mysql/models/${moduleName}.prisma`),
  generatePrismaModel('mysql'),
);

// =============================================================================
// 2. 生成后端 DTO
// =============================================================================

const dtoDir = path.join(ROOT_DIR, `apps/api/src/modules/${moduleName}/dto`);

// Create DTO
const createDtoContent = `import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { Status } from '@prisma/client';

export class Create${pascal}Dto {
${fields
  .map((f) => {
    if (f.type === 'string') {
      return `  @ApiProperty({ description: '${f.label}' })
  @IsNotEmpty({ message: '${f.label}不能为空' })
  @IsString()
  ${f.name}: string;\n`;
    }
    if (f.type === 'number') {
      return `  @ApiPropertyOptional({ description: '${f.label}', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  ${f.name}?: number = 0;\n`;
    }
    if (f.type === 'enum') {
      return `  @ApiPropertyOptional({ enum: Status, description: '${f.label}', default: Status.ACTIVE })
  @IsOptional()
  ${f.name}?: Status = Status.ACTIVE;\n`;
    }
    if (f.type === 'text') {
      return `  @ApiPropertyOptional({ description: '${f.label}' })
  @IsOptional()
  @IsString()
  ${f.name}?: string;\n`;
    }
    return '';
  })
  .join('\n')}
}
`;
writeFile(path.join(dtoDir, `create-${moduleName}.dto.ts`), createDtoContent);

// Update DTO
const updateDtoContent = `import { PartialType } from '@nestjs/swagger';
import { Create${pascal}Dto } from './create-${moduleName}.dto';

export class Update${pascal}Dto extends PartialType(Create${pascal}Dto) {}
`;
writeFile(path.join(dtoDir, `update-${moduleName}.dto.ts`), updateDtoContent);

// Query DTO
const searchField = fields.find((f) => f.isSearch) || fields.find((f) => f.type === 'string');
const queryDtoContent = `import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class Query${pascal}Dto {
  @ApiPropertyOptional({ description: '当前页码', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页条数', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 10;

  @ApiPropertyOptional({ description: '搜索关键词' })
  @IsOptional()
  @IsString()
  search?: string;
}
`;
writeFile(path.join(dtoDir, `query-${moduleName}.dto.ts`), queryDtoContent);

// Response DTO
const responseDtoContent = `import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Status } from '@prisma/client';

export class ${pascal}ItemDto {
  @ApiProperty({ description: '唯一 ID' })
  id: string;

${fields
  .map((f) => {
    if (f.type === 'string') {
      return `  @ApiProperty({ description: '${f.label}' })\n  ${f.name}: string;\n`;
    }
    if (f.type === 'number') {
      return `  @ApiProperty({ description: '${f.label}' })\n  ${f.name}: number;\n`;
    }
    if (f.type === 'enum') {
      return `  @ApiProperty({ enum: Status, description: '${f.label}' })\n  ${f.name}: Status;\n`;
    }
    if (f.type === 'text') {
      return `  @ApiPropertyOptional({ type: String, description: '${f.label}', nullable: true })\n  ${f.name}: string | null;\n`;
    }
    return '';
  })
  .join('\n')}
  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}
`;
writeFile(path.join(dtoDir, `${moduleName}-response.dto.ts`), responseDtoContent);

// DTO index
const dtoIndexContent = `export * from './create-${moduleName}.dto';
export * from './update-${moduleName}.dto';
export * from './query-${moduleName}.dto';
export * from './${moduleName}-response.dto';
`;
writeFile(path.join(dtoDir, 'index.ts'), dtoIndexContent);

// =============================================================================
// 3. 生成后端 Service & Controller & Module
// =============================================================================

const backendDir = path.join(ROOT_DIR, `apps/api/src/modules/${moduleName}`);

// Service
const serviceContent = `import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Create${pascal}Dto, Update${pascal}Dto, Query${pascal}Dto } from './dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ${pascal}Service {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 创建${moduleLabel}
   */
  async create(dto: Create${pascal}Dto) {
    return this.prisma.${camel}.create({
      data: dto as unknown as Prisma.${pascal}CreateInput,
    });
  }

  /**
   * 分页查询${moduleLabel}列表
   */
  async findAll(query: Query${pascal}Dto) {
    const { page = 1, pageSize = 10, search } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.${pascal}WhereInput = search
      ? {
          ${searchField ? `${searchField.name}: { contains: search },` : ''}
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.${camel}.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.${camel}.count({ where }),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 获取${moduleLabel}详情
   */
  async findOne(id: string) {
    const item = await this.prisma.${camel}.findUnique({
      where: { id },
    });
    if (!item) {
      throw new NotFoundException('${moduleLabel}不存在');
    }
    return item;
  }

  /**
   * 更新${moduleLabel}
   */
  async update(id: string, dto: Update${pascal}Dto) {
    await this.findOne(id);
    return this.prisma.${camel}.update({
      where: { id },
      data: dto as unknown as Prisma.${pascal}UpdateInput,
    });
  }

  /**
   * 删除${moduleLabel}
   */
  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.${camel}.delete({
      where: { id },
    });
    return { message: '删除成功' };
  }
}
`;
writeFile(path.join(backendDir, `${moduleName}.service.ts`), serviceContent);

// Controller
const controllerContent = `import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ${pascal}Service } from './${moduleName}.service';
import { Create${pascal}Dto, Update${pascal}Dto, Query${pascal}Dto, ${pascal}ItemDto } from './dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  ApiResultResponse,
  ApiPaginatedResultResponse,
  ApiErrorResponse,
} from '../../common/decorators/api-result.decorator';
import { SimpleMessageResponseDto } from '../user/dto/user-response.dto';
import { Role } from '@prisma/client';

@ApiTags('${moduleLabel}管理')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('${moduleName}')
export class ${pascal}Controller {
  constructor(private readonly ${camel}Service: ${pascal}Service) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '创建${moduleLabel}' })
  @ApiResultResponse(${pascal}ItemDto, { status: HttpStatus.CREATED, description: '创建成功' })
  create(@Body() dto: Create${pascal}Dto) {
    return this.${camel}Service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: '获取${moduleLabel}分页列表' })
  @ApiPaginatedResultResponse(${pascal}ItemDto, { description: '获取成功' })
  findAll(@Query() query: Query${pascal}Dto) {
    return this.${camel}Service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取${moduleLabel}详情' })
  @ApiParam({ name: 'id', description: '${moduleLabel} ID' })
  @ApiResultResponse(${pascal}ItemDto, { description: '获取成功' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, '${moduleLabel}不存在')
  findOne(@Param('id') id: string) {
    return this.${camel}Service.findOne(id);
  }

  @Put(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '更新${moduleLabel}' })
  @ApiParam({ name: 'id', description: '${moduleLabel} ID' })
  @ApiResultResponse(${pascal}ItemDto, { description: '更新成功' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, '${moduleLabel}不存在')
  update(@Param('id') id: string, @Body() dto: Update${pascal}Dto) {
    return this.${camel}Service.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '删除${moduleLabel}' })
  @ApiParam({ name: 'id', description: '${moduleLabel} ID' })
  @ApiResultResponse(SimpleMessageResponseDto, { description: '删除成功' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, '${moduleLabel}不存在')
  remove(@Param('id') id: string) {
    return this.${camel}Service.remove(id);
  }
}
`;
writeFile(path.join(backendDir, `${moduleName}.controller.ts`), controllerContent);

// Module
const moduleContent = `import { Module } from '@nestjs/common';
import { ${pascal}Controller } from './${moduleName}.controller';
import { ${pascal}Service } from './${moduleName}.service';

@Module({
  controllers: [${pascal}Controller],
  providers: [${pascal}Service],
  exports: [${pascal}Service],
})
export class ${pascal}Module {}
`;
writeFile(path.join(backendDir, `${moduleName}.module.ts`), moduleContent);

// =============================================================================
// 4. 生成前端 CRUD 页面
// =============================================================================

const frontendPageDir = path.join(ROOT_DIR, `apps/web/src/app/(dashboard)/${moduleName}`);

const pageContent = `'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/use-debounce';
import { useConfirm } from '@/hooks/use-confirm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { PermissionButton } from '@/components/common/permission-button';
import { PageHeader } from '@/components/common/page-header';
import { DataTable, type Column } from '@/components/common/data-table';
import { Pagination } from '@/components/common/pagination';
import { customInstance } from '@/lib/api-mutator';

// 本地声明基础展示接口，并在运行 pnpm contract:sync 后自动对齐生成端点
interface ${pascal}Item {
  id: string;
${fields
  .map((f) => {
    if (f.type === 'number') return `  ${f.name}: number;`;
    if (f.type === 'enum') return `  ${f.name}: 'ACTIVE' | 'INACTIVE';`;
    return `  ${f.name}: string;`;
  })
  .join('\n')}
  createdAt: string;
}

interface PaginatedResponse {
  data: ${pascal}Item[];
  pagination: { total: number; page: number; pageSize: number; totalPages: number };
}

export default function ${pascal}Page() {
  const { confirm, ConfirmDialog } = useConfirm();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<${pascal}Item | null>(null);

  const [formData, setFormData] = useState({
${fields
  .map((f) => {
    if (f.type === 'number') return `    ${f.name}: 0,`;
    if (f.type === 'enum') return `    ${f.name}: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',`;
    return `    ${f.name}: '',`;
  })
  .join('\n')}
  });

  // 1. 获取分页列表
  const { data: response, isLoading, refetch } = useQuery({
    queryKey: ['${moduleName}-list', page, pageSize, debouncedSearch],
    queryFn: () =>
      customInstance<{ code: number; data: PaginatedResponse }>({
        url: '/api/${moduleName}',
        method: 'GET',
        params: { page, pageSize, search: debouncedSearch || undefined },
      }),
  });

  const list = response?.data?.data || [];
  const pagination = response?.data?.pagination || {
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 0,
  };

  // 2. 新增与更新
  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      customInstance({
        url: '/api/${moduleName}',
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      toast.success('创建成功');
      setDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (error: Error) => toast.error('创建失败', { description: error.message }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      customInstance({
        url: \`/api/${moduleName}/\${editingItem?.id}\`,
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      toast.success('更新成功');
      setDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (error: Error) => toast.error('更新失败', { description: error.message }),
  });

  const resetForm = () => {
    setFormData({
${fields
  .map((f) => {
    if (f.type === 'number') return `      ${f.name}: 0,`;
    if (f.type === 'enum') return `      ${f.name}: 'ACTIVE',`;
    return `      ${f.name}: '',`;
  })
  .join('\n')}
    });
    setEditingItem(null);
  };

  const handleCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleEdit = (item: ${pascal}Item) => {
    setEditingItem(item);
    setFormData({
${fields.map((f) => `      ${f.name}: item.${f.name} ?? ${f.type === 'number' ? '0' : f.type === 'enum' ? "'ACTIVE'" : "''"},`).join('\n')}
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({ description: '确定要删除该条数据吗？', variant: 'destructive' });
    if (!ok) return;
    try {
      await customInstance({ url: \`/api/${moduleName}/\${id}\`, method: 'DELETE' });
      toast.success('删除成功');
      refetch();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '删除失败';
      toast.error('删除失败', { description: errorMsg });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const columns: Column<${pascal}Item>[] = [
${fields
  .map((f) => {
    if (f.type === 'enum') {
      return `    {
      label: '${f.label}',
      span: 2,
      render: (row) => (
        <Badge variant={row.${f.name} === 'ACTIVE' ? 'default' : 'secondary'}>
          {row.${f.name} === 'ACTIVE' ? '正常' : '停用'}
        </Badge>
      ),
    },`;
    }
    return `    { label: '${f.label}', span: 2, render: (row) => String(row.${f.name} ?? '-') },`;
  })
  .join('\n')}
    {
      label: '创建时间',
      span: 3,
      render: (row) => new Date(row.createdAt).toLocaleDateString('zh-CN'),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="${moduleLabel}管理"
        description="管理${moduleLabel}数据列表与配置"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => refetch()} title="刷新">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <PermissionButton perm="${moduleName}:add" onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              新增${moduleLabel}
            </PermissionButton>
          </div>
        }
      />

      <div className="flex items-center gap-4">
        <Input
          placeholder="搜索关键词..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <DataTable
        columns={columns}
        data={list}
        isLoading={isLoading}
        emptyText="暂无${moduleLabel}数据"
        actions={(row) => (
          <div className="flex items-center gap-2">
            <PermissionButton
              perm="${moduleName}:edit"
              variant="ghost"
              size="sm"
              onClick={() => handleEdit(row)}
            >
              <Pencil className="mr-1 h-3.5 w-3.5" />
              编辑
            </PermissionButton>
            <PermissionButton
              perm="${moduleName}:delete"
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(row.id)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              删除
            </PermissionButton>
          </div>
        )}
      />

      <Pagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={pagination.total}
        totalPages={pagination.totalPages}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingItem ? '编辑${moduleLabel}' : '新增${moduleLabel}'}</DialogTitle>
              <DialogDescription>
                {editingItem ? '修改${moduleLabel}信息。' : '填写${moduleLabel}基本信息。'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
${fields
  .map((f) => {
    if (f.type === 'enum') {
      return `              <div className="grid gap-2">
                <Label htmlFor="${f.name}">${f.label}</Label>
                <Select
                  value={formData.${f.name}}
                  onValueChange={(val) => setFormData({ ...formData, ${f.name}: val as 'ACTIVE' | 'INACTIVE' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">正常</SelectItem>
                    <SelectItem value="INACTIVE">停用</SelectItem>
                  </SelectContent>
                </Select>
              </div>`;
    }
    if (f.type === 'number') {
      return `              <div className="grid gap-2">
                <Label htmlFor="${f.name}">${f.label}</Label>
                <Input
                  id="${f.name}"
                  type="number"
                  value={formData.${f.name}}
                  onChange={(e) => setFormData({ ...formData, ${f.name}: parseInt(e.target.value) || 0 })}
                />
              </div>`;
    }
    return `              <div className="grid gap-2">
                <Label htmlFor="${f.name}">${f.label} *</Label>
                <Input
                  id="${f.name}"
                  required
                  value={formData.${f.name}}
                  onChange={(e) => setFormData({ ...formData, ${f.name}: e.target.value })}
                  placeholder="请输入${f.label}"
                />
              </div>`;
  })
  .join('\n\n')}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? '保存中...' : '保存'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog />
    </div>
  );
}
`;
writeFile(path.join(frontendPageDir, 'page.tsx'), pageContent);

// =============================================================================
// 5. 打印 Seed 片段和后续指引
// =============================================================================

console.log(`\n🎉 骨架代码生成完成！后续极简四步即可接入系统运行：\n`);

console.log(`📌 步骤 1: 注册 NestJS 模块 (在 apps/api/src/app.module.ts 中加入):`);
console.log(`   import { ${pascal}Module } from './modules/${moduleName}/${moduleName}.module';`);
console.log(`   // 在 imports 数组中添加: ${pascal}Module\n`);

console.log(`📌 步骤 2: 重新生成 Prisma Client 与迁移:`);
console.log(`   pnpm db:generate:mysql  # 或 pnpm db:generate:pg`);
console.log(`   pnpm --filter api prisma:migrate\n`);

console.log(`📌 步骤 3: 菜单与权限数据 (可复制进 apps/api/prisma/seed.ts):`);
console.log(`--------------------------------------------------------------------------------`);
console.log(`  // 二级菜单: ${moduleLabel}管理
  const menu${pascal} = await prisma.sysMenu.create({
    data: {
      name: '${moduleLabel}管理',
      parentId: menuSystem.id, // 或其他目录 ID
      type: MenuType.MENU,
      path: '/${moduleName}',
      component: '${moduleName}/page',
      icon: 'FileText',
      sort: 10,
      status: Status.ACTIVE,
    },
  });

  // 三级操作权限按钮
  await prisma.sysMenu.createMany({
    data: [
      { name: '${moduleLabel}新增', parentId: menu${pascal}.id, type: MenuType.BUTTON, perms: '${moduleName}:add', sort: 1, status: Status.ACTIVE },
      { name: '${moduleLabel}编辑', parentId: menu${pascal}.id, type: MenuType.BUTTON, perms: '${moduleName}:edit', sort: 2, status: Status.ACTIVE },
      { name: '${moduleLabel}删除', parentId: menu${pascal}.id, type: MenuType.BUTTON, perms: '${moduleName}:delete', sort: 3, status: Status.ACTIVE },
    ],
  });`);
console.log(`--------------------------------------------------------------------------------\n`);

console.log(`📌 步骤 4: 同步 OpenAPI 契约:`);
console.log(`   pnpm contract:sync\n`);
