import { ApiProperty } from '@nestjs/swagger';

export class RoleEntity {
  @ApiProperty({ description: '角色ID' })
  id: string;

  @ApiProperty({ description: '角色名称' })
  name: string;

  @ApiProperty({ description: '角色标识' })
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
