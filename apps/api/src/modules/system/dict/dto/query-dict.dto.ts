import { PaginationQueryDto } from '../../../../common/dto';
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryDictDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '搜索（字典名称/编码）' })
  @IsOptional()
  @IsString()
  search?: string;
}
