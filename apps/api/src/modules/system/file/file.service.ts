import {
  Injectable,
  NotFoundException,
  BadRequestException,
  FileTypeValidator,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Role, Status } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { QueryFileDto, UpdateFileDto } from './dto';
import * as path from 'path';
import * as crypto from 'crypto';
import * as fs from 'fs';
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
const FILE_TYPE_SAMPLE_SIZE = 8192;

export interface FileActor {
  id: string;
  role: Role;
}

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

    const metadata = await this.buildFileMetadata(filename, mimetype, buffer);
    const stored = await this.fileStorage.put(metadata.objectKey, buffer, mimetype);
    return this.createFileRecord({
      ...metadata,
      fileSize: buffer.length,
      mimetype,
      stored,
      createBy,
    });
  }

  /**
   * 保存已经流式写入临时文件的上传，避免大文件完整驻留内存。
   */
  async saveUploadedFile(
    filename: string,
    mimetype: string,
    tempFilePath: string,
    fileSize: number,
    createBy?: string,
  ) {
    if (!this.allowedMimeTypes.includes(mimetype)) {
      throw new BadRequestException(`不支持的文件类型: ${mimetype}`);
    }
    if (fileSize > this._maxFileSize) {
      throw new BadRequestException(`文件大小超过限制: ${this._maxFileSize / 1024 / 1024}MB`);
    }

    await this.validateFileContentFromPath(mimetype, tempFilePath);
    const metadata = await this.buildFileMetadata(filename, mimetype, tempFilePath);
    const stored = await this.fileStorage.putFile(
      metadata.objectKey,
      tempFilePath,
      mimetype,
      fileSize,
    );

    return this.createFileRecord({
      ...metadata,
      fileSize,
      mimetype,
      stored,
      createBy,
    });
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

  private async validateFileContentFromPath(
    mimetype: string,
    filePath: string,
  ): Promise<void> {
    if (TEXT_MIME_TYPES.has(mimetype)) {
      const decoder = new TextDecoder('utf-8', { fatal: true });
      try {
        for await (const chunk of fs.createReadStream(filePath)) {
          const bytes = chunk instanceof Buffer ? chunk : Buffer.from(chunk);
          if (bytes.includes(0)) {
            throw new BadRequestException('文本文件包含非法的二进制内容');
          }
          decoder.decode(bytes, { stream: true });
        }
        decoder.decode();
      } catch (error) {
        if (error instanceof BadRequestException) throw error;
        throw new BadRequestException('文本文件必须使用有效的 UTF-8 编码');
      }
      return;
    }

    const handle = await fs.promises.open(filePath, 'r');
    try {
      const sample = Buffer.alloc(FILE_TYPE_SAMPLE_SIZE);
      const { bytesRead } = await handle.read(sample, 0, sample.length, 0);
      const escapedMimeType = mimetype.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const validator = new FileTypeValidator({
        fileType: new RegExp(`^${escapedMimeType}$`),
      });
      const isValid = await validator.isValid({
        buffer: sample.subarray(0, bytesRead),
        mimetype,
        size: bytesRead,
      });
      if (!isValid) {
        throw new BadRequestException('文件实际内容与声明类型不一致');
      }
    } finally {
      await handle.close();
    }
  }

  private async buildFileMetadata(
    filename: string,
    mimetype: string,
    source: Buffer | string,
  ) {
    const now = new Date();
    const dateDir = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
    const ext = MIME_EXTENSION_MAP[mimetype];
    const uniqueName = `${crypto.randomUUID()}.${ext}`;
    const md5 = await this.calculateMd5(source);
    return {
      objectKey: `${dateDir}/${uniqueName}`,
      ext,
      uniqueName,
      originalName: this.sanitizeOriginalName(filename),
      md5,
    };
  }

  private async calculateMd5(source: Buffer | string): Promise<string> {
    if (Buffer.isBuffer(source)) {
      return crypto.createHash('md5').update(new Uint8Array(source)).digest('hex');
    }

    const hash = crypto.createHash('md5');
    for await (const chunk of fs.createReadStream(source)) {
      hash.update(chunk instanceof Buffer ? chunk : Buffer.from(chunk));
    }
    return hash.digest('hex');
  }

  private async createFileRecord(input: {
    objectKey: string;
    uniqueName: string;
    originalName: string;
    ext: string;
    md5: string;
    fileSize: number;
    mimetype: string;
    stored: { key: string; url: string; storageType: string };
    createBy?: string;
  }) {
    let record;
    try {
      record = await this.prisma.sysFile.create({
        data: {
          fileName: input.uniqueName,
          originalName: input.originalName,
          filePath: input.stored.key,
          url: input.stored.url,
          fileSize: input.fileSize,
          mimeType: input.mimetype,
          ext: input.ext,
          storageType: input.stored.storageType,
          md5: input.md5,
          createBy: input.createBy,
        },
      });
    } catch (error) {
      await this.fileStorage
        .delete(input.stored.storageType, input.stored.key)
        .catch((rollbackError) =>
          this.logger.error(`回滚上传文件失败: ${input.stored.key}`, rollbackError),
        );
      throw error;
    }

    this.logger.log(`文件上传成功: ${input.originalName} → ${input.stored.url}`);
    return record;
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
    this.assertImageTypeAndSize(mimetype, buffer.length);
    const record = await this.saveFile(filename, mimetype, buffer, createBy);
    return this.toUploadResult(record);
  }

  /**
   * 从临时文件保存图片，避免 Controller 将整个图片读入内存。
   */
  async saveUploadedImage(
    filename: string,
    mimetype: string,
    tempFilePath: string,
    fileSize: number,
    createBy?: string,
  ) {
    this.assertImageTypeAndSize(mimetype, fileSize);
    const record = await this.saveUploadedFile(filename, mimetype, tempFilePath, fileSize, createBy);
    return this.toUploadResult(record);
  }

  private assertImageTypeAndSize(mimetype: string, fileSize: number): void {
    const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!imageTypes.includes(mimetype)) {
      throw new BadRequestException('仅支持 JPG/PNG/GIF/WebP 格式的图片');
    }
    if (fileSize > this._maxImageSize) {
      throw new BadRequestException(`图片大小超过限制: ${this._maxImageSize / 1024 / 1024}MB`);
    }
  }

  private toUploadResult(record: {
    id: string;
    url: string;
    originalName: string;
    fileSize: number;
    storageType: string;
  }) {
    return {
      id: record.id,
      url: this.toAccessUrl(record).url,
      originalName: record.originalName,
      fileSize: record.fileSize,
    };
  }

  /** 本地文件仅通过鉴权接口读取，避免静态目录绕过状态与归属校验。 */
  toAccessUrl<T extends { id: string; url: string; storageType: string }>(file: T): T {
    if (file.storageType !== 'local') return file;
    return { ...file, url: `/api/system/file/content/${file.id}` };
  }

  /**
   * 分页查询文件列表；非管理员只能看到自己上传的文件。
   */
  async findAll(query: QueryFileDto, actor: FileActor) {
    const { page = 1, pageSize = 10, search, mimeType } = query;
    const skip = (page - 1) * pageSize;

    const filters: Prisma.SysFileWhereInput[] = [{ status: Status.ACTIVE }];
    if (actor.role !== Role.ADMIN) {
      filters.push({ createBy: actor.id });
    }
    if (search) {
      filters.push({
        OR: [{ originalName: { contains: search } }, { fileName: { contains: search } }],
      });
    }
    if (mimeType) {
      if (mimeType === 'image') {
        filters.push({ mimeType: { startsWith: 'image/' } });
      } else if (mimeType === 'video') {
        filters.push({ mimeType: { startsWith: 'video/' } });
      } else if (mimeType === 'audio') {
        filters.push({ mimeType: { startsWith: 'audio/' } });
      } else if (mimeType === 'document') {
        filters.push({
          mimeType: {
            in: [
              'application/pdf',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/vnd.ms-excel',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ],
          },
        });
      }
    }
    const where: Prisma.SysFileWhereInput = { AND: filters };

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
  async findOne(id: string, actor: FileActor) {
    const file = await this.prisma.sysFile.findFirst({
      where: { id, status: Status.ACTIVE },
    });
    if (!file || (actor.role !== Role.ADMIN && file.createBy !== actor.id)) {
      throw new NotFoundException(`文件 ${id} 不存在`);
    }
    return file;
  }

  /**
   * 更新文件信息
   */
  async update(id: string, dto: UpdateFileDto, actor: FileActor) {
    await this.findOne(id, actor);
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
   * 删除文件：先软删除隐藏，再清理物理对象，最后删除记录。
   * 物理删除失败时恢复为可见状态，避免记录与对象同时处于不确定状态。
   */
  async remove(id: string, actor: FileActor) {
    const file = await this.findOne(id, actor);
    const result = await this.removeFiles([file]);
    return { message: `成功删除 ${result.count} 个文件` };
  }

  /**
   * 获取下载所需的文件内容和元数据
   */
  async getDownloadInfo(id: string, actor: FileActor) {
    const file = await this.findOne(id, actor);
    try {
      const storageKey = this.getStorageKey(file);
      const body =
        file.storageType === 'local'
          ? this.fileStorage.createLocalReadStream(storageKey)
          : await this.fileStorage.get(file.storageType, storageKey);
      return {
        body,
        contentLength: file.fileSize,
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
  async removeBatch(ids: string[], actor: FileActor) {
    const files = await this.prisma.sysFile.findMany({
      where: {
        id: { in: ids },
        status: Status.ACTIVE,
        ...(actor.role === Role.ADMIN ? {} : { createBy: actor.id }),
      },
    });

    if (files.length !== new Set(ids).size) {
      throw new NotFoundException('部分文件不存在或无权删除');
    }

    const result = await this.removeFiles(files);
    this.logger.log(`批量删除文件: ${result.count} 个`);
    return { message: `成功删除 ${result.count} 个文件` };
  }

  private async removeFiles(
    files: { id: string; storageType: string; filePath: string; url: string }[],
  ) {
    const ids = files.map((file) => file.id);
    await this.prisma.sysFile.updateMany({
      where: { id: { in: ids }, status: Status.ACTIVE },
      data: { status: Status.INACTIVE },
    });

    const results = await Promise.allSettled(
      files.map((file) => this.fileStorage.delete(file.storageType, this.getStorageKey(file))),
    );
    const successfulIds: string[] = [];
    const failedIds: string[] = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successfulIds.push(files[index].id);
      } else {
        failedIds.push(files[index].id);
        this.logger.error(`删除物理文件失败: ${files[index].id}`, result.reason);
      }
    });

    if (successfulIds.length > 0) {
      try {
        await this.prisma.sysFile.deleteMany({ where: { id: { in: successfulIds } } });
      } catch (error) {
        this.logger.error('删除文件数据库记录失败，记录保持隐藏状态', error);
        throw new InternalServerErrorException('文件记录删除失败，请稍后重试');
      }
    }
    if (failedIds.length > 0) {
      await this.prisma.sysFile.updateMany({
        where: { id: { in: failedIds } },
        data: { status: Status.ACTIVE },
      });
      throw new InternalServerErrorException('部分文件删除失败，请稍后重试');
    }

    return { count: successfulIds.length };
  }
}
