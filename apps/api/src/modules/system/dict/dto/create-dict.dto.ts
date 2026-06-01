import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Status } from '@prisma/client';

export class CreateDictDto {
  @ApiProperty({ description: '字典名称', example: '用户性别' })
  @IsNotEmpty({ message: '字典名称不能为空' })
  @IsString()
  name: string;

  @ApiProperty({ description: '字典编码', example: 'sys_user_gender' })
  @IsNotEmpty({ message: '字典编码不能为空' })
  @IsString()
  code: string;

  @ApiPropertyOptional({ description: '状态', enum: Status, default: Status.ACTIVE })
  @IsOptional()
  status?: Status;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}
