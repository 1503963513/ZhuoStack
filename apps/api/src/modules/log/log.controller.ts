import {
  Controller,
  Get,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { LogService } from './log.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators';
import { Role } from '@prisma/client';
import { QueryOperLogDto, QueryLoginLogDto } from './dto';

@ApiTags('系统-日志管理')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('log')
export class LogController {
  constructor(private readonly logService: LogService) {}

  // ========== 操作日志 ==========

  @Get('oper')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '获取操作日志列表' })
  @ApiResponse({ status: 200, description: '获取成功' })
  getOperLogs(@Query() query: QueryOperLogDto) {
    return this.logService.findOperLogs(query);
  }

  @Delete('oper')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '清除过期操作日志（保留最近 7 天）' })
  @ApiResponse({ status: 200, description: '清除成功' })
  clearOperLogs() {
    return this.logService.clearOperLogs();
  }

  // ========== 登录日志 ==========

  @Get('login')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '获取登录日志列表' })
  @ApiResponse({ status: 200, description: '获取成功' })
  getLoginLogs(@Query() query: QueryLoginLogDto) {
    return this.logService.findLoginLogs(query);
  }

  @Delete('login')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '清除过期登录日志（保留最近 7 天）' })
  @ApiResponse({ status: 200, description: '清除成功' })
  clearLoginLogs() {
    return this.logService.clearLoginLogs();
  }
}
