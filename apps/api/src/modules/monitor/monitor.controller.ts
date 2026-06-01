import {
  Controller,
  Get,
  Delete,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { MonitorService } from './monitor.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators';
import { Role } from '@prisma/client';

@ApiTags('系统-系统监控')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('monitor')
export class MonitorController {
  constructor(private readonly monitorService: MonitorService) {}

  // ========== 缓存监控 ==========

  @Get('cache')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '获取缓存信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  getCacheInfo() {
    return this.monitorService.getCacheInfo();
  }

  @Delete('cache/:key')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '删除指定缓存键' })
  @ApiParam({ name: 'key', description: '缓存键' })
  @ApiResponse({ status: 200, description: '删除成功' })
  deleteCacheKey(@Param('key') key: string) {
    return this.monitorService.deleteCacheKey(key);
  }

  @Delete('cache')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '清空所有缓存' })
  @ApiResponse({ status: 200, description: '清空成功' })
  clearAllCache() {
    return this.monitorService.clearAllCache();
  }

  // ========== 在线用户 ==========

  @Get('online')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '获取在线用户列表' })
  @ApiResponse({ status: 200, description: '获取成功' })
  getOnlineUsers() {
    return this.monitorService.getOnlineUsers();
  }

  @Delete('online/:userId')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '强制用户下线' })
  @ApiParam({ name: 'userId', description: '用户ID' })
  @ApiResponse({ status: 200, description: '操作成功' })
  kickUser(@Param('userId') userId: string) {
    return this.monitorService.kickUser(userId);
  }

  // ========== 定时任务 ==========

  @Get('jobs')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '获取定时任务列表' })
  @ApiResponse({ status: 200, description: '获取成功' })
  getJobs() {
    return this.monitorService.getJobs();
  }

  // ========== 服务器信息 ==========

  @Get('server')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '获取服务器信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  getServerInfo() {
    return this.monitorService.getServerInfo();
  }
}
