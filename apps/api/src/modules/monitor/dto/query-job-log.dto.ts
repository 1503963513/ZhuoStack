import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryJobLogDto {
  @ApiPropertyOptional({ description: '当前页码', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页条数', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 10;

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
