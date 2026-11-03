import { PaginationQueryDto } from '../../../../common/dto';
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryFileDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '文件名搜索' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '文件类型筛选', example: 'image' })
  @IsOptional()
  @IsString()
  mimeType?: string;
}
