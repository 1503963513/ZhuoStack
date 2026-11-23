import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DataScope, Status } from '@prisma/client';

export class RoleSimpleDto {
  @ApiProperty({ description: '角色 ID' })
  id: string;

  @ApiProperty({ description: '角色名称' })
  name: string;

  @ApiProperty({ description: '角色权限标识符' })
  code: string;
}

export class RoleItemDto extends RoleSimpleDto {
  @ApiProperty({ description: '显示顺序' })
  sort: number;

  @ApiProperty({ enum: Status, description: '状态' })
  status: Status;

  @ApiProperty({ enum: DataScope })
  dataScope: DataScope;

  @ApiPropertyOptional({ type: String, description: '备注', nullable: true })
  remark: string | null;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}

export class RoleDetailDto extends RoleItemDto {
  @ApiPropertyOptional({ type: [String], description: '自定义数据范围部门 ID 列表' })
  dataDeptIds?: string[];

  @ApiPropertyOptional({
    description: '关联合同/菜单列表',
    type: () => [Object],
  })
  menus?: unknown[];
}
