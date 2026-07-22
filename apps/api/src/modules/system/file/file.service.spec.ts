import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { FileStorageService } from './storage/file-storage.service';
import { FileService } from './file.service';

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

describe('FileService', () => {
  const create = jest.fn();
  const put = jest.fn(async (key: string) => ({
    key,
    url: `/files/${key}`,
    storageType: 'local' as const,
  }));
  const removeStoredFile = jest.fn().mockResolvedValue(undefined);

  function createService(config: Record<string, string | number> = {}): FileService {
    create.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      id: 'file-1',
      ...args.data,
    }));

    const prisma = { sysFile: { create } } as unknown as PrismaService;
    const storage = {
      put,
      delete: removeStoredFile,
    } as unknown as FileStorageService;

    return new FileService(prisma, new ConfigService(config), storage);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('拒绝伪装成 PNG 的 HTML 内容', async () => {
    const service = createService();

    await expect(
      service.saveFile(
        'payload.html',
        'image/png',
        Buffer.from('<script>localStorage.getItem("auth-storage")</script>'),
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(put).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('忽略客户端危险扩展名并按已验证的 MIME 分配扩展名', async () => {
    const service = createService();

    await service.saveFile('../../payload.html\r\n', 'image/png', ONE_PIXEL_PNG, 'user-1');

    const createArgs = create.mock.calls[0]?.[0] as {
      data: { fileName: string; originalName: string; ext: string; mimeType: string };
    };
    expect(createArgs.data.fileName).toMatch(/\.png$/);
    expect(createArgs.data.originalName).toBe('payload.html');
    expect(createArgs.data.ext).toBe('png');
    expect(createArgs.data.mimeType).toBe('image/png');
    expect(put.mock.calls[0]?.[0]).toMatch(/\.png$/);
  });

  it('禁止通过环境变量重新启用 SVG 等主动内容', () => {
    expect(() => createService({ FILE_ALLOWED_MIME_TYPES: 'image/png,image/svg+xml' })).toThrow(
      'FILE_ALLOWED_MIME_TYPES 包含不安全或无法验证的类型: image/svg+xml',
    );
  });

  it('文本内容统一使用安全扩展名并拒绝二进制文本', async () => {
    const service = createService({ FILE_ALLOWED_MIME_TYPES: 'text/plain' });

    await service.saveFile('notes.html', 'text/plain', Buffer.from('<script>alert(1)</script>'));
    const createArgs = create.mock.calls[0]?.[0] as {
      data: { fileName: string; ext: string };
    };
    expect(createArgs.data.fileName).toMatch(/\.txt$/);
    expect(createArgs.data.ext).toBe('txt');

    await expect(
      service.saveFile('binary.txt', 'text/plain', Buffer.from([0x61, 0x00, 0x62])),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
