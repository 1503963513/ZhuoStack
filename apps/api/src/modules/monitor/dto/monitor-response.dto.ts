import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CacheKeyDetailDto {
  @ApiProperty({ description: '键名' })
  key: string;

  @ApiProperty({ description: 'TTL 剩余秒数' })
  ttl: number;

  @ApiProperty({ description: '数据类型' })
  type: string;

  @ApiProperty({ description: '数据大小描述' })
  size: string;
}

export class CacheInfoDto {
  @ApiProperty({ description: '连接状态' })
  status: string;

  @ApiProperty({ description: '总键数' })
  totalKeys: number;

  @ApiProperty({ description: '已用内存' })
  usedMemory: string;

  @ApiPropertyOptional({ description: '峰值内存' })
  peakMemory?: string;

  @ApiPropertyOptional({ description: 'RSS 物理内存' })
  rssMemory?: string;

  @ApiProperty({ type: () => [CacheKeyDetailDto], description: '键详情列表' })
  keys: CacheKeyDetailDto[];
}

export class OnlineUserItemDto {
  @ApiProperty({ description: '用户 ID' })
  userId: string;

  @ApiProperty({ description: '用户名' })
  userName: string;

  @ApiProperty({ description: 'IP 地址' })
  ip: string;

  @ApiProperty({ description: '登录时间戳' })
  loginTime: number;

  @ApiProperty({ description: '最后活跃时间戳' })
  lastActive: number;
}

export class JobItemDto {
  @ApiProperty({ description: '任务唯一标识', example: 'health-check' })
  name: string;

  @ApiProperty({ description: '任务中文描述', example: '定期检查系统健康状态' })
  description: string;

  @ApiProperty({ description: 'Cron 表达式', example: '0 */5 * * * *' })
  cron: string;

  @ApiProperty({ description: '任务状态: running | stopped', example: 'running' })
  status: 'running' | 'stopped';

  @ApiProperty({ description: '是否处于激活运行状态', example: true })
  running: boolean;

  @ApiPropertyOptional({ type: String, description: '下一次执行时间', nullable: true })
  nextRun: string | null;

  @ApiPropertyOptional({ type: String, description: '上一次执行时间', nullable: true })
  lastRun: string | null;
}

export class JobLogItemDto {
  @ApiProperty({ description: '日志 ID' })
  id: string;

  @ApiProperty({ description: '任务名称' })
  jobName: string;

  @ApiProperty({ description: '任务分组' })
  jobGroup: string;

  @ApiPropertyOptional({ type: String, description: '任务中文描述', nullable: true })
  description: string | null;

  @ApiPropertyOptional({ type: String, description: 'Cron 表达式', nullable: true })
  cronExpression: string | null;

  @ApiProperty({ description: '执行状态: 1-成功, 0-失败' })
  status: number;

  @ApiPropertyOptional({ type: String, description: '异常信息', nullable: true })
  exceptionInfo: string | null;

  @ApiProperty({ description: '执行耗时（毫秒）' })
  executionTime: number;

  @ApiProperty({ description: '执行触发时间' })
  createdAt: Date;
}

export class ServerInfoDto {
  @ApiProperty({ description: '主机名' })
  hostname: string;

  @ApiProperty({ description: '操作系统平台' })
  platform: string;

  @ApiProperty({ description: '系统架构' })
  arch: string;

  @ApiProperty({ description: 'Node.js 版本' })
  nodeVersion: string;

  @ApiProperty({ description: '进程运行时间（秒）' })
  uptime: number;

  @ApiProperty({ description: '系统运行时间（秒）' })
  systemUptime: number;

  @ApiProperty({ description: '系统总内存（字节）' })
  totalMemory: number;

  @ApiProperty({ description: '系统已用内存（字节）' })
  usedMemory: number;

  @ApiProperty({ description: '系统空闲内存（字节）' })
  freeMemory: number;

  @ApiProperty({ description: '内存使用率百分比字符串' })
  memoryUsage: string;

  @ApiProperty({ description: 'CPU 核心数' })
  cpuCount: number;

  @ApiProperty({ description: 'CPU 型号' })
  cpuModel: string;

  @ApiProperty({ type: [String], description: '系统负载' })
  loadAverage: string[];
}
