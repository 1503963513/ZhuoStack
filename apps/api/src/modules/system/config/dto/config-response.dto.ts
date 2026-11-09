import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Status } from '@prisma/client';

export class ConfigItemDto {
  @ApiProperty({ description: '配置ID' })
  id: string;

  @ApiProperty({ description: '配置名称' })
  name: string;

  @ApiProperty({ description: '配置键名' })
  key: string;

  @ApiProperty({ description: '配置键值' })
  value: string;

  @ApiProperty({ description: '配置分组' })
  group: string;

  @ApiProperty({ description: '数据类型' })
  type: string;

  @ApiProperty({ description: '是否前端公开读取' })
  isPublic: boolean;

  @ApiProperty({ description: '状态', enum: Status })
  status: Status;

  @ApiPropertyOptional({ description: '备注', type: String, nullable: true })
  remark?: string | null;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}

export class PublicConfigsResponseDto {
  @ApiProperty({
    description: '公开键值字典映射',
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { 'sys.app.name': 'ZhuoStack', 'sys.app.copyright': '© 2026' },
  })
  configs: Record<string, string>;
}

export class ConfigValueResponseDto {
  @ApiPropertyOptional({ description: '参数值', type: String, nullable: true })
  value: string | null;
}
