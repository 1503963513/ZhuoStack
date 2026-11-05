import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationItemDto {
  @ApiProperty({ description: '通知 ID' })
  id: string;

  @ApiProperty({ description: '通知类型' })
  type: string;

  @ApiProperty({ description: '通知标题' })
  title: string;

  @ApiProperty({ description: '通知内容' })
  content: string;

  @ApiPropertyOptional({ type: String, description: '目标用户ID', nullable: true })
  userId: string | null;

  @ApiPropertyOptional({ type: String, description: '发送者ID', nullable: true })
  senderId: string | null;

  @ApiPropertyOptional({ type: String, description: '发送者名称', nullable: true })
  senderName: string | null;

  @ApiProperty({ description: '是否已读' })
  isRead: boolean;

  @ApiPropertyOptional({ type: Date, description: '阅读时间', nullable: true })
  readAt: Date | null;

  @ApiPropertyOptional({ type: String, description: '关联业务类型', nullable: true })
  bizType: string | null;

  @ApiPropertyOptional({ type: String, description: '关联业务ID', nullable: true })
  bizId: string | null;

  @ApiPropertyOptional({ type: String, description: '公告状态', nullable: true })
  status: string | null;

  @ApiPropertyOptional({ type: String, description: '备注', nullable: true })
  remark: string | null;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;
}

export class UnreadCountDto {
  @ApiProperty({ description: '未读通知总数', example: 5 })
  total: number;

  @ApiProperty({ description: '未读公告数', example: 2 })
  announcement: number;

  @ApiProperty({ description: '未读系统消息数', example: 3 })
  system: number;
}
