import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class MessageDto {
  @ApiProperty({ description: 'Message role', example: 'user', enum: ['system', 'user', 'assistant'] })
  @IsString()
  @IsIn(['system', 'user', 'assistant'])
  role: 'system' | 'user' | 'assistant';

  @ApiProperty({ description: 'Message content', example: 'Hello, how are you?' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000, { message: '单条消息不能超过 5000 字符' })
  content: string;
}

export class ChatDto {
  @ApiProperty({ description: 'Array of chat messages', type: [MessageDto] })
  @IsArray()
  @Max(20, { message: '消息条数不能超过 20 条' })
  @ValidateNested({ each: true })
  @Type(() => MessageDto)
  messages: MessageDto[];

  @ApiPropertyOptional({ description: 'Model name', example: 'gpt-4o' })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({ description: 'Temperature (0-2)', example: 0.7 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiPropertyOptional({ description: 'Max tokens', example: 4096 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(128000)
  maxTokens?: number;
}

export class StreamChatDto extends ChatDto {}
