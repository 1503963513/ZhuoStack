import { ApiProperty } from '@nestjs/swagger';

export class PostEntity {
  @ApiProperty({ description: '岗位ID' })
  id: string;

  @ApiProperty({ description: '岗位名称' })
  name: string;

  @ApiProperty({ description: '岗位编码' })
  code: string;

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
