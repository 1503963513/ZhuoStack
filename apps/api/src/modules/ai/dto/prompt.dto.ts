import { IsNotEmpty, IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PromptDto {
  @ApiProperty({ description: '提示内容', example: '你好，请介绍一下自己' })
  @IsNotEmpty({ message: '内容不能为空' })
  @IsString()
  @MaxLength(5000, { message: '提示内容不能超过 5000 字符' })
  content: string;

  @ApiPropertyOptional({ description: '系统提示词', example: '你是一个 helpful 助手' })
  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: '系统提示词不能超过 5000 字符' })
  systemPrompt?: string;

  @ApiPropertyOptional({ description: '模型名称', example: 'gpt-4o' })
  @IsOptional()
  @IsString()
  model?: string;
}
