import { PaginationQueryDto } from '../../../../common/dto';
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryConfigDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '搜索（配置名称/键名）' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '配置分组' })
  @IsOptional()
  @IsString()
  group?: string;
}
