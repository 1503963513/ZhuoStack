import { Controller, Get, Delete, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { MonitorService } from './monitor.service';
import { SystemJobsService } from './system-jobs.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators';
import {
  ApiResultResponse,
  ApiPaginatedResultResponse,
} from '../../common/decorators/api-result.decorator';
import { SimpleMessageResponseDto } from '../user/dto/user-response.dto';
import {
  CacheInfoDto,
  OnlineUserItemDto,
  JobItemDto,
  ServerInfoDto,
  JobLogItemDto,
} from './dto/monitor-response.dto';
import { QueryJobLogDto } from './dto/query-job-log.dto';
import { Role } from '@prisma/client';

@ApiTags('系统-系统监控')
@ApiBearerAuth()
@UseGuards(RolesGuard)
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
  @ApiResultResponse(CacheInfoDto, { description: '获取成功' })
  getCacheInfo() {
    return this.monitorService.getCacheInfo();
  }

  @Delete('cache/:key')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '删除指定缓存键' })
  @ApiParam({ name: 'key', description: '缓存键' })
  @ApiResultResponse(SimpleMessageResponseDto, { description: '删除成功' })
  deleteCacheKey(@Param('key') key: string) {
    return this.monitorService.deleteCacheKey(key);
  }

  @Delete('cache')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '清空所有缓存' })
  @ApiResultResponse(SimpleMessageResponseDto, { description: '清空成功' })
  clearAllCache() {
    return this.monitorService.clearAllCache();
  }

  // ========== 在线用户 ==========

  @Get('online')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '获取在线用户列表' })
  @ApiResultResponse(OnlineUserItemDto, { isArray: true, description: '获取成功' })
  getOnlineUsers() {
    return this.monitorService.getOnlineUsers();
  }

  @Delete('online/:userId')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '强制用户下线' })
  @ApiParam({ name: 'userId', description: '用户ID' })
  @ApiResultResponse(SimpleMessageResponseDto, { description: '操作成功' })
  kickUser(@Param('userId') userId: string) {
    return this.monitorService.kickUser(userId);
  }

  // ========== 定时任务 ==========

  @Get('jobs')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '获取定时任务列表' })
  @ApiResultResponse(JobItemDto, { isArray: true, description: '获取成功' })
  getJobs() {
    return this.monitorService.getJobs();
  }

  @Post('jobs/:name/start')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '启动定时任务' })
  @ApiParam({ name: 'name', description: '任务名称' })
  @ApiResultResponse(SimpleMessageResponseDto, { description: '操作成功' })
  startJob(@Param('name') name: string) {
    return this.monitorService.startJob(name);
  }

  @Post('jobs/:name/stop')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '停止定时任务' })
  @ApiParam({ name: 'name', description: '任务名称' })
  @ApiResultResponse(SimpleMessageResponseDto, { description: '操作成功' })
  stopJob(@Param('name') name: string) {
    return this.monitorService.stopJob(name);
  }

  @Post('jobs/:name/run')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '立即执行一次定时任务' })
  @ApiParam({ name: 'name', description: '任务名称' })
  @ApiResultResponse(SimpleMessageResponseDto, { description: '操作成功' })
  runJob(@Param('name') name: string) {
    return this.monitorService.runJob(name);
  }

  // ========== 定时任务日志 ==========

  @Get('jobs/logs')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '获取定时任务执行日志' })
  @ApiPaginatedResultResponse(JobLogItemDto, { description: '获取成功' })
  findJobLogs(@Query() query: QueryJobLogDto) {
    return this.monitorService.findJobLogs(query);
  }

  @Delete('jobs/logs')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '清空定时任务日志' })
  @ApiResultResponse(SimpleMessageResponseDto, { description: '清空成功' })
  clearJobLogs() {
    return this.monitorService.clearJobLogs();
  }

  // ========== 服务器信息 ==========

  @Get('server')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '获取服务器运行信息' })
  @ApiResultResponse(ServerInfoDto, { description: '获取成功' })
  getServerInfo() {
    return this.monitorService.getServerInfo();
  }

  @Get('health')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '获取最近一次健康检查结果' })
  @ApiResultResponse(undefined, { description: '获取成功' })
  getHealthCheck() {
    return this.systemJobsService.getLastHealthCheck();
  }
}
