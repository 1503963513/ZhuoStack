/**
 * RSA 密码加密工具
 *
 * 使用 node-forge 实现 RSA 加密，兼容 HTTP 和 HTTPS 环境。
 *
 * 安全模型：
 * 1. 服务端启动时生成 RSA-2048 密钥对
 * 2. 前端通过 GET /api/auth/public-key 获取 PEM 公钥
 * 3. 使用 node-forge RSAES-PKCS1-V1_5 加密密码后传输
 * 4. 服务端用私钥解密，再 bcrypt 哈希存储/比对
 */

import forge from 'node-forge';

const PUBLIC_KEY_CACHE_TTL = 5 * 60 * 1000; // 5 分钟

let cachedPublicKey: forge.pki.rsa.PublicKey | null = null;
let cachedTimestamp = 0;

/**
 * 获取 RSA 公钥（带内存缓存）
 */
async function getPublicKey(): Promise<forge.pki.rsa.PublicKey> {
  if (cachedPublicKey && Date.now() - cachedTimestamp < PUBLIC_KEY_CACHE_TTL) {
    console.log('[RSA] 使用缓存公钥');
    return cachedPublicKey;
  }

  console.log('[RSA] 请求公钥: /api/auth/public-key');
  const res = await fetch('/api/auth/public-key');
  console.log('[RSA] 公钥响应状态:', res.status, res.ok);

  if (!res.ok) {
    throw new Error('获取公钥失败');
  }

  const json = await res.json();
  const pem = json.data.publicKey as string;
  console.log('[RSA] 公钥 PEM 长度:', pem.length);
  console.log('[RSA] 公钥前50字符:', pem.substring(0, 50));

  const publicKey = forge.pki.publicKeyFromPem(pem) as unknown as forge.pki.rsa.PublicKey;
  console.log('[RSA] 公钥解析成功, 类型:', typeof publicKey, '方法:', Object.keys(publicKey).join(', '));

  cachedPublicKey = publicKey;
  cachedTimestamp = Date.now();
  return publicKey;
}

/**
 * 使用 RSA-OAEP (SHA-256) 加密密码
 * @param password 明文密码
 * @returns Base64 编码的密文
 */
export async function encryptPassword(password: string): Promise<string> {
  console.log('[RSA] 开始加密, 密码长度:', password.length);
  const key = await getPublicKey();

  try {
    const encrypted = key.encrypt(password, 'RSA-OAEP', {
      md: forge.md.sha256.create(),
    });
    const base64 = forge.util.encode64(encrypted);
    console.log('[RSA] 加密成功, 密文Base64长度:', base64.length);
    return base64;
  } catch (e) {
    console.error('[RSA] 加密失败:', e);
    throw new Error(`RSA加密失败: ${e instanceof Error ? e.message : String(e)}`);
  }
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
