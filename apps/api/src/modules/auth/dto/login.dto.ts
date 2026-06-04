import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ description: 'User email', example: 'admin@example.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({ description: 'User password', example: 'admin123' })
  @IsNotEmpty({ message: 'Password is required' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;

  @ApiProperty({ description: '验证码 ID', example: 'abc123' })
  @IsNotEmpty({ message: '验证码 ID 不能为空' })
  @IsString()
  captchaId: string;

  @ApiProperty({ description: '验证码', example: 'aB3x' })
  @IsNotEmpty({ message: '验证码不能为空' })
  @IsString()
  captchaCode: string;
}
