import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Sse,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiProduces } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { NotificationService } from './notification.service';
import { NotificationGateway } from './notification.gateway';
import {
  CreateNotificationDto,
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
  QueryNotificationDto,
  NotificationItemDto,
  UnreadCountDto,
} from './dto';
import {
  CurrentUser,
  Permissions,
  ApiSessionAuth,
  ApiResultResponse,
  ApiPaginatedResultResponse,
  ApiErrorResponse,
} from '../../common/decorators';
import { SimpleMessageResponseDto } from '../user/dto/user-response.dto';

@ApiTags('notification')
@ApiSessionAuth()
@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly gateway: NotificationGateway,
  ) {}

  // ========== 用户侧接口 ==========

  @Sse('stream')
  @ApiOperation({ summary: '实时通知推送 (SSE)' })
  @ApiProduces('text/event-stream')
  stream(@CurrentUser('id') userId: string): Observable<unknown> {
    return this.gateway.subscribe(userId);
  }

  @Get()
  @ApiOperation({ summary: '获取通知列表' })
  @ApiPaginatedResultResponse(NotificationItemDto, { description: '获取成功' })
  findAll(
    @CurrentUser('id') userId: string,
    @Query() query: QueryNotificationDto,
  ) {
    return this.notificationService.getUserNotifications(userId, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: '获取未读通知计数' })
  @ApiResultResponse(UnreadCountDto, { description: '获取成功' })
  getUnreadCount(@CurrentUser('id') userId: string) {
    return this.notificationService.getUnreadCount(userId);
  }

  @Put(':id/read')
  @ApiOperation({ summary: '标记通知已读' })
  @ApiParam({ name: 'id', description: '通知ID' })
  @ApiResultResponse(SimpleMessageResponseDto, { description: '操作成功' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, '通知不存在')
  markAsRead(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.notificationService.markAsRead(id, userId);
  }

  @Put('read-all')
  @ApiOperation({ summary: '全部标记已读' })
  @ApiResultResponse(SimpleMessageResponseDto, { description: '操作成功' })
  markAllAsRead(@CurrentUser('id') userId: string) {
    return this.notificationService.markAllAsRead(userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除通知' })
  @ApiParam({ name: 'id', description: '通知ID' })
  @ApiResultResponse(SimpleMessageResponseDto, { description: '删除成功' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, '通知不存在')
  remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.notificationService.removeByUser(id, userId);
  }

  // ========== 管理员接口 ==========

  @Post('send')
  @Permissions('system:notification:send')
  @ApiOperation({ summary: '发送系统消息' })
  @ApiResultResponse(NotificationItemDto, {
    status: HttpStatus.CREATED,
    description: '发送成功',
  })
  sendNotification(
    @Body() dto: CreateNotificationDto,
    @CurrentUser() user: { id: string; name?: string | null },
  ) {
    return this.notificationService.sendNotification(dto, user);
  }

  @Post('announcement')
  @Permissions('system:notification:announcement')
  @ApiOperation({ summary: '发布系统公告' })
  @ApiResultResponse(NotificationItemDto, {
    status: HttpStatus.CREATED,
    description: '发布成功',
  })
  createAnnouncement(
    @Body() dto: CreateAnnouncementDto,
    @CurrentUser() user: { id: string; name?: string | null },
  ) {
    return this.notificationService.createAnnouncement(dto, user);
  }

  @Put('announcement/:id')
  @Permissions('system:notification:announcement')
  @ApiOperation({ summary: '更新公告' })
  @ApiParam({ name: 'id', description: '公告ID' })
  @ApiResultResponse(NotificationItemDto, { description: '更新成功' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, '公告不存在')
  updateAnnouncement(
    @Param('id') id: string,
    @Body() dto: UpdateAnnouncementDto,
    @CurrentUser() user: { id: string; name?: string | null },
  ) {
    return this.notificationService.updateAnnouncement(id, dto, user);
  }

  @Put('announcement/:id/publish')
  @Permissions('system:notification:announcement')
  @ApiOperation({ summary: '发布草稿公告' })
  @ApiParam({ name: 'id', description: '公告ID' })
  @ApiResultResponse(NotificationItemDto, { description: '发布成功' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, '公告不存在')
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, '仅草稿公告可发布')
  publishAnnouncement(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; name?: string | null },
  ) {
    return this.notificationService.publishAnnouncement(id, user);
  }

  @Put('announcement/:id/revoke')
  @Permissions('system:notification:announcement')
  @ApiOperation({ summary: '撤回公告' })
  @ApiParam({ name: 'id', description: '公告ID' })
  @ApiResultResponse(SimpleMessageResponseDto, { description: '撤回成功' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, '公告不存在')
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, '仅已发布的公告可撤回')
  revokeAnnouncement(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; name?: string | null },
  ) {
    return this.notificationService.revokeAnnouncement(id, user);
  }

  @Delete('announcement/:id')
  @Permissions('system:notification:announcement')
  @ApiOperation({ summary: '删除公告' })
  @ApiParam({ name: 'id', description: '公告ID' })
  @ApiResultResponse(SimpleMessageResponseDto, { description: '删除成功' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, '公告不存在')
  removeAnnouncement(@Param('id') id: string) {
    return this.notificationService.removeAnnouncement(id);
  }

  @Get('announcement')
  @Permissions('system:notification:announcement')
  @ApiOperation({ summary: '管理员查询公告列表' })
  @ApiPaginatedResultResponse(NotificationItemDto, { description: '获取成功' })
  getAnnouncementList(@Query() query: QueryNotificationDto) {
    return this.notificationService.getAnnouncementList(query);
  }
}
