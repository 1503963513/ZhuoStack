import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
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
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  Roles,
  CurrentUser,
  ApiResultResponse,
  ApiPaginatedResultResponse,
  ApiErrorResponse,
} from '../../common/decorators';
import { extractAuthToken } from '../auth/auth-security';
import { Role } from '@prisma/client';
import type { FastifyRequest } from 'fastify';

@ApiTags('user')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '创建新用户（管理员）' })
  @ApiResultResponse(UserItemDto, { status: HttpStatus.CREATED, description: '创建成功' })
  @ApiErrorResponse(HttpStatus.CONFLICT, '邮箱已存在')
  create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '获取用户列表（管理员）' })
  @ApiPaginatedResultResponse(UserItemDto, { description: '获取成功' })
  findAll(@Query() query: QueryUserDto) {
    return this.userService.findAll(query);
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '获取用户详情（管理员）' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResultResponse(UserDetailDto, { description: '获取成功' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, '用户不存在')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Put(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '更新用户（管理员）' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResultResponse(UserItemDto, { description: '更新成功' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, '用户不存在')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.userService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '删除用户（管理员）' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResultResponse(SimpleMessageResponseDto, { description: '删除成功' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, '用户不存在')
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }

  @Post('change-password')
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
