import { IsNotEmpty, IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PromptDto {
  @ApiProperty({ description: '提示内容', example: '你好，请介绍一下自己' })
  @IsNotEmpty({ message: '内容不能为空' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: '系统提示词', example: '你是一个 helpful 助手' })
  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @ApiPropertyOptional({ description: '模型名称', example: 'gpt-4o' })
  @IsOptional()
  @IsString()
  model?: string;
}
