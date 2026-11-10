import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { SecurityService } from './security.service';
import { Permissions, ApiSessionAuth, ApiResultResponse, ApiPaginatedResultResponse } from '../../../common/decorators';
import { SimpleMessageResponseDto } from '../../user/dto/user-response.dto';
import {
  CreateIpRuleDto,
  QueryIpRuleDto,
  IpRuleItemDto,
  CreateThrottleRuleDto,
  UpdateThrottleRuleDto,
  ThrottleRuleItemDto,
  SecurityStatsDto,
} from './dto/security-rule.dto';

@ApiTags('system-security')
@ApiSessionAuth()
@Permissions('system:security')
@Controller('system/security')
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  @Get('stats')
  @ApiOperation({ summary: '获取安全防护核心统计指标' })
  @ApiResultResponse(SecurityStatsDto, { description: '获取成功' })
  getStats() {
    return this.securityService.getSecurityStats();
  }

  // ========== IP 黑白名单 ==========

  @Get('ip')
  @ApiOperation({ summary: '分页查询 IP 规则列表' })
  @ApiPaginatedResultResponse(IpRuleItemDto, { description: '获取成功' })
  findIpRules(@Query() query: QueryIpRuleDto) {
    return this.securityService.findIpRules(query);
  }

  @Post('ip')
  @Permissions('system:security:edit')
  @ApiOperation({ summary: '添加 IP 黑名单/白名单' })
  @ApiResultResponse(IpRuleItemDto, { description: '添加成功' })
  createIpRule(@Body() dto: CreateIpRuleDto) {
    return this.securityService.createIpRule(dto);
  }

  @Delete('ip/:id')
  @Permissions('system:security:edit')
  @ApiOperation({ summary: '删除/解封指定 IP 规则' })
  @ApiParam({ name: 'id', description: '规则 ID' })
  @ApiResultResponse(SimpleMessageResponseDto, { description: '操作成功' })
  removeIpRule(@Param('id') id: string) {
    return this.securityService.removeIpRule(id);
  }

  // ========== 接口限流与防刷规则 ==========

  @Get('throttle')
  @ApiOperation({ summary: '获取所有接口限流规则' })
  @ApiResultResponse(ThrottleRuleItemDto, { isArray: true, description: '获取成功' })
  findAllThrottleRules() {
    return this.securityService.findAllThrottleRules();
  }

  @Post('throttle')
  @Permissions('system:security:edit')
  @ApiOperation({ summary: '新建接口限流规则' })
  @ApiResultResponse(ThrottleRuleItemDto, { description: '创建成功' })
  createThrottleRule(@Body() dto: CreateThrottleRuleDto) {
    return this.securityService.createThrottleRule(dto);
  }

  @Put('throttle/:id')
  @Permissions('system:security:edit')
  @ApiOperation({ summary: '修改接口限流规则' })
  @ApiParam({ name: 'id', description: '规则 ID' })
  @ApiResultResponse(ThrottleRuleItemDto, { description: '修改成功' })
  updateThrottleRule(@Param('id') id: string, @Body() dto: UpdateThrottleRuleDto) {
    return this.securityService.updateThrottleRule(id, dto);
  }

  @Delete('throttle/:id')
  @Permissions('system:security:edit')
  @ApiOperation({ summary: '删除接口限流规则' })
  @ApiParam({ name: 'id', description: '规则 ID' })
  @ApiResultResponse(SimpleMessageResponseDto, { description: '删除成功' })
  removeThrottleRule(@Param('id') id: string) {
    return this.securityService.removeThrottleRule(id);
  }
}
