import { Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AlertService } from './alert.service';
import { Permissions, ApiSessionAuth, ApiResultResponse } from '../../../common/decorators';
import { SimpleMessageResponseDto } from '../../user/dto/user-response.dto';

@ApiTags('system-alert')
@Controller('system/alert')
export class AlertController {
  constructor(private readonly alertService: AlertService) {}

  @Post('test')
  @ApiSessionAuth()
  @Permissions('system:config:edit')
  @ApiOperation({ summary: '测试告警机器人连通性' })
  @ApiResultResponse(SimpleMessageResponseDto, { description: '测试结果' })
  async sendTestAlert() {
    return this.alertService.sendTestAlert();
  }
}
