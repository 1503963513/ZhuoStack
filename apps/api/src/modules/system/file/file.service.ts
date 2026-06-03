import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { QueryFileDto, UpdateFileDto } from './dto';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);
  private readonly uploadsDir: string;
  private readonly urlPrefix: string;
  private readonly maxFileSize: number;
  private readonly maxImageSize: number;
  private readonly allowedMimeTypes: string[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const storagePath = this.configService.get<string>('FILE_STORAGE_PATH', 'uploads');
    this.uploadsDir = path.isAbsolute(storagePath) ? storagePath : path.join(process.cwd(), storagePath);
    this.urlPrefix = this.configService.get<string>('FILE_URL_PREFIX', '/files');
    this.maxFileSize = this.configService.get<number>('FILE_MAX_SIZE_MB', 50) * 1024 * 1024;
    this.maxImageSize = 5 * 1024 * 1024; // 图片固定 5MB
    this.allowedMimeTypes = this.configService.get<string>(
      'FILE_ALLOWED_MIME_TYPES',
      'image/jpeg,image/png,image/gif,image/webp,image/svg+xml,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv,application/zip,video/mp4,video/webm,audio/mpeg',
    ).split(',').map((s) => s.trim());

    // 确保 uploads 目录存在
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }

    this.logger.log(`文件存储: ${this.uploadsDir} → ${this.urlPrefix}`);
    this.logger.log(`文件限制: ${this.maxFileSize / 1024 / 1024}MB, ${this.allowedMimeTypes.length} 种类型`);
  }

  /**
   * 保存上传的文件到磁盘并记录到数据库
   */
  async saveFile(filename: string, mimetype: string, buffer: Buffer, createBy?: string) {
    // 验证文件类型
    if (!this.allowedMimeTypes.includes(mimetype)) {
      throw new BadRequestException(`不支持的文件类型: ${mimetype}`);
    }

    // 验证文件大小
    if (buffer.length > this.maxFileSize) {
      throw new BadRequestException(`文件大小超过限制: ${this.maxFileSize / 1024 / 1024}MB`);
    }

    // 生成存储路径：uploads/2026/06/02/xxx.ext
    const now = new Date();
    const dateDir = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
    const fullDir = path.join(this.uploadsDir, dateDir);

    if (!fs.existsSync(fullDir)) {
      fs.mkdirSync(fullDir, { recursive: true });
    }

    const ext = path.extname(filename).toLowerCase();
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(fullDir, uniqueName);
    const relativePath = `${this.uploadsDir}/${dateDir}/${uniqueName}`;
    const url = `${this.urlPrefix}/${dateDir}/${uniqueName}`;

    // 写入文件
    fs.writeFileSync(filePath, new Uint8Array(buffer));

    // 计算 MD5
    const md5 = crypto.createHash('md5').update(new Uint8Array(buffer)).digest('hex');

    // 保存到数据库
    const record = await this.prisma.sysFile.create({
      data: {
        fileName: uniqueName,
        originalName: filename,
        filePath: relativePath,
        url,
        fileSize: buffer.length,
        mimeType: mimetype,
        ext: ext.replace('.', ''),
        storageType: 'local',
        md5,
        createBy,
      },
    });

    this.logger.log(`文件上传成功: ${filename} → ${url}`);
    return record;
  }

  /**
   * 图片上传（限制 5MB，返回精简格式）
   */
  async saveImage(filename: string, mimetype: string, buffer: Buffer, createBy?: string) {
    const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!imageTypes.includes(mimetype)) {
      throw new BadRequestException('仅支持 JPG/PNG/GIF/WebP 格式的图片');
    }

    if (buffer.length > this.maxImageSize) {
      throw new BadRequestException(`图片大小超过限制: ${this.maxImageSize / 1024 / 1024}MB`);
    }

    const record = await this.saveFile(filename, mimetype, buffer, createBy);
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
   * 根据文件 URL 计算实际磁盘路径
   */
  private getPhysicalPath(file: { url: string }): string {
    // url: /files/2026/06/03/xxx.ext → 去掉 urlPrefix 得到 2026/06/03/xxx.ext
    const relative = file.url.replace(this.urlPrefix + '/', '');
    return path.join(this.uploadsDir, relative);
  }

  /**
   * 删除文件（物理删除 + 数据库删除）
   */
  async remove(id: string) {
    const file = await this.findOne(id);

    const fullPath = this.getPhysicalPath(file);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

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

    for (const file of files) {
      const fullPath = this.getPhysicalPath(file);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    const result = await this.prisma.sysFile.deleteMany({
      where: { id: { in: ids } },
    });

    this.logger.log(`批量删除文件: ${result.count} 个`);
    return { message: `成功删除 ${result.count} 个文件` };
  }
}
