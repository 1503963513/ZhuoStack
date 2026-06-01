import { ApiProperty } from '@nestjs/swagger';

export class DictEntity {
  @ApiProperty({ description: '字典ID' })
  id: string;

  @ApiProperty({ description: '字典名称' })
  name: string;

  @ApiProperty({ description: '字典编码' })
  code: string;

  @ApiProperty({ description: '状态', enum: ['ACTIVE', 'INACTIVE'] })
  status: string;

  @ApiProperty({ description: '备注', required: false })
  remark: string | null;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}

export class DictDataEntity {
  @ApiProperty({ description: '字典数据ID' })
  id: string;

  @ApiProperty({ description: '字典ID' })
  dictId: string;

  @ApiProperty({ description: '标签' })
  label: string;

  @ApiProperty({ description: '值' })
  value: string;

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
