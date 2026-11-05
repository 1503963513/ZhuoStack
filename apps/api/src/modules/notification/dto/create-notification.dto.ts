import { IsNotEmpty, IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** 发送个人系统消息 */
export class CreateNotificationDto {
  @ApiProperty({ description: '通知标题', example: '系统升级通知' })
  @IsNotEmpty({ message: '通知标题不能为空' })
  @IsString()
  title: string;

  @ApiProperty({ description: '通知内容', example: '系统将于今晚 22:00 进行升级维护' })
  @IsNotEmpty({ message: '通知内容不能为空' })
  @IsString()
  content: string;

  @ApiProperty({ description: '目标用户ID' })
  @IsNotEmpty({ message: '目标用户不能为空' })
  @IsString()
  userId: string;

  @ApiPropertyOptional({ description: '关联业务类型' })
  @IsOptional()
  @IsString()
  bizType?: string;

  @ApiPropertyOptional({ description: '关联业务ID' })
  @IsOptional()
  @IsString()
  bizId?: string;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}

/** 发布系统公告 */
export class CreateAnnouncementDto {
  @ApiProperty({ description: '公告标题', example: '关于系统升级的公告' })
  @IsNotEmpty({ message: '公告标题不能为空' })
  @IsString()
  title: string;

  @ApiProperty({ description: '公告内容', example: '系统将于今晚 22:00 进行升级维护...' })
  @IsNotEmpty({ message: '公告内容不能为空' })
  @IsString()
  content: string;

  @ApiPropertyOptional({
    description: '公告状态：draft(草稿) | published(直接发布)',
    default: 'published',
  })
  @IsOptional()
  @IsIn(['draft', 'published'], { message: '状态只能为 draft 或 published' })
  status?: string;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}

/** 更新公告 */
export class UpdateAnnouncementDto {
  @ApiPropertyOptional({ description: '公告标题' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: '公告内容' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}
