import { PaginationQueryDto } from '../../../../common/dto';
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryRoleDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '搜索（角色名称/标识）' })
  @IsOptional()
  @IsString()
  search?: string;
}
