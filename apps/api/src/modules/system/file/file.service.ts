import {
  Injectable,
  NotFoundException,
  BadRequestException,
  FileTypeValidator,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { QueryFileDto, UpdateFileDto } from './dto';
import * as path from 'path';
import * as crypto from 'crypto';
import { FileStorageService } from './storage/file-storage.service';

const MIME_EXTENSION_MAP: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/zip': 'zip',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'audio/mpeg': 'mp3',
};

const DEFAULT_ALLOWED_MIME_TYPES = Object.keys(MIME_EXTENSION_MAP).join(',');
const TEXT_MIME_TYPES = new Set(['text/plain', 'text/csv']);

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);
  private readonly urlPrefix: string;
  private readonly _maxFileSize: number;
  private readonly _maxImageSize: number;

  /** 文件大小限制（MB），供 Controller 使用 */
  get maxFileSizeMB() {
    return Math.round(this._maxFileSize / 1024 / 1024);
  }
  get maxImageSizeMB() {
    return Math.round(this._maxImageSize / 1024 / 1024);
  }
  private readonly allowedMimeTypes: string[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly fileStorage: FileStorageService,
  ) {
    this.urlPrefix = this.configService.get<string>('FILE_URL_PREFIX', '/files');
    this._maxFileSize = this.configService.get<number>('FILE_MAX_SIZE_MB', 50) * 1024 * 1024;
    this._maxImageSize = 5 * 1024 * 1024; // 图片固定 5MB
    this.allowedMimeTypes = this.configService
      .get<string>('FILE_ALLOWED_MIME_TYPES', DEFAULT_ALLOWED_MIME_TYPES)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const unsupportedMimeTypes = this.allowedMimeTypes.filter(
      (mimeType) => MIME_EXTENSION_MAP[mimeType] === undefined,
    );
    if (unsupportedMimeTypes.length > 0) {
      throw new Error(
        `FILE_ALLOWED_MIME_TYPES 包含不安全或无法验证的类型: ${unsupportedMimeTypes.join(', ')}`,
      );
    }

    this.logger.log(
      `文件限制: ${this._maxFileSize / 1024 / 1024}MB, ${this.allowedMimeTypes.length} 种类型`,
    );
  }

  /**
   * 保存上传的文件到当前配置的存储并记录到数据库
   */
  async saveFile(filename: string, mimetype: string, buffer: Buffer, createBy?: string) {
    // 客户端提供的 MIME 只能用于声明；后续还会用文件魔数验证实际内容。
    if (!this.allowedMimeTypes.includes(mimetype)) {
      throw new BadRequestException(`不支持的文件类型: ${mimetype}`);
    }

    // 验证文件大小
    if (buffer.length > this._maxFileSize) {
      throw new BadRequestException(`文件大小超过限制: ${this._maxFileSize / 1024 / 1024}MB`);
    }

    await this.validateFileContent(mimetype, buffer);

    // 生成存储键：2026/06/02/xxx.ext
    const now = new Date();
    const dateDir = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;

    // 存储扩展名完全由已验证的 MIME 决定，绝不沿用客户端文件名中的扩展名。
    const ext = MIME_EXTENSION_MAP[mimetype];
    const uniqueName = `${crypto.randomUUID()}.${ext}`;
    const objectKey = `${dateDir}/${uniqueName}`;
    const stored = await this.fileStorage.put(objectKey, buffer, mimetype);
    const originalName = this.sanitizeOriginalName(filename);

    // 计算 MD5
    const md5 = crypto.createHash('md5').update(new Uint8Array(buffer)).digest('hex');

    // 保存到数据库
    let record;
    try {
      record = await this.prisma.sysFile.create({
        data: {
          fileName: uniqueName,
          originalName,
          filePath: stored.key,
          url: stored.url,
          fileSize: buffer.length,
          mimeType: mimetype,
          ext,
          storageType: stored.storageType,
          md5,
          createBy,
        },
      });
    } catch (error) {
      // 数据库写入失败时回滚已上传的对象，避免产生孤儿文件。
      await this.fileStorage
        .delete(stored.storageType, stored.key)
        .catch((rollbackError) =>
          this.logger.error(`回滚上传文件失败: ${stored.key}`, rollbackError),
        );
      throw error;
    }

    this.logger.log(`文件上传成功: ${originalName} → ${stored.url}`);
    return record;
  }

  /**
   * 使用文件魔数校验二进制类型；文本类型没有稳定魔数，因此严格验证 UTF-8 编码，
   * 并统一使用服务端分配的 .txt/.csv 扩展名配合 nosniff 响应头。
   */
  private async validateFileContent(mimetype: string, buffer: Buffer): Promise<void> {
    if (TEXT_MIME_TYPES.has(mimetype)) {
      try {
        new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      } catch {
        throw new BadRequestException('文本文件必须使用有效的 UTF-8 编码');
      }

      if (buffer.includes(0)) {
        throw new BadRequestException('文本文件包含非法的二进制内容');
      }
      return;
    }

    const escapedMimeType = mimetype.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const validator = new FileTypeValidator({
      fileType: new RegExp(`^${escapedMimeType}$`),
    });
    const isValid = await validator.isValid({
      buffer,
      mimetype,
      size: buffer.length,
    });

    if (!isValid) {
      throw new BadRequestException('文件实际内容与声明类型不一致');
    }
  }

  private sanitizeOriginalName(filename: string): string {
    const sanitized = Array.from(path.basename(filename))
      .filter((character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return codePoint > 31 && codePoint !== 127;
      })
      .join('')
      .slice(0, 255);
    return sanitized || 'file';
  }

  /**
   * 图片上传（限制 5MB，返回精简格式）
   */
  async saveImage(filename: string, mimetype: string, buffer: Buffer, createBy?: string) {
    const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!imageTypes.includes(mimetype)) {
      throw new BadRequestException('仅支持 JPG/PNG/GIF/WebP 格式的图片');
    }

    if (buffer.length > this._maxImageSize) {
      throw new BadRequestException(`图片大小超过限制: ${this._maxImageSize / 1024 / 1024}MB`);
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

    const where: Prisma.SysFileWhereInput = {};
    if (search) {
      where.OR = [{ originalName: { contains: search } }, { fileName: { contains: search } }];
    }
    if (mimeType) {
      if (mimeType === 'image') {
        where.mimeType = { startsWith: 'image/' };
      } else if (mimeType === 'video') {
        where.mimeType = { startsWith: 'video/' };
      } else if (mimeType === 'audio') {
        where.mimeType = { startsWith: 'audio/' };
      } else if (mimeType === 'document') {
        where.mimeType = {
          in: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          ],
        };
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

  private getStorageKey(file: { filePath: string; url: string; storageType: string }): string {
    if (file.storageType !== 'local') return file.filePath.replace(/^\/+/, '');

    // 兼容旧数据：旧版 filePath 存的可能是绝对路径，本地键从 URL 反推最稳定。
    const prefix = `${this.urlPrefix.replace(/\/$/, '')}/`;
    if (file.url.startsWith(prefix)) {
      return decodeURIComponent(file.url.slice(prefix.length));
    }
    return file.filePath.replace(/^\/+/, '');
  }

  /**
   * 删除文件（物理删除 + 数据库删除）
   */
  async remove(id: string) {
    const file = await this.findOne(id);

    await this.fileStorage.delete(file.storageType, this.getStorageKey(file));

    await this.prisma.sysFile.delete({ where: { id } });

    this.logger.log(`文件已删除: ${file.originalName}`);
    return { message: '删除成功' };
  }

  /**
   * 获取下载所需的文件内容和元数据
   */
  async getDownloadInfo(id: string) {
    const file = await this.findOne(id);
    try {
      const buffer = await this.fileStorage.get(file.storageType, this.getStorageKey(file));
      return {
        buffer,
        originalName: file.originalName,
        mimeType: file.mimeType,
      };
    } catch (error) {
      this.logger.warn(`读取文件失败: ${file.originalName}`, error);
      throw new NotFoundException(`文件 ${file.originalName} 在存储中不存在`);
    }
  }

  /**
   * 批量删除文件
   */
  async removeBatch(ids: string[]) {
    const files = await this.prisma.sysFile.findMany({
      where: { id: { in: ids } },
    });

    await Promise.all(
      files.map((file) => this.fileStorage.delete(file.storageType, this.getStorageKey(file))),
    );

    const result = await this.prisma.sysFile.deleteMany({
      where: { id: { in: ids } },
    });

    this.logger.log(`批量删除文件: ${result.count} 个`);
    return { message: `成功删除 ${result.count} 个文件` };
  }
}
