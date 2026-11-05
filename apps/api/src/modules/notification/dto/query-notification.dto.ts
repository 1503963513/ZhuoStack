import { IsOptional, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto';
import { Transform } from 'class-transformer';

export class QueryNotificationDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: '通知类型：announcement(公告) | system(系统消息)',
  })
  @IsOptional()
  @IsIn(['announcement', 'system'], { message: '类型只能为 announcement 或 system' })
  type?: string;

  @ApiPropertyOptional({ description: '已读状态筛选' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  isRead?: boolean;
}
