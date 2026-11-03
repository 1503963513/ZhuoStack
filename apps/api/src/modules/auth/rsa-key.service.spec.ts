import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { RsaKeyService } from './rsa-key.service';

function createConfiguration(values: Record<string, string>): ConfigService {
  return new ConfigService(values);
}

describe('RsaKeyService', () => {
  const generated = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  it('生产环境缺少固定密钥时拒绝启动', () => {
    expect(() => new RsaKeyService(createConfiguration({ NODE_ENV: 'production' }))).toThrow(
      '生产环境必须配置 RSA_PUBLIC_KEY_B64 与 RSA_PRIVATE_KEY_B64',
    );
  });

  it('加载 Base64 密钥并可解密 RSA-OAEP SHA-256 密文', () => {
    const service = new RsaKeyService(
      createConfiguration({
        NODE_ENV: 'production',
        RSA_PUBLIC_KEY_B64: Buffer.from(generated.publicKey).toString('base64'),
        RSA_PRIVATE_KEY_B64: Buffer.from(generated.privateKey).toString('base64'),
      }),
    );
    const publicKey = service.getPublicKey();
    const encrypted = crypto.publicEncrypt(
      {
        key: publicKey.publicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha-256',
      },
      Buffer.from('Admin@123456'),
    );

    expect(publicKey.kid).toMatch(/^[a-f0-9]{16}$/);
    expect(service.decryptPassword(encrypted.toString('base64'))).toBe('Admin@123456');
  });

  it('拒绝不匹配的公私钥', () => {
    const other = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    expect(
      () =>
        new RsaKeyService(
          createConfiguration({
            NODE_ENV: 'production',
            RSA_PUBLIC_KEY: generated.publicKey.replace(/\n/g, '\\n'),
            RSA_PRIVATE_KEY: other.privateKey.replace(/\n/g, '\\n'),
          }),
        ),
    ).toThrow('RSA_PUBLIC_KEY 与 RSA_PRIVATE_KEY 不匹配');
  });
});
