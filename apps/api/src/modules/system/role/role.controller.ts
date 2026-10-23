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
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { RoleService } from './role.service';
import {
  CreateRoleDto,
  UpdateRoleDto,
  QueryRoleDto,
  RoleItemDto,
  RoleSimpleDto,
  RoleDetailDto,
} from './dto';
import { RolesGuard } from '../../../common/guards/roles.guard';
import {
  Roles,
  ApiResultResponse,
  ApiPaginatedResultResponse,
  ApiErrorResponse,
} from '../../../common/decorators';
import { SimpleMessageResponseDto } from '../../user/dto/user-response.dto';
import { Role } from '@prisma/client';

@ApiTags('系统-角色管理')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('system/role')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '创建角色' })
  @ApiResultResponse(RoleItemDto, { status: HttpStatus.CREATED, description: '创建成功' })
  @ApiErrorResponse(HttpStatus.CONFLICT, '角色标识已存在')
  create(@Body() dto: CreateRoleDto) {
    return this.roleService.create(dto);
  }

  @Get('simple')
  @ApiOperation({ summary: '获取所有角色（下拉选择用）' })
  @ApiResultResponse(RoleSimpleDto, { isArray: true, description: '获取成功' })
  findAllSimple() {
    return this.roleService.findAllSimple();
  }

  @Get()
  @ApiOperation({ summary: '获取角色列表' })
  @ApiPaginatedResultResponse(RoleItemDto, { description: '获取成功' })
  findAll(@Query() query: QueryRoleDto) {
    return this.roleService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取角色详情' })
  @ApiParam({ name: 'id', description: '角色ID' })
  @ApiResultResponse(RoleDetailDto, { description: '获取成功' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, '角色不存在')
  findOne(@Param('id') id: string) {
    return this.roleService.findOne(id);
  }

  @Put(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '更新角色' })
  @ApiParam({ name: 'id', description: '角色ID' })
  @ApiResultResponse(RoleItemDto, { description: '更新成功' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, '角色不存在')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.roleService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '删除角色' })
  @ApiParam({ name: 'id', description: '角色ID' })
  @ApiResultResponse(SimpleMessageResponseDto, { description: '删除成功' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, '角色不存在')
  remove(@Param('id') id: string) {
    return this.roleService.remove(id);
  }
}
