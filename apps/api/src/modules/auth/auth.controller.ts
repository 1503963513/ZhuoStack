import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply, FastifyRequest } from 'fastify';
import * as crypto from 'crypto';
import { LoginDto, RegisterDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators';
import {
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  durationToSeconds,
  extractAuthToken,
} from './auth-security';
import UAParser = require('ua-parser-js');

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private issueAuthCookies(reply: FastifyReply, token: string): void {
    const secure = this.configService.get<string>('NODE_ENV') === 'production';
    const maxAge = durationToSeconds(
      this.configService.get<string>('JWT_EXPIRES_IN', '8h'),
    );
    const commonOptions = {
      path: '/',
      secure,
      sameSite: 'strict' as const,
      maxAge,
      priority: 'high' as const,
    };

    reply.setCookie(AUTH_COOKIE_NAME, token, {
      ...commonOptions,
      httpOnly: true,
    });
    reply.setCookie(CSRF_COOKIE_NAME, crypto.randomBytes(32).toString('base64url'), {
      ...commonOptions,
      httpOnly: false,
    });
  }

  private clearAuthCookies(reply: FastifyReply): void {
    const secure = this.configService.get<string>('NODE_ENV') === 'production';
    const options = { path: '/', secure, sameSite: 'strict' as const };
    reply.clearCookie(AUTH_COOKIE_NAME, options);
    reply.clearCookie(CSRF_COOKIE_NAME, options);
  }

  /** 从请求头解析浏览器和操作系统信息 */
  private parseUA(req: { headers: Record<string, string | string[] | undefined> }): { browser?: string; os?: string } {
    const ua = new UAParser.UAParser(req.headers['user-agent'] as string);
    const browser = ua.getBrowser().name || undefined;
    const osName = ua.getOS().name;
    const osVersion = ua.getOS().version;
    const os = osName ? `${osName}${osVersion ? ` ${osVersion}` : ''}` : undefined;
    return { browser, os };
  }

  @Get('public-key')
  @ApiOperation({ summary: '获取 RSA 公钥（用于密码加密传输）' })
  @ApiResponse({ status: 200, description: '获取成功' })
  getPublicKey() {
    return { publicKey: this.authService.getPublicKey() };
  }

  @Get('captcha')
  @ApiOperation({ summary: '获取图形验证码' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getCaptcha() {
    return this.authService.generateCaptcha();
  }

  @Post('register')
  @ApiOperation({ summary: '用户注册' })
  @ApiResponse({ status: 201, description: '注册成功' })
  @ApiResponse({ status: 409, description: '邮箱已注册' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const uaInfo = this.parseUA(req);
    const result = await this.authService.register(dto, String(ip), uaInfo);
    this.issueAuthCookies(reply, result.access_token);
    return { user: result.user };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户登录' })
  @ApiResponse({ status: 200, description: '登录成功' })
  @ApiResponse({ status: 401, description: '认证失败' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const uaInfo = this.parseUA(req);
    const result = await this.authService.login(dto, String(ip), uaInfo);
    this.issueAuthCookies(reply, result.access_token);
    return { user: result.user };
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前用户资料' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  getProfile(@CurrentUser('id') userId: string) {
    return this.authService.getProfile(userId);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '退出登录（Token 失效）' })
  @ApiResponse({ status: 200, description: '退出成功' })
  async logout(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const token = extractAuthToken(req);
    if (token) {
      await this.authService.blacklistToken(token);
    }
    this.clearAuthCookies(reply);
    return { message: '退出成功' };
  }

  @Get('menus')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前用户的菜单权限（按角色过滤）' })
  @ApiResponse({ status: 200, description: '获取成功' })
  getUserMenus(@CurrentUser('id') userId: string) {
    return this.authService.getUserMenus(userId);
  }
}
