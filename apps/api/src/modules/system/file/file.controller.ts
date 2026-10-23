import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Res,
  Req,
  BadRequestException,
  PayloadTooLargeException,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiConsumes,
  ApiBody,
  ApiProduces,
  ApiResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { FastifyReply, FastifyRequest } from 'fastify';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import {
  ApiResultResponse,
  ApiPaginatedResultResponse,
  ApiErrorResponse,
} from '../../../common/decorators/api-result.decorator';
import { SimpleMessageResponseDto } from '../../user/dto/user-response.dto';
import { FileService } from './file.service';
import { QueryFileDto, UpdateFileDto, BatchDeleteDto } from './dto';
import { FileEntity, UploadResultEntity } from './entities/file.entity';

@ApiTags('系统-文件管理')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('system/file')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Get()
  @ApiOperation({ summary: '获取文件列表' })
  @ApiPaginatedResultResponse(FileEntity, { description: '获取成功' })
  findAll(@Query() query: QueryFileDto) {
    return this.fileService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取文件详情' })
  @ApiParam({ name: 'id', description: '文件 ID' })
  @ApiResultResponse(FileEntity, { description: '获取成功' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, '文件不存在')
  findOne(@Param('id') id: string) {
    return this.fileService.findOne(id);
  }

  @Put(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '更新文件信息' })
  @ApiParam({ name: 'id', description: '文件 ID' })
  @ApiResultResponse(FileEntity, { description: '更新成功' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, '文件不存在')
  update(@Param('id') id: string, @Body() dto: UpdateFileDto) {
    return this.fileService.update(id, dto);
  }

  @Delete('batch')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '批量删除文件' })
  @ApiResultResponse(SimpleMessageResponseDto, { description: '删除成功' })
  removeBatch(@Body() dto: BatchDeleteDto) {
    if (!dto.ids || dto.ids.length === 0) {
      throw new BadRequestException('请选择要删除的文件');
    }
    return this.fileService.removeBatch(dto.ids);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '删除文件' })
  @ApiParam({ name: 'id', description: '文件 ID' })
  @ApiResultResponse(SimpleMessageResponseDto, { description: '删除成功' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, '文件不存在')
  remove(@Param('id') id: string) {
    return this.fileService.remove(id);
  }

  @Post('upload')
  @ApiOperation({ summary: '上传文件' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResultResponse(FileEntity, { status: HttpStatus.CREATED, description: '上传成功' })
  async upload(@Req() req: FastifyRequest, @CurrentUser('id') userId: string) {
    const data = await req.file();
    if (!data) {
      throw new BadRequestException('请选择要上传的文件');
    }

    const buffer = await data.toBuffer();
    if (buffer.length === 0) {
      throw new PayloadTooLargeException(
        `文件大小超过限制，请上传 ${this.fileService.maxFileSizeMB}MB 以内的文件`,
      );
    }
    return this.fileService.saveFile(data.filename, data.mimetype, buffer, userId);
  }

  @Post('upload/image')
  @ApiOperation({ summary: `上传图片（限制 5MB）` })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResultResponse(UploadResultEntity, { status: HttpStatus.CREATED, description: '上传成功' })
  async uploadImage(@Req() req: FastifyRequest, @CurrentUser('id') userId: string) {
    const data = await req.file();
    if (!data) {
      throw new BadRequestException('请选择要上传的图片');
    }

    const buffer = await data.toBuffer();
    if (buffer.length === 0) {
      throw new PayloadTooLargeException(
        `图片大小超过限制，请上传 ${this.fileService.maxImageSizeMB}MB 以内的图片`,
      );
    }
    return this.fileService.saveImage(data.filename, data.mimetype, buffer, userId);
  }

  @Get('download/:id')
  @ApiOperation({ summary: '下载文件' })
  @ApiParam({ name: 'id', description: '文件 ID' })
  @ApiProduces('application/octet-stream')
  @ApiResponse({ status: 200, description: '文件二进制流' })
  async download(@Param('id') id: string, @Res() res: FastifyReply) {
    const { buffer, originalName, mimeType } = await this.fileService.getDownloadInfo(id);

    res.header('Content-Disposition', `attachment; filename="${encodeURIComponent(originalName)}"`);
    res.header('Content-Length', buffer.length);
    res.type(mimeType);
    return res.send(buffer);
  }
}
