/**
 * RSA 密码加密工具
 *
 * 安全模型：
 * 1. 服务端启动时生成 RSA-2048 密钥对
 * 2. 前端通过 GET /api/auth/public-key 获取公钥
 * 3. 使用 JSEncrypt (RSA-PKCS1v1.5) 加密密码后传输
 * 4. 服务端用私钥解密，再 bcrypt 哈希存储/比对
 *
 * 使用 JSEncrypt 而非 Web Crypto API，确保在 HTTP（非安全上下文）下也能工作。
 */

import JSEncrypt from 'jsencrypt';

const PUBLIC_KEY_CACHE_TTL = 5 * 60 * 1000; // 5 分钟

let cachedPublicKey: string | null = null;
let cachedTimestamp = 0;

/**
 * 获取 RSA 公钥 PEM（带内存缓存）
 */
async function getPublicKey(): Promise<string> {
  if (cachedPublicKey && Date.now() - cachedTimestamp < PUBLIC_KEY_CACHE_TTL) {
    return cachedPublicKey;
  }

  const res = await fetch('/api/auth/public-key');
  if (!res.ok) {
    throw new Error('获取公钥失败');
  }
  const json = await res.json();
  const publicKey = json.data.publicKey as string;

  cachedPublicKey = publicKey;
  cachedTimestamp = Date.now();
  return publicKey;
}

/**
 * 使用 RSA 加密密码
 * @param password 明文密码
 * @returns Base64 编码的密文
 */
export async function encryptPassword(password: string): Promise<string> {
  const publicKey = await getPublicKey();

  const encrypt = new JSEncrypt();
  encrypt.setPublicKey(publicKey);

  const encrypted = encrypt.encrypt(password);
  if (!encrypted) {
    throw new Error('RSA 加密失败');
  }
  return encrypted;
}

/**
 * 验证两次输入的密码是否一致
 */
export function verifyPasswordMatch(
  password: string,
  confirmPassword: string,
): boolean {
  return password === confirmPassword;
}
