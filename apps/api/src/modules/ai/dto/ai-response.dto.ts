import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AiUsageDto {
  @ApiPropertyOptional({ description: '提示词消耗 token 数' })
  promptTokens?: number;

  @ApiPropertyOptional({ description: '完成消耗 token 数' })
  completionTokens?: number;

  @ApiPropertyOptional({ description: '总消耗 token 数' })
  totalTokens?: number;
}

export class ChatResponseDto {
  @ApiProperty({ description: 'AI 生成的文本内容' })
  content: string;

  @ApiProperty({ description: '实际调用的模型名称' })
  model: string;

  @ApiPropertyOptional({
    type: () => AiUsageDto,
    description: 'Token 消耗统计',
    nullable: true,
  })
  usage: AiUsageDto | null;
}

export class PromptResponseDto {
  @ApiProperty({ description: 'AI 回复的文本内容' })
  content: string;

  @ApiProperty({ description: '调用的模型名称' })
  model: string;
}
