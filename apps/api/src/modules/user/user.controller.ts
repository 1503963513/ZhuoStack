import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { UserService } from './user.service';
import {
  CreateUserDto,
  UpdateUserDto,
  QueryUserDto,
  ChangePasswordDto,
  UserItemDto,
  UserDetailDto,
  SimpleMessageResponseDto,
} from './dto';
import {
  Permissions,
  ApiSessionAuth,
  CurrentUser,
  ApiResultResponse,
  ApiPaginatedResultResponse,
  ApiErrorResponse,
} from '../../common/decorators';
import { extractAuthToken } from '../auth/auth-security';
import type { FastifyRequest } from 'fastify';

@ApiTags('user')
@ApiSessionAuth()
@Permissions('system:user')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @Permissions('system:user:add')
  @ApiOperation({ summary: '创建新用户（管理员）' })
  @ApiResultResponse(UserItemDto, { status: HttpStatus.CREATED, description: '创建成功' })
  @ApiErrorResponse(HttpStatus.CONFLICT, '邮箱已存在')
  create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @Get()
    @ApiOperation({ summary: '获取用户列表（管理员）' })
  @ApiPaginatedResultResponse(UserItemDto, { description: '获取成功' })
  findAll(@Query() query: QueryUserDto) {
    return this.userService.findAll(query);
  }

  @Get(':id')
    @ApiOperation({ summary: '获取用户详情（管理员）' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResultResponse(UserDetailDto, { description: '获取成功' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, '用户不存在')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Put(':id')
  @Permissions('system:user:edit')
  @ApiOperation({ summary: '更新用户（管理员）' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResultResponse(UserItemDto, { description: '更新成功' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, '用户不存在')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.userService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('system:user:delete')
  @ApiOperation({ summary: '删除用户（管理员）' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResultResponse(SimpleMessageResponseDto, { description: '删除成功' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, '用户不存在')
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }

  @Post('change-password')
  @Permissions()
  @ApiOperation({ summary: '修改密码' })
  @ApiResultResponse(SimpleMessageResponseDto, { description: '密码修改成功' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, '用户不存在')
  @ApiErrorResponse(HttpStatus.CONFLICT, '旧密码错误')
  changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
    @Req() req: FastifyRequest,
  ) {
    const token = extractAuthToken(req);
    return this.userService.changePassword(
      userId,
      dto.oldPassword,
      dto.newPassword,
      token || undefined,
    );
  }
}
