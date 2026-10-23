import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Status } from '@prisma/client';

export class PostItemDto {
  @ApiProperty({ description: '岗位 ID' })
  id: string;

  @ApiProperty({ description: '岗位编码' })
  code: string;

  @ApiProperty({ description: '岗位名称' })
  name: string;

  @ApiProperty({ description: '排序号' })
  sort: number;

  @ApiProperty({ enum: Status, description: '状态' })
  status: Status;

  @ApiPropertyOptional({ type: String, description: '备注', nullable: true })
  remark: string | null;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}
