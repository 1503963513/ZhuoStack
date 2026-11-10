import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsEnum, IsNumber, IsBoolean, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { Status } from '@prisma/client';

export class CreateIpRuleDto {
  @ApiProperty({ description: 'IP 地址或 CIDR 网段', example: '192.168.1.100' })
  @IsNotEmpty({ message: 'IP 不能为空' })
  @IsString()
  ip: string;

  @ApiProperty({ description: '规则类型: BLACKLIST | WHITELIST', example: 'BLACKLIST' })
  @IsNotEmpty()
  @IsString()
  type: 'BLACKLIST' | 'WHITELIST';

  @ApiPropertyOptional({ description: '封禁/加白原因', example: '异常高频扫描接口' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: '封禁持续分钟数（留空或0表示永久）', example: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  expireMinutes?: number;
}

export class QueryIpRuleDto {
  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页条数', default: 10 })
  @IsOptional()
  @Type(() => Number)
  pageSize?: number = 10;

  @ApiPropertyOptional({ description: 'IP 或原因模糊搜索' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '类型筛选: BLACKLIST | WHITELIST' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: '状态筛选', enum: Status })
  @IsOptional()
  @IsEnum(Status)
  status?: Status;
}

export class IpRuleItemDto {
  @ApiProperty({ description: '规则 ID' })
  id: string;

  @ApiProperty({ description: 'IP 地址' })
  ip: string;

  @ApiProperty({ description: '规则类型' })
  type: string;

  @ApiPropertyOptional({ type: String, description: '原因备注', nullable: true })
  reason?: string | null;

  @ApiPropertyOptional({ type: Date, description: '过期时间', nullable: true })
  expiredAt?: Date | null;

  @ApiProperty({ description: '状态', enum: Status })
  status: Status;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}

export class CreateThrottleRuleDto {
  @ApiProperty({ description: '规则名称', example: '登录接口防爆破' })
  @IsNotEmpty({ message: '规则名称不能为空' })
  @IsString()
  name: string;

  @ApiProperty({ description: '路由路径', example: '/api/auth/login' })
  @IsNotEmpty({ message: '路由路径不能为空' })
  @IsString()
  path: string;

  @ApiPropertyOptional({ description: 'HTTP 方法', default: 'ALL' })
  @IsOptional()
  @IsString()
  method?: string = 'ALL';

  @ApiProperty({ description: '限流阈值上限（次）', example: 5 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100000)
  limit: number;

  @ApiProperty({ description: '统计周期秒数', example: 60 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(86400)
  ttl: number;

  @ApiPropertyOptional({ description: '限流维度: IP | USER | IP_AND_USER', default: 'IP' })
  @IsOptional()
  @IsString()
  dimension?: 'IP' | 'USER' | 'IP_AND_USER' = 'IP';

  @ApiPropertyOptional({ description: '超限是否自动临时拉入黑名单', default: false })
  @IsOptional()
  @IsBoolean()
  autoBlock?: boolean = false;

  @ApiPropertyOptional({ description: '自动拉黑分钟数', default: 15 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(1440)
  blockMinutes?: number = 15;
}

export class UpdateThrottleRuleDto {
  @ApiPropertyOptional({ description: '规则名称' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '限流阈值上限（次）' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;

  @ApiPropertyOptional({ description: '统计周期秒数' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  ttl?: number;

  @ApiPropertyOptional({ description: '限流维度' })
  @IsOptional()
  @IsString()
  dimension?: 'IP' | 'USER' | 'IP_AND_USER';

  @ApiPropertyOptional({ description: '超限是否自动拉黑' })
  @IsOptional()
  @IsBoolean()
  autoBlock?: boolean;

  @ApiPropertyOptional({ description: '自动拉黑分钟数' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  blockMinutes?: number;

  @ApiPropertyOptional({ description: '状态', enum: Status })
  @IsOptional()
  @IsEnum(Status)
  status?: Status;
}

export class ThrottleRuleItemDto {
  @ApiProperty({ description: '规则 ID' })
  id: string;

  @ApiProperty({ description: '规则名称' })
  name: string;

  @ApiProperty({ description: '路由路径' })
  path: string;

  @ApiProperty({ description: 'HTTP 方法' })
  method: string;

  @ApiProperty({ description: '限流阈值上限' })
  limit: number;

  @ApiProperty({ description: '统计周期秒数' })
  ttl: number;

  @ApiProperty({ description: '限流维度' })
  dimension: string;

  @ApiProperty({ description: '超限是否自动拉黑' })
  autoBlock: boolean;

  @ApiProperty({ description: '自动拉黑分钟数' })
  blockMinutes: number;

  @ApiProperty({ description: '状态', enum: Status })
  status: Status;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}

export class SecurityStatsDto {
  @ApiProperty({ description: '黑名单 IP 数量', example: 12 })
  blackIpCount: number;

  @ApiProperty({ description: '白名单 IP 数量', example: 3 })
  whiteIpCount: number;

  @ApiProperty({ description: '活跃限流规则数量', example: 6 })
  activeThrottleRuleCount: number;

  @ApiProperty({ description: '今日拦截请求总次数', example: 88 })
  todayBlockedCount: number;
}
