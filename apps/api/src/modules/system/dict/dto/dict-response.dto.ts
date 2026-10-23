import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Status } from '@prisma/client';

export class DictItemDto {
  @ApiProperty({ description: '字典 ID' })
  id: string;

  @ApiProperty({ description: '字典名称' })
  name: string;

  @ApiProperty({ description: '字典类型编码' })
  code: string;

  @ApiProperty({ enum: Status, description: '状态' })
  status: Status;

  @ApiPropertyOptional({ type: String, description: '备注', nullable: true })
  remark: string | null;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}

export class DictDataItemDto {
  @ApiProperty({ description: '字典数据 ID' })
  id: string;

  @ApiProperty({ description: '所属字典 ID' })
  dictId: string;

  @ApiProperty({ description: '字典标签' })
  label: string;

  @ApiProperty({ description: '字典键值' })
  value: string;

  @ApiProperty({ description: '排序号' })
  sort: number;

  @ApiProperty({ enum: Status, description: '状态' })
  status: Status;

  @ApiPropertyOptional({ type: String, description: '样式属性', nullable: true })
  cssClass: string | null;

  @ApiPropertyOptional({ type: String, description: '表格回显样式', nullable: true })
  listClass: string | null;

  @ApiPropertyOptional({ type: String, description: '备注', nullable: true })
  remark: string | null;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}

export class DictWithDataDto extends DictItemDto {
  @ApiProperty({
    type: () => [DictDataItemDto],
    description: '字典数据项列表',
  })
  dictData: DictDataItemDto[];
}
