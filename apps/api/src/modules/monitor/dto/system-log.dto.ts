import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, Min, Max, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class SystemLogEntryDto {
  @ApiProperty({ description: '日志条目 ID', example: 'log_c8fa213e9a' })
  id: string;

  @ApiProperty({ description: '毫秒时间戳', example: 1731234567890 })
  timestamp: number;

  @ApiProperty({ description: '日志级别', enum: ['debug', 'info', 'warn', 'error'], example: 'info' })
  level: LogLevel;

  @ApiProperty({ description: '上下文/模块名', example: 'AuthService' })
  context: string;

  @ApiProperty({ description: '日志消息正文', example: '用户登录成功: admin@example.com' })
  message: string;

  @ApiPropertyOptional({ type: String, description: '调用方标识', nullable: true, example: 'web-admin' })
  caller?: string | null;

  @ApiPropertyOptional({ type: String, description: '全链路请求关联 ID', nullable: true, example: 'req_123456' })
  requestId?: string | null;

  @ApiPropertyOptional({ type: String, description: '异常堆栈跟踪', nullable: true })
  stack?: string | null;
}

export class QuerySystemLogsDto {
  @ApiPropertyOptional({ description: '查询多长时间以内的日志（单位：分钟），默认 30 分钟', default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(1440)
  windowMinutes?: number = 30;

  @ApiPropertyOptional({ description: '日志级别过滤', enum: ['all', 'debug', 'info', 'warn', 'error'], default: 'all' })
  @IsOptional()
  @IsString()
  level?: string = 'all';

  @ApiPropertyOptional({ description: '关键词搜索（匹配消息、上下文或 RequestID）' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '调用方类型过滤' })
  @IsOptional()
  @IsString()
  caller?: string;

  @ApiPropertyOptional({ description: '返回的最大条目数限制', default: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(10)
  @Max(1000)
  limit?: number = 200;
}

export class RuntimeLogConfigDto {
  @ApiProperty({ description: '全局生效的最低日志级别', enum: ['debug', 'info', 'warn', 'error'], example: 'info' })
  @IsString()
  level: LogLevel;

  @ApiProperty({ description: '内存环形缓冲区最大容量条数', example: 2000 })
  @IsNumber()
  @Min(200)
  @Max(10000)
  bufferSize: number;

  @ApiProperty({ description: '请求日志采样百分比 (1-100)', example: 100 })
  @IsNumber()
  @Min(1)
  @Max(100)
  sampleRate: number;

  @ApiProperty({ description: '是否区分并追踪调用方 Header/Client', example: true })
  @IsBoolean()
  trackCallers: boolean;

  @ApiProperty({ description: '异常堆栈输出阈值', enum: ['error', 'warn', 'never'], example: 'error' })
  @IsString()
  stackThreshold: 'error' | 'warn' | 'never';

  @ApiProperty({ description: '环形热点日志保留小时数', example: 24 })
  @IsNumber()
  @Min(1)
  @Max(168)
  retentionHours: number;

  @ApiProperty({ description: '持久化数据库日志（操作/登录日志）保留天数', example: 7 })
  @IsNumber()
  @Min(1)
  @Max(90)
  dbRetentionDays: number;
}

export class UpdateRuntimeLogConfigDto {
  @ApiPropertyOptional({ description: '全局最低日志级别', enum: ['debug', 'info', 'warn', 'error'] })
  @IsOptional()
  @IsString()
  level?: LogLevel;

  @ApiPropertyOptional({ description: '内存缓冲区最大容量条数', example: 2000 })
  @IsOptional()
  @IsNumber()
  @Min(200)
  @Max(10000)
  bufferSize?: number;

  @ApiPropertyOptional({ description: '请求采样百分比 (1-100)', example: 100 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  sampleRate?: number;

  @ApiPropertyOptional({ description: '是否追踪调用方' })
  @IsOptional()
  @IsBoolean()
  trackCallers?: boolean;

  @ApiPropertyOptional({ description: '堆栈输出阈值', enum: ['error', 'warn', 'never'] })
  @IsOptional()
  @IsString()
  stackThreshold?: 'error' | 'warn' | 'never';

  @ApiPropertyOptional({ description: '保留小时数', example: 24 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(168)
  retentionHours?: number;

  @ApiPropertyOptional({ description: '数据库持久化日志保留天数', example: 7 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(90)
  dbRetentionDays?: number;
}
