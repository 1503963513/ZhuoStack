import { PaginationQueryDto } from '../../../common/dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryJobLogDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '任务标识名称' })
  @IsOptional()
  @IsString()
  jobName?: string;

  @ApiPropertyOptional({ description: '执行状态: 1-成功, 0-失败' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;
}
