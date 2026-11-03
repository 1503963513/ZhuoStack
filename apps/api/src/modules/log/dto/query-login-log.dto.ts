import { PaginationQueryDto } from '../../../common/dto';
import { IsOptional, IsString, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryLoginLogDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '用户名' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ description: '状态（0=失败, 1=成功）' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;
}
