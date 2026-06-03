import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { QueryFileDto, UpdateFileDto } from './dto';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// 允许上传的文件类型
const ALLOWED_MIME_TYPES = [
  // 图片
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  // 文档
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv',
  // 压缩包
  'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
  // 视频
  'video/mp4', 'video/webm', 'video/ogg',
  // 音频
  'audio/mpeg', 'audio/wav', 'audio/ogg',
];

// 文件大小限制（字节）
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);
  private readonly uploadsDir: string;

  constructor(private readonly prisma: PrismaService) {
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    // 确保 uploads 目录存在
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  /**
   * 上传文件
   */
  async upload(file: any, createBy?: string) {
    if (!file) {
      throw new BadRequestException('请选择要上传的文件');
    }

    // 验证文件类型
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`不支持的文件类型: ${file.mimetype}`);
    }

    // 验证文件大小
    if (file.filesize > MAX_FILE_SIZE) {
      throw new BadRequestException(`文件大小超过限制: ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    // 生成存储路径：uploads/2026/06/02/xxx.ext
    const now = new Date();
    const dateDir = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
    const fullDir = path.join(this.uploadsDir, dateDir);

    // 创建日期目录
    if (!fs.existsSync(fullDir)) {
      fs.mkdirSync(fullDir, { recursive: true });
    }

    // 生成唯一文件名
    const ext = path.extname(file.filename).toLowerCase();
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(fullDir, uniqueName);
    const relativePath = `uploads/${dateDir}/${uniqueName}`;
    const url = `/files/${dateDir}/${uniqueName}`;

    // 写入文件
    const buffer = await file.toBuffer();
    fs.writeFileSync(filePath, buffer);

    // 计算 MD5
    const md5 = crypto.createHash('md5').update(buffer).digest('hex');

    // 保存到数据库
    const record = await this.prisma.sysFile.create({
      data: {
        fileName: uniqueName,
        originalName: file.filename,
        filePath: relativePath,
        url,
        fileSize: file.filesize,
        mimeType: file.mimetype,
        ext: ext.replace('.', ''),
        storageType: 'local',
        md5,
        createBy,
      },
    });

    this.logger.log(`文件上传成功: ${file.filename} → ${url}`);
    return record;
  }

  /**
   * 图片上传（限制 5MB，返回精简格式）
   */
  async uploadImage(file: any, createBy?: string) {
    if (!file) {
      throw new BadRequestException('请选择要上传的图片');
    }

    // 只允许图片类型
    const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!imageTypes.includes(file.mimetype)) {
      throw new BadRequestException('仅支持 JPG/PNG/GIF/WebP 格式的图片');
    }

    // 图片大小限制
    if (file.filesize > MAX_IMAGE_SIZE) {
      throw new BadRequestException(`图片大小超过限制: ${MAX_IMAGE_SIZE / 1024 / 1024}MB`);
    }

    const record = await this.upload(file, createBy);
    return {
      id: record.id,
      url: record.url,
      originalName: record.originalName,
      fileSize: record.fileSize,
    };
  }

  /**
   * 分页查询文件列表
   */
  async findAll(query: QueryFileDto) {
    const { page = 1, pageSize = 10, search, mimeType } = query;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (search) {
      where.OR = [
        { originalName: { contains: search } },
        { fileName: { contains: search } },
      ];
    }
    if (mimeType) {
      if (mimeType === 'image') {
        where.mimeType = { startsWith: 'image/' };
      } else if (mimeType === 'video') {
        where.mimeType = { startsWith: 'video/' };
      } else if (mimeType === 'audio') {
        where.mimeType = { startsWith: 'audio/' };
      } else if (mimeType === 'document') {
        where.mimeType = { in: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'] };
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.sysFile.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.sysFile.count({ where }),
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
   * 获取文件详情
   */
  async findOne(id: string) {
    const file = await this.prisma.sysFile.findUnique({ where: { id } });
    if (!file) {
      throw new NotFoundException(`文件 ${id} 不存在`);
    }
    return file;
  }

  /**
   * 更新文件信息
   */
  async update(id: string, dto: UpdateFileDto) {
    await this.findOne(id);
    return this.prisma.sysFile.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * 删除文件（物理删除 + 数据库删除）
   */
  async remove(id: string) {
    const file = await this.findOne(id);

    // 删除物理文件
    const fullPath = path.join(process.cwd(), file.filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    // 删除数据库记录
    await this.prisma.sysFile.delete({ where: { id } });

    this.logger.log(`文件已删除: ${file.originalName}`);
    return { message: '删除成功' };
  }

  /**
   * 批量删除文件
   */
  async removeBatch(ids: string[]) {
    const files = await this.prisma.sysFile.findMany({
      where: { id: { in: ids } },
    });

    // 删除物理文件
    for (const file of files) {
      const fullPath = path.join(process.cwd(), file.filePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    // 删除数据库记录
    const result = await this.prisma.sysFile.deleteMany({
      where: { id: { in: ids } },
    });

    this.logger.log(`批量删除文件: ${result.count} 个`);
    return { message: `成功删除 ${result.count} 个文件` };
  }
}
