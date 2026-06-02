import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Req,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { LogService } from '../log/log.service';
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
    private readonly logService: LogService,
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

  /**
   * Login with email and password
   */
  async login(dto: LoginDto, ip?: string): Promise<AuthResponse> {
    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      // 记录登录失败日志
      await this.logService.createLoginLog({
        username: dto.email,
        ip: ip || 'unknown',
        status: 0,
        msg: '用户不存在',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      // 记录登录失败日志
      await this.logService.createLoginLog({
        username: dto.email,
        ip: ip || 'unknown',
        status: 0,
        msg: '密码错误',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT token
    const token = this.generateToken({ sub: user.id, email: user.email });

    // 记录登录成功日志
    await this.logService.createLoginLog({
      username: dto.email,
      ip: ip || 'unknown',
      status: 1,
      msg: '登录成功',
    });

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
