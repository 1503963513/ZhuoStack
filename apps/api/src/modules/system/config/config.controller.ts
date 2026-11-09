import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { ConfigService } from './config.service';
import { CreateConfigDto } from './dto/create-config.dto';
import { UpdateConfigDto } from './dto/update-config.dto';
import { QueryConfigDto } from './dto/query-config.dto';
import {
  ConfigItemDto,
  PublicConfigsResponseDto,
  ConfigValueResponseDto,
} from './dto/config-response.dto';
import { SimpleMessageResponseDto } from '../../user/dto/user-response.dto';
import {
  Permissions,
  Public,
  ApiSessionAuth,
  ApiResultResponse,
  ApiPaginatedResultResponse,
  ApiErrorResponse,
} from '../../../common/decorators';

@ApiTags('system-config')
@Controller('system/config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Public()
  @Get('public')
  @ApiOperation({ summary: '获取公开系统参数（免登录）' })
  @ApiResultResponse(PublicConfigsResponseDto, { description: '获取成功' })
  async getPublicConfigs() {
    const configs = await this.configService.getPublicConfigs();
    return { configs };
  }

  @Get('key/:key')
  @ApiSessionAuth()
  @Permissions('system:config:query')
  @ApiOperation({ summary: '根据键名获取配置值' })
  @ApiParam({ name: 'key', description: '配置键名' })
  @ApiResultResponse(ConfigValueResponseDto, { description: '获取成功' })
  async getValueByKey(@Param('key') key: string) {
    const value = await this.configService.getValueByKey(key);
    return { value };
  }

  @Get()
  @ApiSessionAuth()
  @Permissions('system:config:list')
  @ApiOperation({ summary: '分页查询参数列表' })
  @ApiPaginatedResultResponse(ConfigItemDto, { description: '查询成功' })
  findAll(@Query() query: QueryConfigDto) {
    return this.configService.findAll(query);
  }

  @Get(':id')
  @ApiSessionAuth()
  @Permissions('system:config:query')
  @ApiOperation({ summary: '获取参数详情' })
  @ApiParam({ name: 'id', description: '配置ID' })
  @ApiResultResponse(ConfigItemDto, { description: '获取成功' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, '配置不存在')
  findOne(@Param('id') id: string) {
    return this.configService.findOne(id);
  }

  @Post()
  @ApiSessionAuth()
  @Permissions('system:config:add')
  @ApiOperation({ summary: '创建参数' })
  @ApiResultResponse(ConfigItemDto, {
    status: HttpStatus.CREATED,
    description: '创建成功',
  })
  create(@Body() dto: CreateConfigDto) {
    return this.configService.create(dto);
  }

  @Put(':id')
  @ApiSessionAuth()
  @Permissions('system:config:edit')
  @ApiOperation({ summary: '修改参数' })
  @ApiParam({ name: 'id', description: '配置ID' })
  @ApiResultResponse(ConfigItemDto, { description: '修改成功' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, '配置不存在')
  update(@Param('id') id: string, @Body() dto: UpdateConfigDto) {
    return this.configService.update(id, dto);
  }

  @Delete(':id')
  @ApiSessionAuth()
  @Permissions('system:config:delete')
  @ApiOperation({ summary: '删除参数' })
  @ApiParam({ name: 'id', description: '配置ID' })
  @ApiResultResponse(SimpleMessageResponseDto, { description: '删除成功' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, '配置不存在')
  remove(@Param('id') id: string) {
    return this.configService.remove(id);
  }
}
