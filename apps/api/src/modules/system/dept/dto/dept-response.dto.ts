import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Status } from '@prisma/client';

export class DeptItemDto {
  @ApiProperty({ description: '部门 ID' })
  id: string;

  @ApiProperty({ description: '部门名称' })
  name: string;

  @ApiPropertyOptional({ type: String, description: '父级部门 ID', nullable: true })
  parentId: string | null;

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

export class DeptTreeNodeDto extends DeptItemDto {
  @ApiPropertyOptional({
    type: () => [DeptTreeNodeDto],
    description: '子部门列表',
  })
  children?: DeptTreeNodeDto[];
}
