import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OperLogItemDto {
  @ApiProperty({ description: '日志 ID' })
  id: string;

  @ApiProperty({ description: '模块标题' })
  title: string;

  @ApiProperty({ description: '业务类型' })
  businessType: number;

  @ApiProperty({ description: '方法名称' })
  method: string;

  @ApiProperty({ description: '请求方式' })
  requestMethod: string;

  @ApiProperty({ description: '请求 URL' })
  operUrl: string;

  @ApiProperty({ description: '主机地址' })
  operIp: string;

  @ApiPropertyOptional({ type: String, description: '操作地点', nullable: true })
  operLocation: string | null;

  @ApiPropertyOptional({ type: String, description: '请求参数', nullable: true })
  operParam: string | null;

  @ApiPropertyOptional({ type: String, description: '返回参数', nullable: true })
  jsonResult: string | null;

  @ApiProperty({ description: '操作状态（0异常 1正常）' })
  status: number;

  @ApiPropertyOptional({ type: String, description: '错误消息', nullable: true })
  errorMsg: string | null;

  @ApiProperty({ description: '操作时间' })
  operTime: Date;

  @ApiProperty({ description: '消耗时间（毫秒）' })
  costTime: number;
}

export class LoginLogItemDto {
  @ApiProperty({ description: '访问 ID' })
  id: string;

  @ApiProperty({ description: '用户账号' })
  userName: string;

  @ApiProperty({ description: '登录 IP 地址' })
  ipaddr: string;

  @ApiPropertyOptional({ type: String, description: '登录地点', nullable: true })
  loginLocation: string | null;

  @ApiPropertyOptional({ type: String, description: '浏览器类型', nullable: true })
  browser: string | null;

  @ApiPropertyOptional({ type: String, description: '操作系统', nullable: true })
  os: string | null;

  @ApiProperty({ description: '登录状态（0失败 1成功）' })
  status: number;

  @ApiPropertyOptional({ type: String, description: '提示消息', nullable: true })
  msg: string | null;

  @ApiProperty({ description: '访问时间' })
  loginTime: Date;
}
