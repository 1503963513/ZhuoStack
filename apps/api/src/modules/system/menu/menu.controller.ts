import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { MenuService } from './menu.service';
import { CreateMenuDto, UpdateMenuDto, MenuItemDto, MenuTreeNodeDto } from './dto';
import {
  Permissions,
  ApiResultResponse,
  ApiErrorResponse,
  ApiSessionAuth,
} from '../../../common/decorators';
import { SimpleMessageResponseDto } from '../../user/dto/user-response.dto';

@ApiTags('system-menu')
@ApiSessionAuth()
@Permissions('system:menu')
@Controller('system/menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Post()
  @Permissions('system:menu:add')
  @ApiOperation({ summary: '创建菜单' })
  @ApiResultResponse(MenuItemDto, { status: HttpStatus.CREATED, description: '创建成功' })
  create(@Body() dto: CreateMenuDto) {
    return this.menuService.create(dto);
  }

  @Get('tree')
  @ApiOperation({ summary: '获取菜单树形列表' })
  @ApiResultResponse(MenuTreeNodeDto, { isArray: true, description: '获取成功' })
  findTree() {
    return this.menuService.findTree();
  }

  @Get()
  @ApiOperation({ summary: '获取菜单列表（平铺）' })
  @ApiResultResponse(MenuItemDto, { isArray: true, description: '获取成功' })
  findAll() {
    return this.menuService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '获取菜单详情' })
  @ApiParam({ name: 'id', description: '菜单ID' })
  @ApiResultResponse(MenuItemDto, { description: '获取成功' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, '菜单不存在')
  findOne(@Param('id') id: string) {
    return this.menuService.findOne(id);
  }

  @Put(':id')
  @Permissions('system:menu:edit')
  @ApiOperation({ summary: '更新菜单' })
  @ApiParam({ name: 'id', description: '菜单ID' })
  @ApiResultResponse(MenuItemDto, { description: '更新成功' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, '菜单不存在')
  update(@Param('id') id: string, @Body() dto: UpdateMenuDto) {
    return this.menuService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('system:menu:delete')
  @ApiOperation({ summary: '删除菜单' })
  @ApiParam({ name: 'id', description: '菜单ID' })
  @ApiResultResponse(SimpleMessageResponseDto, { description: '删除成功' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, '菜单不存在')
  remove(@Param('id') id: string) {
    return this.menuService.remove(id);
  }
}
