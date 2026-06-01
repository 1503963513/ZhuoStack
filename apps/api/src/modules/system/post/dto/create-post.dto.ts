import { IsNotEmpty, IsString, IsOptional, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Status } from '@prisma/client';

export class CreatePostDto {
  @ApiProperty({ description: '岗位名称', example: '前端开发工程师' })
  @IsNotEmpty({ message: '岗位名称不能为空' })
  @IsString()
  name: string;

  @ApiProperty({ description: '岗位编码', example: 'frontend_dev' })
  @IsNotEmpty({ message: '岗位编码不能为空' })
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
}
