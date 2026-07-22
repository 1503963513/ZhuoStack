import { registerAs } from '@nestjs/config';

export const jwtConfig = registerAs('jwt', () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET 环境变量未设置，应用无法启动');
  }
  // 拒绝已知的弱密钥和模板默认值
  const WEAK_SECRETS = [
    'default-secret',
    'your-super-secret-jwt-key-change-in-production',
    'secret',
    'jwt-secret',
    'changeme',
    '123456',
  ];
  if (WEAK_SECRETS.includes(secret.toLowerCase()) || secret.length < 32) {
    throw new Error(
      `JWT_SECRET 不安全（过短或为已知弱密钥）。请使用至少 32 字符的随机密钥。` +
        `可运行: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`,
    );
  }

  return {
    secret,
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    issuer: process.env.JWT_ISSUER || 'myapp-api',
    audience: process.env.JWT_AUDIENCE || 'myapp-web',
    algorithm: 'HS256',
  };
});
