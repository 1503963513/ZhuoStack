import { Controller, Get, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LogService } from './log.service';
import { Permissions, ApiSessionAuth } from '../../common/decorators';
import {
  ApiResultResponse,
  ApiPaginatedResultResponse,
} from '../../common/decorators/api-result.decorator';
import { SimpleMessageResponseDto } from '../user/dto/user-response.dto';
import { QueryOperLogDto, QueryLoginLogDto, OperLogItemDto, LoginLogItemDto } from './dto';

@ApiTags('system-log')
@ApiSessionAuth()
@Controller('log')
export class LogController {
  constructor(private readonly logService: LogService) {}

  // ========== 操作日志 ==========

  @Get('oper')
  @Permissions('log:oper')
  @ApiOperation({ summary: '获取操作日志列表' })
  @ApiPaginatedResultResponse(OperLogItemDto, { description: '获取成功' })
  getOperLogs(@Query() query: QueryOperLogDto) {
    return this.logService.findOperLogs(query);
  }

  @Delete('oper')
  @Permissions('log:oper:delete')
  @ApiOperation({ summary: '清除过期操作日志（保留最近 7 天）' })
  @ApiResultResponse(SimpleMessageResponseDto, { description: '清除成功' })
  clearOperLogs() {
    return this.logService.clearOperLogs();
  }

  // ========== 登录日志 ==========

  @Get('login')
  @Permissions('log:login')
  @ApiOperation({ summary: '获取登录日志列表' })
  @ApiPaginatedResultResponse(LoginLogItemDto, { description: '获取成功' })
  getLoginLogs(@Query() query: QueryLoginLogDto) {
    return this.logService.findLoginLogs(query);
  }

  @Delete('login')
  @Permissions('log:login:delete')
  @ApiOperation({ summary: '清除过期登录日志（保留最近 7 天）' })
  @ApiResultResponse(SimpleMessageResponseDto, { description: '清除成功' })
  clearLoginLogs() {
    return this.logService.clearLoginLogs();
  }
}
