import { IsOptional, IsString, IsEmail, IsArray, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({ description: '用户名称', example: 'John Doe' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '用户邮箱', example: 'user@example.com' })
  @IsOptional()
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email?: string;

  @ApiPropertyOptional({ description: '用户头像 URL' })
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiPropertyOptional({ description: '用户密码（留空不修改）' })
  @IsOptional()
  @IsString()
  @MinLength(6, { message: '密码至少 6 个字符' })
  password?: string;

  @ApiPropertyOptional({ description: '系统角色', example: 'USER' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ description: '部门 ID' })
  @IsOptional()
  @IsString()
  deptId?: string;

  @ApiPropertyOptional({ description: '岗位 ID 列表', type: [String] })
  @IsOptional()
  @IsArray()
  postIds?: string[];

  @ApiPropertyOptional({ description: '角色 ID 列表', type: [String] })
  @IsOptional()
  @IsArray()
  roleIds?: string[];
}
