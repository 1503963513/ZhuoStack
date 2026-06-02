import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: '用户注册' })
  @ApiResponse({ status: 201, description: '注册成功' })
  @ApiResponse({ status: 409, description: '邮箱已注册' })
  register(@Body() dto: RegisterDto, @Req() req: any) {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    return this.authService.register(dto, ip);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户登录' })
  @ApiResponse({ status: 200, description: '登录成功' })
  @ApiResponse({ status: 401, description: '认证失败' })
  login(@Body() dto: LoginDto, @Req() req: any) {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    return this.authService.login(dto, ip);
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
  async logout(@Req() req: any) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      await this.authService.blacklistToken(token);
    }
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
