import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
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
import { DeptService } from './dept.service';
import { CreateDeptDto, UpdateDeptDto } from './dto';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators';
import { Role } from '@prisma/client';

@ApiTags('系统-部门管理')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('system/dept')
export class DeptController {
  constructor(private readonly deptService: DeptService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '创建部门' })
  @ApiResponse({ status: 201, description: '创建成功' })
  @ApiResponse({ status: 409, description: '同级下已存在同名部门' })
  create(@Body() dto: CreateDeptDto) {
    return this.deptService.create(dto);
  }

  @Get('tree')
  @ApiOperation({ summary: '获取部门树形列表' })
  @ApiResponse({ status: 200, description: '获取成功' })
  findTree() {
    return this.deptService.findTree();
  }

  @Get()
  @ApiOperation({ summary: '获取部门列表（平铺）' })
  @ApiResponse({ status: 200, description: '获取成功' })
  findAll() {
    return this.deptService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '获取部门详情' })
  @ApiParam({ name: 'id', description: '部门ID' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 404, description: '部门不存在' })
  findOne(@Param('id') id: string) {
    return this.deptService.findOne(id);
  }

  @Put(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '更新部门' })
  @ApiParam({ name: 'id', description: '部门ID' })
  @ApiResponse({ status: 200, description: '更新成功' })
  @ApiResponse({ status: 404, description: '部门不存在' })
  update(@Param('id') id: string, @Body() dto: UpdateDeptDto) {
    return this.deptService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '删除部门' })
  @ApiParam({ name: 'id', description: '部门ID' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 404, description: '部门不存在' })
  @ApiResponse({ status: 409, description: '存在子部门或用户，无法删除' })
  remove(@Param('id') id: string) {
    return this.deptService.remove(id);
  }
}
