import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../database/redis.service';
import { LogService } from '../log/log.service';
import { SessionService } from './session.service';
import { RsaKeyService, type PublicKeyMaterial } from './rsa-key.service';
import { LoginDto, RegisterDto } from './dto';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as svgCaptcha from 'svg-captcha';
import { durationToSeconds } from './auth-security';

interface JwtPayload {
  sub: string;
  email: string;
  jti?: string;
}

/** generateToken 返回值 */
interface TokenResult {
  token: string;
  jti: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    avatar: string | null;
  };
}

/** 菜单树节点（buildTree 返回值） */
export interface MenuTreeNode {
  id: string;
  parentId: string | null;
  name: string;
  type: string;
  path: string | null;
  component: string | null;
  icon: string | null;
  sort: number;
  status: string;
  perms: string | null;
  remark: string | null;
  children: MenuTreeNode[];
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly logService: LogService,
    private readonly sessionService: SessionService,
    private readonly rsaKeyService: RsaKeyService,
  ) {}

  /**
   * 获取 RSA 公钥（前端用于加密密码）
   */
  getPublicKey(): PublicKeyMaterial {
    return this.rsaKeyService.getPublicKey();
  }

  /**
   * 解密前端使用 RSA-OAEP (SHA-256) 加密的密码。
   */
  decryptPassword(encrypted: string): string {
    return this.rsaKeyService.decryptPassword(encrypted);
  }

  /**
   * Register a new user
   */
  async register(
    dto: RegisterDto,
    ip?: string,
    uaInfo?: { browser?: string; os?: string },
  ): Promise<AuthResponse> {
    // 校验验证码
    const captchaValid = await this.verifyCaptcha(dto.captchaId, dto.captchaCode);
    if (!captchaValid) {
      throw new BadRequestException('验证码错误或已过期');
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      // 记录注册失败日志
      await this.logService.createLoginLog({
        userId: existingUser.id,
        username: dto.email,
        ip: ip || 'unknown',
        browser: uaInfo?.browser,
        os: uaInfo?.os,
        status: 0,
        msg: '邮箱已注册',
      });
      throw new ConflictException('Email already registered');
    }

    // RSA 解密前端传来的密码密文，再 bcrypt 哈希
    const plainPassword = this.decryptPassword(dto.password);
    const hashedPassword = await bcrypt.hash(plainPassword, 12);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: hashedPassword,
        avatar: dto.avatar || null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
      },
    });

    const session = await this.establishSession(user, ip, uaInfo);

    // 记录注册成功日志
    await this.logService.createLoginLog({
      userId: user.id,
      username: dto.email,
      ip: ip || 'unknown',
      browser: uaInfo?.browser,
      os: uaInfo?.os,
      status: 1,
      msg: '注册成功',
    });

    return session;
  }

  // 登录失败锁定配置
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 15 * 60; // 15 分钟

  /**
   * Login with email and password
   */
  async login(
    dto: LoginDto,
    ip?: string,
    uaInfo?: { browser?: string; os?: string },
  ): Promise<AuthResponse> {
    // 校验验证码
    const captchaValid = await this.verifyCaptcha(dto.captchaId, dto.captchaCode);
    if (!captchaValid) {
      throw new BadRequestException('验证码错误或已过期');
    }

    // 检查账号是否被锁定
    const lockKey = `login:lock:${dto.email}`;
    const isLocked = await this.redisService.exists(lockKey, true);
    if (isLocked) {
      throw new ForbiddenException('账号已被锁定，请 15 分钟后重试');
    }

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      // 记录登录失败
      await this.recordLoginFailure(dto.email, ip, '用户不存在', uaInfo);
      throw new UnauthorizedException('邮箱或密码错误');
    }

    // Verify password（先 RSA 解密前端密文）
    const plainPassword = this.decryptPassword(dto.password);
    const isPasswordValid = await bcrypt.compare(plainPassword, user.password);

    if (!isPasswordValid) {
      // 记录登录失败
      const attempts = await this.recordLoginFailure(dto.email, ip, '密码错误', uaInfo, user.id);

      if (attempts >= this.MAX_LOGIN_ATTEMPTS) {
        await this.redisService.set(lockKey, true, this.LOCKOUT_DURATION, true);
        throw new ForbiddenException('邮箱或密码错误');
      }

      // 不泄露剩余次数，统一返回相同错误信息
      throw new UnauthorizedException('邮箱或密码错误');
    }

    // 登录成功，清除失败计数和踢出标记
    await this.redisService.del(`login:attempts:${dto.email}`, true);
    await this.sessionService.clearKicked(user.id);

    const session = await this.establishSession(user, ip, uaInfo);

    // 记录登录成功日志
    await this.logService.createLoginLog({
      userId: user.id,
      username: dto.email,
      ip: ip || 'unknown',
      browser: uaInfo?.browser,
      os: uaInfo?.os,
      status: 1,
      msg: '登录成功',
    });

    return session;
  }

  /** 使用一次性 Refresh Token 轮换访问令牌和刷新令牌。 */
  async refreshSession(
    refreshToken: string,
    ip?: string,
    uaInfo?: { browser?: string; os?: string },
  ): Promise<AuthResponse> {
    const separator = refreshToken.indexOf('.');
    const userId = separator > 0 ? refreshToken.slice(0, separator) : '';
    if (!userId || separator === refreshToken.length - 1) {
      throw new UnauthorizedException('刷新会话无效，请重新登录');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException('刷新会话无效，请重新登录');
    }

    const session = await this.establishSession(user, ip, uaInfo, refreshToken);
    return session;
  }

  /**
   * 建立单设备会话：签发短期 JWT、一次性轮换的 Refresh Token，并激活两者。
   * 若传入 previousRefreshToken，则只有该令牌仍为当前值时才会完成轮换。
   */
  private async establishSession(
    user: {
      id: string;
      email: string;
      name: string | null;
      role: string;
      avatar: string | null;
    },
    ip?: string,
    uaInfo?: { browser?: string; os?: string },
    previousRefreshToken?: string,
  ): Promise<AuthResponse> {
    const { token, jti } = this.generateToken({ sub: user.id, email: user.email });
    const refreshToken = this.generateRefreshToken(user.id);
    const refreshTtl = this.refreshTtlSeconds();

    if (previousRefreshToken) {
      const rotated = await this.sessionService.rotateRefresh(
        user.id,
        this.hashRefreshToken(previousRefreshToken),
        this.hashRefreshToken(refreshToken),
        refreshTtl,
      );
      if (!rotated) {
        throw new UnauthorizedException('刷新会话已失效，请重新登录');
      }
    } else {
      await this.sessionService.activateRefresh(
        user.id,
        this.hashRefreshToken(refreshToken),
        refreshTtl,
      );
    }

    await this.sessionService.activate(user.id, jti, this.tokenTtlSeconds(), {
      userName: user.name || user.email,
      email: user.email,
      avatar: user.avatar,
      ip: ip || 'unknown',
      browser: uaInfo?.browser,
      os: uaInfo?.os,
    });

    return {
      access_token: token,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
      },
    };
  }

  private generateRefreshToken(userId: string): string {
    return `${userId}.${crypto.randomBytes(32).toString('base64url')}`;
  }

  private hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Get user profile
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  /**
   * 获取当前用户的菜单权限（按角色过滤，返回树形结构）
   * 管理员返回所有菜单，普通用户返回角色关联的菜单
   */
  async getUserMenus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    // 一次性查出所有活跃菜单，后续在内存中过滤（避免 N+1 查询）
    const allActiveMenus = await this.prisma.sysMenu.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { sort: 'asc' },
    });

    if (user.role === 'ADMIN') {
      return this.buildTree(allActiveMenus);
    }

    // 普通用户：先收集角色关联的菜单 ID
    const roleIds = user.roles.map((r) => r.id);
    if (roleIds.length === 0) return [];

    const roles = await this.prisma.sysRole.findMany({
      where: { id: { in: roleIds } },
      include: { menus: true },
    });

    const menuIdSet = new Set<string>();
    for (const role of roles) {
      for (const menu of role.menus) {
        menuIdSet.add(menu.id);
      }
    }

    if (menuIdSet.size === 0) return [];

    // 在内存中用 Map 补全父菜单链（O(1) 查找，无额外数据库查询）
    const menuMap = new Map(allActiveMenus.map((m) => [m.id, m]));
    for (const menuId of new Set(menuIdSet)) {
      let pid = menuMap.get(menuId)?.parentId ?? null;
      while (pid && !menuIdSet.has(pid)) {
        menuIdSet.add(pid);
        pid = menuMap.get(pid)?.parentId ?? null;
      }
    }

    // 过滤出用户有权访问的菜单
    const menus = allActiveMenus.filter((m) => menuIdSet.has(m.id));
    return this.buildTree(menus);
  }

  private buildTree(
    menus: { id: string; parentId: string | null; [key: string]: unknown }[],
    parentId: string | null = null,
  ): MenuTreeNode[] {
    return menus
      .filter((m) => m.parentId === parentId)
      .map((m) => ({ ...m, children: this.buildTree(menus, m.id) }) as MenuTreeNode);
  }

  // ========== 图形验证码 ==========

  /**
   * 生成图形验证码
   * @returns { captchaId, captchaImage (SVG 字符串) }
   */
  async generateCaptcha(): Promise<{ captchaId: string; captchaImage: string }> {
    const captcha = svgCaptcha.create({
      size: 4,
      ignoreChars: '0o1ilI',
      noise: 3,
      color: true,
      background: '#f0f0f0',
    });

    const captchaId = crypto.randomUUID();
    // 答案存 Redis，5 分钟过期
    await this.redisService.set(`captcha:${captchaId}`, captcha.text.toLowerCase(), 300, true);

    return { captchaId, captchaImage: captcha.data };
  }

  /**
   * 校验验证码（一次性，原子获取并删除，避免并发竞态）
   */
  async verifyCaptcha(captchaId: string, captchaCode: string): Promise<boolean> {
    const key = `captcha:${captchaId}`;
    // GETDEL 原子操作：获取的同时删除，杜绝并发重复验证
    const expected = await this.redisService.getdel<string>(key, true);
    if (!expected) return false;

    return expected === captchaCode.toLowerCase();
  }

  /**
   * 记录登录失败并返回累计失败次数
   */
  private async recordLoginFailure(
    email: string,
    ip: string | undefined,
    msg: string,
    uaInfo?: { browser?: string; os?: string },
    userId?: string,
  ): Promise<number> {
    await this.logService.createLoginLog({
      userId,
      username: email,
      ip: ip || 'unknown',
      browser: uaInfo?.browser,
      os: uaInfo?.os,
      status: 0,
      msg,
    });

    const attemptsKey = `login:attempts:${email}`;
    return this.redisService.incr(attemptsKey, this.LOCKOUT_DURATION, true);
  }

  /** 吊销用户的全部当前端会话（登出、改密、重置密码、删除用户、踢下线）。 */
  async revokeUserSessions(userId: string, options: { kicked?: boolean } = {}): Promise<boolean> {
    return this.sessionService.revokeUserSessions(userId, options);
  }

  /**
   * 将 Token 加入黑名单（登出/改密码时调用）
   * 使用 SHA-256 哈希的前 32 字符作为 Redis key，节省内存
   */
  async blacklistToken(token: string): Promise<void> {
    let decoded: { exp?: number } | null = null;
    try {
      decoded = this.jwtService.decode(token) as { exp?: number } | null;
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`Token 解码失败，跳过黑名单写入: ${errMsg}`);
      return;
    }

    if (!decoded?.exp) {
      this.logger.warn('Token 无 exp 字段，跳过黑名单写入');
      return;
    }

    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    if (ttl <= 0) return;

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex').substring(0, 32);
    await this.redisService.set(`token:blacklist:${tokenHash}`, true, ttl, true);
  }

  /**
   * 检查 Token 是否在黑名单中
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex').substring(0, 32);
    return this.redisService.exists(`token:blacklist:${tokenHash}`, true);
  }

  /**
   * Generate JWT token（附带唯一 jti，用于单设备登录控制）
   */
  private generateToken(payload: Omit<JwtPayload, 'jti'>): TokenResult {
    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    const jti = crypto.randomUUID();
    const expiresIn = this.configService.get<string>(
      'JWT_EXPIRES_IN',
      '8h',
    ) as JwtSignOptions['expiresIn'];
    const token = this.jwtService.sign(
      { ...payload, jti },
      {
        secret: jwtSecret,
        expiresIn,
        algorithm: 'HS256',
        issuer: this.configService.get<string>('JWT_ISSUER', 'zhuostack-api'),
        audience: this.configService.get<string>('JWT_AUDIENCE', 'zhuostack-web'),
      },
    );

    return { token, jti };
  }

  private tokenTtlSeconds(): number {
    return durationToSeconds(this.configService.get<string>('JWT_EXPIRES_IN', '8h'));
  }

  private refreshTtlSeconds(): number {
    return durationToSeconds(this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'));
  }
}
