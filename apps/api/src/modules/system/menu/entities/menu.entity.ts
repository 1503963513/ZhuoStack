import { ApiProperty } from '@nestjs/swagger';

export class MenuEntity {
  @ApiProperty({ description: '菜单ID' })
  id: string;

  @ApiProperty({ description: '菜单名称' })
  name: string;

  @ApiProperty({ description: '父菜单ID', required: false })
  parentId: string | null;

  @ApiProperty({ description: '菜单类型', enum: ['DIRECTORY', 'MENU', 'BUTTON'] })
  type: string;

  @ApiProperty({ description: '路由路径', required: false })
  path: string | null;

  @ApiProperty({ description: '组件路径', required: false })
  component: string | null;

  @ApiProperty({ description: '图标', required: false })
  icon: string | null;

  @ApiProperty({ description: '排序' })
  sort: number;

  @ApiProperty({ description: '状态', enum: ['ACTIVE', 'INACTIVE'] })
  status: string;

  @ApiProperty({ description: '权限标识', required: false })
  perms: string | null;

  @ApiProperty({ description: '备注', required: false })
  remark: string | null;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}
