import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class BatchDeleteDto {
  @ApiProperty({ type: [String], description: '文件 ID 列表' })
  @IsArray()
  @IsString({ each: true })
  ids: string[];
}
