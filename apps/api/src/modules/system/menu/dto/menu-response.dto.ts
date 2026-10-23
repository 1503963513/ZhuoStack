import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MenuType, Status } from '@prisma/client';

export class MenuItemDto {
  @ApiProperty({ description: '菜单 ID' })
  id: string;

  @ApiPropertyOptional({ type: String, description: '父级菜单 ID', nullable: true })
  parentId: string | null;

  @ApiProperty({ description: '菜单名称' })
  name: string;

  @ApiProperty({ enum: MenuType, description: '菜单类型' })
  type: MenuType;

  @ApiPropertyOptional({ type: String, description: '路由路径', nullable: true })
  path: string | null;

  @ApiPropertyOptional({ type: String, description: '组件路径', nullable: true })
  component: string | null;

  @ApiPropertyOptional({ type: String, description: '图标', nullable: true })
  icon: string | null;

  @ApiProperty({ description: '排序号' })
  sort: number;

  @ApiProperty({ enum: Status, description: '状态' })
  status: Status;

  @ApiPropertyOptional({ type: String, description: '权限标识', nullable: true })
  perms: string | null;

  @ApiPropertyOptional({ type: String, description: '备注', nullable: true })
  remark: string | null;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}

export class MenuTreeNodeDto extends MenuItemDto {
  @ApiPropertyOptional({
    type: () => [MenuTreeNodeDto],
    description: '子菜单树节点',
  })
  children?: MenuTreeNodeDto[];
}
