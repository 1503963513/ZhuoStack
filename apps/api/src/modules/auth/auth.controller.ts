import { Controller, Post, Get, Body, HttpCode, HttpStatus, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply, FastifyRequest } from 'fastify';
import * as crypto from 'crypto';
import UAParser from 'ua-parser-js';
import {
  LoginDto,
  RegisterDto,
  PublicKeyResponseDto,
  CaptchaResponseDto,
  AuthSuccessResponseDto,
  UserProfileDto,
  LogoutResponseDto,
  UserMenuTreeNodeDto,
} from './dto';
import { CurrentUser, Public, ApiResultResponse, ApiErrorResponse } from '../../common/decorators';
import {
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  durationToSeconds,
  extractAuthToken,
} from './auth-security';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private isSecure(reply: FastifyReply): boolean {
    const configSecure = this.configService.get<string>('COOKIE_SECURE');
    if (configSecure !== undefined) {
      return configSecure === 'true';
    }
    // 未显式配置时，检查当前请求是否真正为 https
    const isHttps =
      reply.request?.protocol === 'https' ||
      reply.request?.headers['x-forwarded-proto'] === 'https';
    return isHttps;
  }

  private issueAuthCookies(reply: FastifyReply, token: string): void {
    const secure = this.isSecure(reply);
    const maxAge = durationToSeconds(this.configService.get<string>('JWT_EXPIRES_IN', '8h'));
    const commonOptions = {
      path: '/',
      secure,
      sameSite: 'lax' as const,
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
    const secure = this.isSecure(reply);
    const options = { path: '/', secure, sameSite: 'lax' as const };
    reply.clearCookie(AUTH_COOKIE_NAME, options);
    reply.clearCookie(CSRF_COOKIE_NAME, options);
  }

  /** 从请求头解析浏览器和操作系统信息 */
  private parseUA(req: { headers: Record<string, string | string[] | undefined> }): {
    browser?: string;
    os?: string;
  } {
    const ua = new UAParser.UAParser(req.headers['user-agent'] as string);
    const browser = ua.getBrowser().name || undefined;
    const osName = ua.getOS().name;
    const osVersion = ua.getOS().version;
    const os = osName ? `${osName}${osVersion ? ` ${osVersion}` : ''}` : undefined;
    return { browser, os };
  }

  @Get('public-key')
  @Public()
  @ApiOperation({ summary: '获取 RSA 公钥（用于密码加密传输）' })
  @ApiResultResponse(PublicKeyResponseDto, { description: '获取公钥成功' })
  getPublicKey() {
    return { publicKey: this.authService.getPublicKey() };
  }

  @Get('captcha')
  @Public()
  @ApiOperation({ summary: '获取图形验证码' })
  @ApiResultResponse(CaptchaResponseDto, { description: '获取验证码成功' })
  async getCaptcha() {
    return this.authService.generateCaptcha();
  }

  @Post('register')
  @Public()
  @ApiOperation({ summary: '用户注册' })
  @ApiResultResponse(AuthSuccessResponseDto, {
    status: HttpStatus.CREATED,
    description: '注册成功',
  })
  @ApiErrorResponse(HttpStatus.CONFLICT, '邮箱已注册')
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, '验证码错误或参数无效')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const ip = req.ip || 'unknown';
    const uaInfo = this.parseUA(req);
    const result = await this.authService.register(dto, String(ip), uaInfo);
    this.issueAuthCookies(reply, result.access_token);
    return { user: result.user };
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户登录' })
  @ApiResultResponse(AuthSuccessResponseDto, { description: '登录成功' })
  @ApiErrorResponse(HttpStatus.UNAUTHORIZED, '认证失败或密码错误')
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, '验证码错误或账号已被锁定')
  async login(
    @Body() dto: LoginDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const ip = req.ip || 'unknown';
    const uaInfo = this.parseUA(req);
    const result = await this.authService.login(dto, String(ip), uaInfo);
    this.issueAuthCookies(reply, result.access_token);
    return { user: result.user };
  }

  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前用户资料' })
  @ApiResultResponse(UserProfileDto, { description: '获取用户资料成功' })
  @ApiErrorResponse(HttpStatus.UNAUTHORIZED, '未授权')
  getProfile(@CurrentUser('id') userId: string) {
    return this.authService.getProfile(userId);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '退出登录（Token 失效）' })
  @ApiResultResponse(LogoutResponseDto, { description: '退出成功' })
  async logout(@Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const token = extractAuthToken(req);
    if (token) {
      await this.authService.blacklistToken(token);
    }
    this.clearAuthCookies(reply);
    return { message: '退出成功' };
  }

  @Get('menus')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前用户的菜单权限（按角色过滤）' })
  @ApiResultResponse(UserMenuTreeNodeDto, { isArray: true, description: '获取菜单列表成功' })
  getUserMenus(@CurrentUser('id') userId: string) {
    return this.authService.getUserMenus(userId);
  }
}
