/**
 * RSA 密码加密工具
 *
 * 使用 node-forge 实现 RSA-OAEP (SHA-256) 加密，兼容 HTTP 和 HTTPS 环境。
 *
 * 安全模型：
 * 1. 服务端通过环境变量加载固定的 RSA-2048 密钥对
 * 2. 前端通过 GET /api/auth/public-key 获取 PEM 公钥与 kid
 * 3. 使用 RSAES-OAEP (SHA-256) 加密密码后传输
 * 4. 服务端用私钥解密，再 bcrypt 哈希存储/比对
 */

import forge from 'node-forge';

const PUBLIC_KEY_CACHE_TTL = 5 * 60 * 1000;

interface CachedPublicKey {
  key: forge.pki.rsa.PublicKey;
  kid: string;
  cachedAt: number;
}

let cachedPublicKey: CachedPublicKey | null = null;

/** 构建 API 基础地址（与 api-client 保持一致） */
function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL || '';
}

/**
 * 获取 RSA 公钥（带内存缓存，按服务端 kid 标识公钥版本）
 */
async function getPublicKey(): Promise<CachedPublicKey> {
  if (cachedPublicKey && Date.now() - cachedPublicKey.cachedAt < PUBLIC_KEY_CACHE_TTL) {
    return cachedPublicKey;
  }

  // 公钥可能由部署轮换，禁止浏览器或中间缓存返回过期响应。
  const res = await fetch(`${getApiBase()}/api/auth/public-key`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error('获取公钥失败');
  }

  const json = await res.json();
  const pem = json?.data?.publicKey as string | undefined;
  const kid = json?.data?.kid as string | undefined;
  if (!pem || !kid) {
    throw new Error('服务端公钥响应无效');
  }

  const key = forge.pki.publicKeyFromPem(pem) as unknown as forge.pki.rsa.PublicKey;
  cachedPublicKey = { key, kid, cachedAt: Date.now() };
  return cachedPublicKey;
}

/** 服务端提示密文无法解密时清理缓存，下一次提交会重新获取公钥。 */
export function clearPublicKeyCache(): void {
  cachedPublicKey = null;
}

/**
 * 使用 RSA-OAEP (SHA-256) 加密密码
 * @param password 明文密码
 * @returns Base64 编码的密文
 */
export async function encryptPassword(password: string): Promise<string> {
  const { key } = await getPublicKey();

  const encrypted = key.encrypt(password, 'RSA-OAEP', {
    md: forge.md.sha256.create(),
  });
  return forge.util.encode64(encrypted);
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
