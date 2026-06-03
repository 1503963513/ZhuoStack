import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FileEntity {
  @ApiProperty({ description: '文件 ID' })
  id: string;

  @ApiProperty({ description: '存储文件名' })
  fileName: string;

  @ApiProperty({ description: '原始文件名' })
  originalName: string;

  @ApiProperty({ description: '服务器文件路径' })
  filePath: string;

  @ApiProperty({ description: '访问 URL' })
  url: string;

  @ApiProperty({ description: '文件大小（字节）' })
  fileSize: number;

  @ApiProperty({ description: 'MIME 类型' })
  mimeType: string;

  @ApiProperty({ description: '文件扩展名' })
  ext: string;

  @ApiProperty({ description: '存储类型' })
  storageType: string;

  @ApiPropertyOptional({ description: 'MD5 哈希' })
  md5: string | null;

  @ApiProperty({ description: '状态' })
  status: string;

  @ApiPropertyOptional({ description: '备注' })
  remark: string | null;

  @ApiPropertyOptional({ description: '上传者' })
  createBy: string | null;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}

export class UploadResultEntity {
  @ApiProperty({ description: '文件 ID' })
  id: string;

  @ApiProperty({ description: '访问 URL' })
  url: string;

  @ApiProperty({ description: '原始文件名' })
  originalName: string;

  @ApiProperty({ description: '文件大小（字节）' })
  fileSize: number;
}
