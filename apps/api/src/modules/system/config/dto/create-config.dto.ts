import { IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Status } from '@prisma/client';

export class CreateConfigDto {
  @ApiProperty({ description: '配置名称', example: '系统名称' })
  @IsNotEmpty({ message: '配置名称不能为空' })
  @IsString()
  name: string;

  @ApiProperty({ description: '配置键名', example: 'sys.app.name' })
  @IsNotEmpty({ message: '配置键名不能为空' })
  @IsString()
  key: string;

  @ApiProperty({ description: '配置键值', example: 'ZhuoStack' })
  @IsNotEmpty({ message: '配置键值不能为空' })
  @IsString()
  value: string;

  @ApiPropertyOptional({ description: '配置分组', default: 'basic' })
  @IsOptional()
  @IsString()
  group?: string;

  @ApiPropertyOptional({ description: '数据类型', default: 'string' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: '是否前端公开读取', default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: '状态', enum: Status, default: Status.ACTIVE })
  @IsOptional()
  status?: Status;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}
