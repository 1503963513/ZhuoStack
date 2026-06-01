import { ApiProperty } from '@nestjs/swagger';

export class DeptEntity {
  @ApiProperty({ description: '部门ID' })
  id: string;

  @ApiProperty({ description: '部门名称' })
  name: string;

  @ApiProperty({ description: '父部门ID', required: false })
  parentId: string | null;

  @ApiProperty({ description: '排序' })
  sort: number;

  @ApiProperty({ description: '状态', enum: ['ACTIVE', 'INACTIVE'] })
  status: string;

  @ApiProperty({ description: '备注', required: false })
  remark: string | null;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}
