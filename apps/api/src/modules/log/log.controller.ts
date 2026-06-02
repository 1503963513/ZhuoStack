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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators';
import { Role } from '@prisma/client';

@ApiTags('系统-日志管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('log')
export class LogController {
  constructor(private readonly logService: LogService) {}

  // ========== 操作日志 ==========

  @Get('oper')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '获取操作日志列表' })
  @ApiResponse({ status: 200, description: '获取成功' })
  getOperLogs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('title') title?: string,
    @Query('status') status?: string,
  ) {
    return this.logService.findOperLogs({
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 10,
      title,
      status: status !== undefined ? parseInt(status) : undefined,
    });
  }

  @Delete('oper')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '清空操作日志' })
  @ApiResponse({ status: 200, description: '清空成功' })
  clearOperLogs() {
    return this.logService.clearOperLogs();
  }

  // ========== 登录日志 ==========

  @Get('login')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '获取登录日志列表' })
  @ApiResponse({ status: 200, description: '获取成功' })
  getLoginLogs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('username') username?: string,
    @Query('status') status?: string,
  ) {
    return this.logService.findLoginLogs({
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 10,
      username,
      status: status !== undefined ? parseInt(status) : undefined,
    });
  }

  @Delete('login')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '清空登录日志' })
  @ApiResponse({ status: 200, description: '清空成功' })
  clearLoginLogs() {
    return this.logService.clearLoginLogs();
  }
}
