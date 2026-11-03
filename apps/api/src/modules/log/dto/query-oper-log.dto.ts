import { PaginationQueryDto } from '../../../common/dto';
import { IsOptional, IsString, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryOperLogDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '操作标题' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: '状态（0=失败, 1=成功）' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;
}
