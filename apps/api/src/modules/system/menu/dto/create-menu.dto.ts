import { IsNotEmpty, IsString, IsOptional, IsInt, Min, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MenuType, Status } from '@prisma/client';

export class CreateMenuDto {
  @ApiProperty({ description: '菜单名称', example: '用户管理' })
  @IsNotEmpty({ message: '菜单名称不能为空' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: '父菜单ID' })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiProperty({ description: '菜单类型', enum: MenuType, example: MenuType.MENU })
  @IsNotEmpty({ message: '菜单类型不能为空' })
  @IsEnum(MenuType)
  type: MenuType;

  @ApiPropertyOptional({ description: '路由路径', example: '/system/user' })
  @IsOptional()
  @IsString()
  path?: string;

  @ApiPropertyOptional({ description: '组件路径', example: 'system/user/index' })
  @IsOptional()
  @IsString()
  component?: string;

  @ApiPropertyOptional({ description: '图标', example: 'User' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ description: '排序', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sort?: number;

  @ApiPropertyOptional({ description: '状态', enum: Status, default: Status.ACTIVE })
  @IsOptional()
  status?: Status;

  @ApiPropertyOptional({ description: '是否隐藏', default: false })
  @IsOptional()
  @IsBoolean()
  hidden?: boolean;

  @ApiPropertyOptional({ description: '权限标识', example: 'system:user:list' })
  @IsOptional()
  @IsString()
  perms?: string;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}
