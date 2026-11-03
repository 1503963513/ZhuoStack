import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface PublicKeyMaterial {
  publicKey: string;
  kid: string;
}

interface RsaKeyPair {
  publicKey: string;
  privateKey: string;
  kid: string;
}

function decodeEnvironmentValue(
  configService: ConfigService,
  key: string,
  base64Key: string,
): string {
  const encoded = configService.get<string>(base64Key)?.trim();
  if (encoded) {
    return Buffer.from(encoded, 'base64').toString('utf8').trim();
  }

  return (configService.get<string>(key) || '').replace(/\\n/g, '\n').trim();
}

function validateKeyPair(publicKey: string, privateKey: string): void {
  const privateKeyObject = crypto.createPrivateKey(privateKey);
  const suppliedPublicKey = crypto.createPublicKey(publicKey);
  const derivedPublicKey = crypto.createPublicKey(privateKeyObject);

  const suppliedDer = suppliedPublicKey.export({ type: 'spki', format: 'der' });
  const derivedDer = derivedPublicKey.export({ type: 'spki', format: 'der' });
  if (!suppliedDer.equals(derivedDer)) {
    throw new Error('RSA_PUBLIC_KEY 与 RSA_PRIVATE_KEY 不匹配');
  }
}

/**
 * 管理密码传输使用的 RSA 密钥。
 *
 * 生产环境必须通过环境变量注入固定密钥，避免多实例之间密钥不一致以及重启后
 * 浏览器缓存旧公钥的问题。开发/测试环境未配置时允许生成临时密钥。
 */
@Injectable()
export class RsaKeyService {
  private readonly logger = new Logger(RsaKeyService.name);
  private readonly keyPair: RsaKeyPair;

  constructor(private readonly configService: ConfigService) {
    const publicKey = decodeEnvironmentValue(
      configService,
      'RSA_PUBLIC_KEY',
      'RSA_PUBLIC_KEY_B64',
    );
    const privateKey = decodeEnvironmentValue(
      configService,
      'RSA_PRIVATE_KEY',
      'RSA_PRIVATE_KEY_B64',
    );

    if (Boolean(publicKey) !== Boolean(privateKey)) {
      throw new Error('RSA_PUBLIC_KEY 与 RSA_PRIVATE_KEY 必须同时配置');
    }

    if (publicKey && privateKey) {
      try {
        validateKeyPair(publicKey, privateKey);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`RSA 密钥配置无效: ${message}`);
      }
      this.keyPair = this.createKeyPair(publicKey, privateKey);
      this.logger.log(`已加载持久化 RSA 密钥，kid=${this.keyPair.kid}`);
      return;
    }

    if (configService.get<string>('NODE_ENV') === 'production') {
      throw new Error('生产环境必须配置 RSA_PUBLIC_KEY_B64 与 RSA_PRIVATE_KEY_B64');
    }

    const generated = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    this.keyPair = this.createKeyPair(generated.publicKey, generated.privateKey);
    this.logger.warn(`开发环境使用临时 RSA 密钥，kid=${this.keyPair.kid}`);
  }

  getPublicKey(): PublicKeyMaterial {
    return {
      publicKey: this.keyPair.publicKey,
      kid: this.keyPair.kid,
    };
  }

  decryptPassword(encrypted: string): string {
    try {
      if (!encrypted || encrypted.length > 4096) {
        throw new Error('密文长度无效');
      }

      const decrypted = crypto.privateDecrypt(
        {
          key: this.keyPair.privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha-256',
        },
        Buffer.from(encrypted, 'base64'),
      );
      return decrypted.toString('utf8');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`RSA 解密失败: ${message}`);
      throw new UnauthorizedException('密码解密失败，请刷新页面后重试');
    }
  }

  private createKeyPair(publicKey: string, privateKey: string): RsaKeyPair {
    const normalizedPublicKey = publicKey.trim();
    return {
      publicKey: normalizedPublicKey,
      privateKey: privateKey.trim(),
      kid: crypto.createHash('sha256').update(normalizedPublicKey).digest('hex').slice(0, 16),
    };
  }
}
