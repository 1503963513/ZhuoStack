import { PaginationQueryDto } from '../../../common/dto';
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryUserDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '搜索（用户名/邮箱）' })
  @IsOptional()
  @IsString()
  search?: string;
}
