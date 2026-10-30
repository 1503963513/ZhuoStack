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
  url: string;

  @ApiProperty({ description: '操作人 IP 地址' })
  ip: string;

  @ApiPropertyOptional({ type: String, description: '操作人员名称', nullable: true })
  operName: string | null;

  @ApiProperty({ description: '操作状态（0异常 1正常）' })
  status: number;

  @ApiPropertyOptional({ type: String, description: '返回参数结果', nullable: true })
  jsonResult: string | null;

  @ApiPropertyOptional({ type: String, description: '错误消息', nullable: true })
  errorMsg: string | null;

  @ApiProperty({ description: '操作时间' })
  operTime: Date;
}

export class LoginLogItemDto {
  @ApiProperty({ description: '访问 ID' })
  id: string;

  @ApiPropertyOptional({ type: String, description: '用户 ID', nullable: true })
  userId?: string | null;

  @ApiProperty({ description: '用户账号/邮箱' })
  username: string;

  @ApiProperty({ description: '登录 IP 地址' })
  ip: string;

  @ApiPropertyOptional({ type: String, description: '登录地点', nullable: true })
  location: string | null;

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
