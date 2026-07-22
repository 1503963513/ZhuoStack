import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OSS from 'ali-oss';
import COS from 'cos-nodejs-sdk-v5';
import * as fs from 'fs';
import * as path from 'path';

export type FileStorageType = 'local' | 'aliyun' | 'tencent';

export interface StoredObject {
  key: string;
  url: string;
  storageType: FileStorageType;
}

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly storageType: FileStorageType;
  private readonly uploadsDir: string;
  private readonly urlPrefix: string;
  private readonly objectPrefix: string;
  private aliyunClient?: OSS;
  private tencentClient?: COS;

  constructor(private readonly configService: ConfigService) {
    this.storageType = this.readStorageType();

    const storagePath = this.configService.get<string>('FILE_STORAGE_PATH', 'uploads');
    this.uploadsDir = path.isAbsolute(storagePath)
      ? storagePath
      : path.join(process.cwd(), storagePath);
    this.urlPrefix = this.trimTrailingSlash(
      this.configService.get<string>('FILE_URL_PREFIX', '/files'),
    );
    this.objectPrefix = this.configService
      .get<string>('FILE_OBJECT_PREFIX', '')
      .trim()
      .replace(/^\/+|\/+$/g, '');

    // 在启动时校验当前选中的存储，其他存储只在读取历史文件时按需校验。
    if (this.storageType === 'aliyun') this.getAliyunClient();
    if (this.storageType === 'tencent') this.getTencentClient();

    this.logger.log(`当前文件存储: ${this.storageType}`);
  }

  get activeStorageType(): FileStorageType {
    return this.storageType;
  }

  async put(key: string, buffer: Buffer, mimeType: string): Promise<StoredObject> {
    const normalizedKey = this.withObjectPrefix(key);

    switch (this.storageType) {
      case 'local': {
        const filePath = this.resolveLocalPath(normalizedKey);
        await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
        await fs.promises.writeFile(filePath, new Uint8Array(buffer));
        return {
          key: normalizedKey,
          url: `${this.urlPrefix}/${this.encodeObjectKey(normalizedKey)}`,
          storageType: 'local',
        };
      }
      case 'aliyun': {
        await this.getAliyunClient().put(normalizedKey, buffer, { mime: mimeType });
        return {
          key: normalizedKey,
          url: this.buildAliyunPublicUrl(normalizedKey),
          storageType: 'aliyun',
        };
      }
      case 'tencent': {
        await this.getTencentClient().putObject({
          Bucket: this.required('TENCENT_COS_BUCKET'),
          Region: this.required('TENCENT_COS_REGION'),
          Key: normalizedKey,
          Body: buffer,
          ContentLength: buffer.length,
          ContentType: mimeType,
        });
        return {
          key: normalizedKey,
          url: this.buildTencentPublicUrl(normalizedKey),
          storageType: 'tencent',
        };
      }
    }
  }

  async get(storageType: string, key: string): Promise<Buffer> {
    const type = this.parseRecordStorageType(storageType);

    switch (type) {
      case 'local':
        return fs.promises.readFile(this.resolveLocalPath(key));
      case 'aliyun': {
        const result = await this.getAliyunClient().get(key);
        return Buffer.isBuffer(result.content) ? result.content : Buffer.from(result.content);
      }
      case 'tencent': {
        const result = await this.getTencentClient().getObject({
          Bucket: this.required('TENCENT_COS_BUCKET'),
          Region: this.required('TENCENT_COS_REGION'),
          Key: key,
        });
        return Buffer.isBuffer(result.Body) ? result.Body : Buffer.from(result.Body as string);
      }
    }
  }

  async delete(storageType: string, key: string): Promise<void> {
    const type = this.parseRecordStorageType(storageType);

    switch (type) {
      case 'local': {
        const filePath = this.resolveLocalPath(key);
        try {
          await fs.promises.unlink(filePath);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
        return;
      }
      case 'aliyun':
        await this.getAliyunClient().delete(key);
        return;
      case 'tencent':
        await this.getTencentClient().deleteObject({
          Bucket: this.required('TENCENT_COS_BUCKET'),
          Region: this.required('TENCENT_COS_REGION'),
          Key: key,
        });
    }
  }

  private readStorageType(): FileStorageType {
    const value = this.configService.get<string>('FILE_STORAGE_TYPE', 'local').trim().toLowerCase();
    if (value === 'local' || value === 'aliyun' || value === 'tencent') {
      return value;
    }
    throw new Error(`FILE_STORAGE_TYPE 只能是 local、aliyun 或 tencent，当前为: ${value}`);
  }

  private parseRecordStorageType(value: string): FileStorageType {
    if (value === 'local' || value === 'aliyun' || value === 'tencent') {
      return value;
    }
    throw new Error(`不支持的历史文件存储类型: ${value}`);
  }

  private getAliyunClient(): OSS {
    if (!this.aliyunClient) {
      const endpoint = this.configService.get<string>('ALIYUN_OSS_ENDPOINT')?.trim();
      const region = this.configService.get<string>('ALIYUN_OSS_REGION')?.trim();
      if (!endpoint && !region) {
        throw new Error('ALIYUN_OSS_ENDPOINT 和 ALIYUN_OSS_REGION 至少需要配置一个');
      }
      this.aliyunClient = new OSS({
        accessKeyId: this.required('ALIYUN_OSS_ACCESS_KEY_ID'),
        accessKeySecret: this.required('ALIYUN_OSS_ACCESS_KEY_SECRET'),
        bucket: this.required('ALIYUN_OSS_BUCKET'),
        endpoint: endpoint || undefined,
        region: region || undefined,
        secure: true,
      });
    }
    return this.aliyunClient;
  }

  private getTencentClient(): COS {
    if (!this.tencentClient) {
      this.tencentClient = new COS({
        SecretId: this.required('TENCENT_COS_SECRET_ID'),
        SecretKey: this.required('TENCENT_COS_SECRET_KEY'),
        Protocol: 'https:',
      });
      this.required('TENCENT_COS_BUCKET');
      this.required('TENCENT_COS_REGION');
    }
    return this.tencentClient;
  }

  private buildAliyunPublicUrl(key: string): string {
    const customBase = this.configService.get<string>('ALIYUN_OSS_PUBLIC_URL')?.trim();
    if (customBase) return this.joinPublicUrl(customBase, key);

    const bucket = this.required('ALIYUN_OSS_BUCKET');
    const endpoint = (
      this.configService.get<string>('ALIYUN_OSS_ENDPOINT')?.trim() ||
      this.required('ALIYUN_OSS_REGION') + '.aliyuncs.com'
    )
      .replace(/^https?:\/\//, '')
      .replace(/\/+$/, '');
    return this.joinPublicUrl(`https://${bucket}.${endpoint}`, key);
  }

  private buildTencentPublicUrl(key: string): string {
    const customBase = this.configService.get<string>('TENCENT_COS_PUBLIC_URL')?.trim();
    if (customBase) return this.joinPublicUrl(customBase, key);

    const bucket = this.required('TENCENT_COS_BUCKET');
    const region = this.required('TENCENT_COS_REGION');
    return this.joinPublicUrl(`https://${bucket}.cos.${region}.myqcloud.com`, key);
  }

  private joinPublicUrl(base: string, key: string): string {
    return `${this.trimTrailingSlash(base)}/${this.encodeObjectKey(key)}`;
  }

  private encodeObjectKey(key: string): string {
    return key.split('/').map(encodeURIComponent).join('/');
  }

  private withObjectPrefix(key: string): string {
    const normalized = key.replace(/^\/+/, '');
    return this.objectPrefix ? `${this.objectPrefix}/${normalized}` : normalized;
  }

  private resolveLocalPath(key: string): string {
    const normalized = key.replace(/^\/+/, '');
    const resolved = path.resolve(this.uploadsDir, normalized);
    const storageRoot = path.resolve(this.uploadsDir);
    if (resolved !== storageRoot && !resolved.startsWith(`${storageRoot}${path.sep}`)) {
      throw new Error('非法的文件存储路径');
    }
    return resolved;
  }

  private required(key: string): string {
    const value = this.configService.get<string>(key)?.trim();
    if (!value) throw new Error(`当前文件存储缺少必需的环境变量: ${key}`);
    return value;
  }

  private trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '');
  }
}
