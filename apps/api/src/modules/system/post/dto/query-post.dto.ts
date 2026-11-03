import { PaginationQueryDto } from '../../../../common/dto';
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryPostDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '搜索（岗位名称/编码）' })
  @IsOptional()
  @IsString()
  search?: string;
}
