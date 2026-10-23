import { ApiProperty } from '@nestjs/swagger';

export class PaginationMetaDto {
  @ApiProperty({ description: '总条数', example: 100 })
  total: number;

  @ApiProperty({ description: '当前页码', example: 1 })
  page: number;

  @ApiProperty({ description: '每页条数', example: 10 })
  pageSize: number;

  @ApiProperty({ description: '总页数', example: 10 })
  totalPages: number;
}

export class PaginatedDataDto<T> {
  data: T[];

  @ApiProperty({ type: () => PaginationMetaDto, description: '分页信息' })
  pagination: PaginationMetaDto;
}

export class ApiResponseDto<T> {
  @ApiProperty({ description: '业务状态码，200 为成功', example: 200 })
  code: number;

  @ApiProperty({ description: '响应提示信息', example: 'success' })
  message: string;

  data: T;
}

export class ErrorResponseDto {
  @ApiProperty({ description: '错误状态码', example: 400 })
  code: number;

  @ApiProperty({ description: '错误消息', example: '请求参数校验失败' })
  message: string;

  @ApiProperty({
    description: '错误数据为空',
    example: null,
    nullable: true,
    type: () => Object,
  })
  data: Record<string, unknown> | null;
}
