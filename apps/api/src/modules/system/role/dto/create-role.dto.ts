import { IsNotEmpty, IsString, IsOptional, IsInt, Min, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Status } from '@prisma/client';

export class CreateRoleDto {
  @ApiProperty({ description: '角色名称', example: '普通管理员' })
  @IsNotEmpty({ message: '角色名称不能为空' })
  @IsString()
  name: string;

  @ApiProperty({ description: '角色标识', example: 'admin' })
  @IsNotEmpty({ message: '角色标识不能为空' })
  @IsString()
  code: string;

  @ApiPropertyOptional({ description: '排序', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sort?: number;

  @ApiPropertyOptional({ description: '状态', enum: Status, default: Status.ACTIVE })
  @IsOptional()
  status?: Status;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiPropertyOptional({ description: '菜单ID列表', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  menuIds?: string[];
}
