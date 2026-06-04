import {
  Controller,
  Get,
  Delete,
  Post,
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
import { SystemJobsService } from './system-jobs.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators';
import { Role } from '@prisma/client';

@ApiTags('系统-系统监控')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('monitor')
export class MonitorController {
  constructor(
    private readonly monitorService: MonitorService,
    private readonly systemJobsService: SystemJobsService,
  ) {}

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

  @Post('jobs/:name/start')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '启动定时任务' })
  @ApiParam({ name: 'name', description: '任务名称' })
  @ApiResponse({ status: 200, description: '操作成功' })
  startJob(@Param('name') name: string) {
    return this.monitorService.startJob(name);
  }

  @Post('jobs/:name/stop')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '停止定时任务' })
  @ApiParam({ name: 'name', description: '任务名称' })
  @ApiResponse({ status: 200, description: '操作成功' })
  stopJob(@Param('name') name: string) {
    return this.monitorService.stopJob(name);
  }

  @Post('jobs/:name/run')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '立即执行一次定时任务' })
  @ApiParam({ name: 'name', description: '任务名称' })
  @ApiResponse({ status: 200, description: '操作成功' })
  runJob(@Param('name') name: string) {
    return this.monitorService.runJob(name);
  }

  // ========== 服务器信息 ==========

  @Get('health')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '获取最近一次健康检查结果' })
  @ApiResponse({ status: 200, description: '获取成功' })
  getHealthCheck() {
    return this.systemJobsService.getLastHealthCheck();
  }

  @Get('server')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '获取服务器信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  getServerInfo() {
    return this.monitorService.getServerInfo();
  }
}
