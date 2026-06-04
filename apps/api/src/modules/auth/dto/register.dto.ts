import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ description: 'User email', example: 'user@example.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({ description: 'User name', example: 'John Doe' })
  @IsNotEmpty({ message: 'Name is required' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'User password', example: 'password123' })
  @IsNotEmpty({ message: 'Password is required' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;

  @ApiPropertyOptional({ description: 'User avatar URL' })
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiProperty({ description: '验证码 ID', example: 'abc123' })
  @IsNotEmpty({ message: '验证码 ID 不能为空' })
  @IsString()
  captchaId: string;

  @ApiProperty({ description: '验证码', example: 'aB3x' })
  @IsNotEmpty({ message: '验证码不能为空' })
  @IsString()
  captchaCode: string;
}
