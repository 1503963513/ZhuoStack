import { IsNotEmpty, IsString, IsOptional, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Status } from '@prisma/client';

export class CreateDictDataDto {
  @ApiProperty({ description: '字典ID' })
  @IsNotEmpty({ message: '字典ID不能为空' })
  @IsString()
  dictId: string;

  @ApiProperty({ description: '标签', example: '男' })
  @IsNotEmpty({ message: '标签不能为空' })
  @IsString()
  label: string;

  @ApiProperty({ description: '值', example: 'male' })
  @IsNotEmpty({ message: '值不能为空' })
  @IsString()
  value: string;

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
}
