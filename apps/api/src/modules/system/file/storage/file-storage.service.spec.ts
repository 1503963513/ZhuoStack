/// <reference types="jest" />

import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileStorageService } from './file-storage.service';

describe('FileStorageService', () => {
  let storageDir: string;

  beforeEach(() => {
    storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-storage-'));
  });

  afterEach(() => {
    fs.rmSync(storageDir, { recursive: true, force: true });
  });

  it('应该默认使用本地存储并支持上传、下载和删除', async () => {
    const service = new FileStorageService(
      new ConfigService({
        FILE_STORAGE_PATH: storageDir,
        FILE_URL_PREFIX: '/files',
      }),
    );
    const content = Buffer.from('hello storage');

    const stored = await service.put('2026/07/demo file.txt', content, 'text/plain');

    expect(stored).toEqual({
      key: '2026/07/demo file.txt',
      url: '/files/2026/07/demo%20file.txt',
      storageType: 'local',
    });
    await expect(service.get(stored.storageType, stored.key)).resolves.toEqual(content);

    await service.delete(stored.storageType, stored.key);
    await expect(service.get(stored.storageType, stored.key)).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('应该将对象键前缀应用到本地文件', async () => {
    const service = new FileStorageService(
      new ConfigService({
        FILE_STORAGE_PATH: storageDir,
        FILE_OBJECT_PREFIX: 'zhuostack/uploads/',
      }),
    );

    const stored = await service.put('2026/demo.txt', Buffer.from('demo'), 'text/plain');

    expect(stored.key).toBe('zhuostack/uploads/2026/demo.txt');
    expect(fs.existsSync(path.join(storageDir, stored.key))).toBe(true);
  });

  it('应该拒绝未知的存储类型', () => {
    expect(
      () =>
        new FileStorageService(
          new ConfigService({
            FILE_STORAGE_TYPE: 'unknown',
            FILE_STORAGE_PATH: storageDir,
          }),
        ),
    ).toThrow('FILE_STORAGE_TYPE 只能是 local、aliyun 或 tencent');
  });

  it('应该在启用云存储但配置不完整时立即失败', () => {
    expect(
      () =>
        new FileStorageService(
          new ConfigService({
            FILE_STORAGE_TYPE: 'aliyun',
            FILE_STORAGE_PATH: storageDir,
          }),
        ),
    ).toThrow('ALIYUN_OSS_ENDPOINT 和 ALIYUN_OSS_REGION 至少需要配置一个');
  });
});
