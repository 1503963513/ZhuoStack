/**
 * 密码哈希工具
 * 使用 SHA-256 对密码进行客户端哈希，避免明文传输
 * 后端会再次使用 bcrypt 进行二次哈希存储
 */

/**
 * 使用 SHA-256 哈希密码
 * @param password 原始密码
 * @returns 哈希后的十六进制字符串
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * 验证密码是否匹配（用于前端密码确认场景）
 * @param password 原始密码
 * @param confirmPassword 确认密码
 * @returns 是否匹配
 */
export async function verifyPasswordMatch(
  password: string,
  confirmPassword: string,
): Promise<boolean> {
  const hash1 = await hashPassword(password);
  const hash2 = await hashPassword(confirmPassword);
  return hash1 === hash2;
}
