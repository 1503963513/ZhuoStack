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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { DictService } from './dict.service';
import {
  CreateDictDto,
  UpdateDictDto,
  QueryDictDto,
  CreateDictDataDto,
  UpdateDictDataDto,
} from './dto';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators';
import { Role } from '@prisma/client';

@ApiTags('系统-字典管理')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('system/dict')
export class DictController {
  constructor(private readonly dictService: DictService) {}

  // ========== 字典管理 ==========

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '创建字典' })
  @ApiResponse({ status: 201, description: '创建成功' })
  @ApiResponse({ status: 409, description: '字典编码已存在' })
  create(@Body() dto: CreateDictDto) {
    return this.dictService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: '获取字典列表' })
  @ApiResponse({ status: 200, description: '获取成功' })
  findAll(@Query() query: QueryDictDto) {
    return this.dictService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取字典详情' })
  @ApiParam({ name: 'id', description: '字典ID' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 404, description: '字典不存在' })
  findOne(@Param('id') id: string) {
    return this.dictService.findOne(id);
  }

  @Get('code/:code')
  @ApiOperation({ summary: '根据编码获取字典数据' })
  @ApiParam({ name: 'code', description: '字典编码' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 404, description: '字典不存在' })
  findByCode(@Param('code') code: string) {
    return this.dictService.findByCode(code);
  }

  @Put(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '更新字典' })
  @ApiParam({ name: 'id', description: '字典ID' })
  @ApiResponse({ status: 200, description: '更新成功' })
  @ApiResponse({ status: 404, description: '字典不存在' })
  update(@Param('id') id: string, @Body() dto: UpdateDictDto) {
    return this.dictService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '删除字典' })
  @ApiParam({ name: 'id', description: '字典ID' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 404, description: '字典不存在' })
  remove(@Param('id') id: string) {
    return this.dictService.remove(id);
  }

  // ========== 字典数据管理 ==========

  @Post('data')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '创建字典数据' })
  @ApiResponse({ status: 201, description: '创建成功' })
  createData(@Body() dto: CreateDictDataDto) {
    return this.dictService.createData(dto);
  }

  @Get('data/:dictId')
  @ApiOperation({ summary: '获取字典数据列表' })
  @ApiParam({ name: 'dictId', description: '字典ID' })
  @ApiResponse({ status: 200, description: '获取成功' })
  findDataByDictId(@Param('dictId') dictId: string) {
    return this.dictService.findDataByDictId(dictId);
  }

  @Put('data/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '更新字典数据' })
  @ApiParam({ name: 'id', description: '字典数据ID' })
  @ApiResponse({ status: 200, description: '更新成功' })
  updateData(@Param('id') id: string, @Body() dto: UpdateDictDataDto) {
    return this.dictService.updateData(id, dto);
  }

  @Delete('data/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '删除字典数据' })
  @ApiParam({ name: 'id', description: '字典数据ID' })
  @ApiResponse({ status: 200, description: '删除成功' })
  removeData(@Param('id') id: string) {
    return this.dictService.removeData(id);
  }
}
