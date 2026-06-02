import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../database/redis.service';
import { LogService } from '../log/log.service';
import { MonitorService } from '../monitor/monitor.service';
import { LoginDto, RegisterDto } from './dto';
import * as bcrypt from 'bcryptjs';

interface JwtPayload {
  sub: string;
  email: string;
}

export interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    avatar: string | null;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly logService: LogService,
    private readonly monitorService: MonitorService,
  ) {}

  /**
   * Register a new user
   */
  async register(dto: RegisterDto, ip?: string): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      // 记录注册失败日志
      await this.logService.createLoginLog({
        username: dto.email,
        ip: ip || 'unknown',
        status: 0,
        msg: '邮箱已注册',
      });
      throw new ConflictException('Email already registered');
    }

    // Hash password with bcrypt
    const hashedPassword = await bcrypt.hash(dto.password, 10);

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

    // Generate JWT token
    const token = this.generateToken({ sub: user.id, email: user.email });

    // 记录注册成功日志
    await this.logService.createLoginLog({
      username: dto.email,
      ip: ip || 'unknown',
      status: 1,
      msg: '注册成功',
    });

    return { access_token: token, user };
  }

  // 登录失败锁定配置
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 15 * 60; // 15 分钟

  /**
   * Login with email and password
   */
  async login(dto: LoginDto, ip?: string): Promise<AuthResponse> {
    // 检查账号是否被锁定
    const lockKey = `login:lock:${dto.email}`;
    const isLocked = await this.redisService.exists(lockKey);
    if (isLocked) {
      throw new ForbiddenException('账号已被锁定，请 15 分钟后重试');
    }

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      // 记录登录失败
      await this.recordLoginFailure(dto.email, ip, '用户不存在');
      throw new UnauthorizedException('邮箱或密码错误');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      // 记录登录失败
      const attempts = await this.recordLoginFailure(dto.email, ip, '密码错误');

      if (attempts >= this.MAX_LOGIN_ATTEMPTS) {
        await this.redisService.set(lockKey, true, this.LOCKOUT_DURATION);
        throw new ForbiddenException(`登录失败次数过多，账号已锁定 ${this.LOCKOUT_DURATION / 60} 分钟`);
      }

      throw new UnauthorizedException(`邮箱或密码错误（剩余 ${this.MAX_LOGIN_ATTEMPTS - attempts} 次机会）`);
    }

    // 登录成功，清除失败计数
    await this.redisService.del(`login:attempts:${dto.email}`);

    // Generate JWT token
    const token = this.generateToken({ sub: user.id, email: user.email });

    // 记录登录成功日志
    await this.logService.createLoginLog({
      username: dto.email,
      ip: ip || 'unknown',
      status: 1,
      msg: '登录成功',
    });

    // 记录在线用户
    await this.monitorService.userOnline(user.id, user.name || user.email, ip || 'unknown');

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
      },
    };
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

    let menus: any[];

    if (user.role === 'ADMIN') {
      menus = await this.prisma.sysMenu.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { sort: 'asc' },
      });
    } else {
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

      // 获取分配的菜单
      const assignedMenus = await this.prisma.sysMenu.findMany({
        where: { id: { in: Array.from(menuIdSet) }, status: 'ACTIVE' },
      });

      // 递归补全父菜单（保证树形完整）
      const allIds = new Set(menuIdSet);
      for (const menu of assignedMenus) {
        let pid = menu.parentId;
        while (pid && !allIds.has(pid)) {
          allIds.add(pid);
          const parent = await this.prisma.sysMenu.findUnique({
            where: { id: pid },
            select: { parentId: true },
          });
          if (!parent) break;
          pid = parent.parentId;
        }
      }

      menus = await this.prisma.sysMenu.findMany({
        where: { id: { in: Array.from(allIds) }, status: 'ACTIVE' },
        orderBy: { sort: 'asc' },
      });
    }

    return this.buildTree(menus);
  }

  private buildTree(menus: any[], parentId: string | null = null): any[] {
    return menus
      .filter((m) => m.parentId === parentId)
      .map((m) => ({ ...m, children: this.buildTree(menus, m.id) }));
  }

  /**
   * 记录登录失败并返回累计失败次数
   */
  private async recordLoginFailure(email: string, ip: string | undefined, msg: string): Promise<number> {
    await this.logService.createLoginLog({
      username: email,
      ip: ip || 'unknown',
      status: 0,
      msg,
    });

    const attemptsKey = `login:attempts:${email}`;
    return this.redisService.incr(attemptsKey, this.LOCKOUT_DURATION);
  }

  /**
   * 将 Token 加入黑名单（登出/改密码时调用）
   */
  async blacklistToken(token: string): Promise<void> {
    try {
      const decoded = this.jwtService.decode(token) as any;
      if (decoded?.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await this.redisService.set(`token:blacklist:${token}`, true, ttl);
        }
      }
    } catch {
      // 静默
    }
  }

  /**
   * 检查 Token 是否在黑名单中
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    return this.redisService.exists(`token:blacklist:${token}`);
  }

  /**
   * Generate JWT token
   */
  private generateToken(payload: JwtPayload): string {
    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    return this.jwtService.sign(payload, {
      secret: jwtSecret,
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '7d'),
    });
  }
}
