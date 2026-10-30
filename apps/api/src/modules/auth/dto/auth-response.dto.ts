import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class PublicKeyResponseDto {
  @ApiProperty({ description: 'RSA-2048 公钥内容' })
  publicKey: string;
}

export class CaptchaResponseDto {
  @ApiProperty({ description: '验证码唯一标识 ID' })
  captchaId: string;

  @ApiProperty({ description: '验证码 SVG 图片字符串' })
  captchaImage: string;
}

export class AuthUserDto {
  @ApiProperty({ description: '用户 ID' })
  id: string;

  @ApiProperty({ description: '用户邮箱' })
  email: string;

  @ApiPropertyOptional({ type: String, description: '用户昵称/姓名', nullable: true })
  name: string | null;

  @ApiProperty({ enum: Role, description: '主角色' })
  role: Role;

  @ApiPropertyOptional({ type: String, description: '用户头像 URL', nullable: true })
  avatar: string | null;
}

export class AuthSuccessResponseDto {
  @ApiProperty({ type: () => AuthUserDto, description: '当前登录用户信息' })
  user: AuthUserDto;
}

export class UserProfileDto {
  @ApiProperty({ description: '用户 ID' })
  id: string;

  @ApiProperty({ description: '用户邮箱' })
  email: string;

  @ApiPropertyOptional({ type: String, description: '用户昵称/姓名', nullable: true })
  name: string | null;

  @ApiProperty({ enum: Role, description: '主角色' })
  role: Role;

  @ApiPropertyOptional({ type: String, description: '用户头像 URL', nullable: true })
  avatar: string | null;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}

export class UserMenuTreeNodeDto {
  @ApiProperty({ description: '菜单 ID' })
  id: string;

  @ApiPropertyOptional({ type: String, description: '父级菜单 ID', nullable: true })
  parentId: string | null;

  @ApiProperty({ description: '菜单名称' })
  name: string;

  @ApiProperty({ description: '菜单类型: DIRECTORY / MENU / BUTTON' })
  type: string;

  @ApiPropertyOptional({ type: String, description: '路由路径', nullable: true })
  path: string | null;

  @ApiPropertyOptional({ type: String, description: '前端组件路径', nullable: true })
  component: string | null;

  @ApiPropertyOptional({ type: String, description: '图标', nullable: true })
  icon: string | null;

  @ApiProperty({ description: '排序号' })
  sort: number;

  @ApiProperty({ description: '状态: ACTIVE / INACTIVE' })
  status: string;

  @ApiProperty({ description: '是否隐藏', default: false })
  hidden: boolean;

  @ApiPropertyOptional({
    type: () => [UserMenuTreeNodeDto],
    description: '子菜单列表',
  })
  children?: UserMenuTreeNodeDto[];
}

export class LogoutResponseDto {
  @ApiProperty({ description: '提示信息', example: '退出成功' })
  message: string;
}
