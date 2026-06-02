import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ description: '旧密码' })
  @IsNotEmpty({ message: '旧密码不能为空' })
  @IsString()
  oldPassword: string;

  @ApiProperty({ description: '新密码' })
  @IsNotEmpty({ message: '新密码不能为空' })
  @IsString()
  @MinLength(6, { message: '新密码至少需要 6 个字符' })
  newPassword: string;
}
