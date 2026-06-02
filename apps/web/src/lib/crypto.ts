/**
 * RSA 密码加密工具
 *
 * 安全模型：
 * 1. 服务端启动时生成 RSA-2048 密钥对
 * 2. 前端通过 GET /api/auth/public-key 获取公钥
 * 3. 使用 RSA-OAEP (SHA-256) 加密密码后传输
 * 4. 服务端用私钥解密，再 bcrypt 哈希存储/比对
 *
 * 即使 TLS 被中间人代理（如企业网关），密码也不会泄露。
 * 每次服务端重启密钥对更换，无法跨会话重放。
 */

const PUBLIC_KEY_CACHE_TTL = 5 * 60 * 1000; // 5 分钟

interface CachedKey {
  pem: string;
  cryptoKey: CryptoKey;
  timestamp: number;
}

let cachedKey: CachedKey | null = null;

/**
 * 获取 RSA 公钥（带缓存）
 */
async function getPublicKey(): Promise<{ pem: string; cryptoKey: CryptoKey }> {
  // 检查内存缓存
  if (cachedKey && Date.now() - cachedKey.timestamp < PUBLIC_KEY_CACHE_TTL) {
    return { pem: cachedKey.pem, cryptoKey: cachedKey.cryptoKey };
  }

  // 从服务端获取 PEM 公钥（走 Next.js /api 代理，避免 CORS）
  const res = await fetch('/api/auth/public-key');
  if (!res.ok) {
    throw new Error('获取公钥失败');
  }
  const json = await res.json();
  const publicKey = json.data.publicKey as string;

  // PEM → ArrayBuffer
  const pemBody = publicKey
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\s/g, '');
  const binaryStr = atob(pemBody);
  const buffer = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    buffer[i] = binaryStr.charCodeAt(i);
  }

  // 导入为 Web Crypto Key
  const cryptoKey = await crypto.subtle.importKey(
    'spki',
    buffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  );

  // 缓存
  cachedKey = { pem: publicKey, cryptoKey, timestamp: Date.now() };
  return { pem: publicKey, cryptoKey };
}

/**
 * 使用 RSA-OAEP 加密密码
 * @param password 明文密码
 * @returns Base64 编码的密文
 */
export async function encryptPassword(password: string): Promise<string> {
  const { cryptoKey } = await getPublicKey();

  const encoded = new TextEncoder().encode(password);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    cryptoKey,
    encoded,
  );

  // ArrayBuffer → Base64
  const bytes = new Uint8Array(encrypted);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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
