import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Res,
  Req,
  BadRequestException,
  PayloadTooLargeException,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiConsumes,
  ApiBody,
  ApiProduces,
  ApiResponse,
} from '@nestjs/swagger';
import { FastifyReply, FastifyRequest } from 'fastify';
import { pipeline } from 'stream/promises';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { CurrentUser, Permissions, ApiSessionAuth } from '../../../common/decorators';
import {
  ApiResultResponse,
  ApiPaginatedResultResponse,
  ApiErrorResponse,
} from '../../../common/decorators/api-result.decorator';
import { SimpleMessageResponseDto } from '../../user/dto/user-response.dto';
import { FileActor, FileService } from './file.service';
import { QueryFileDto, UpdateFileDto, BatchDeleteDto } from './dto';
import { FileEntity, UploadResultEntity } from './entities/file.entity';

@ApiTags('system-file')
@ApiSessionAuth()
@Permissions('system:file')
@Controller('system/file')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Get()
  @ApiOperation({ summary: '获取文件列表' })
  @ApiPaginatedResultResponse(FileEntity, { description: '获取成功' })
  async findAll(@Query() query: QueryFileDto, @CurrentUser() user: FileActor) {
    const result = await this.fileService.findAll(query, user);
    return {
      ...result,
      data: result.data.map((file) => this.fileService.toAccessUrl(file)),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: '获取文件详情' })
  @ApiParam({ name: 'id', description: '文件 ID' })
  @ApiResultResponse(FileEntity, { description: '获取成功' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, '文件不存在')
  async findOne(@Param('id') id: string, @CurrentUser() user: FileActor) {
    return this.fileService.toAccessUrl(await this.fileService.findOne(id, user));
  }

  @Put(':id')
  @Permissions('file:edit')
  @ApiOperation({ summary: '更新文件信息' })
  @ApiParam({ name: 'id', description: '文件 ID' })
  @ApiResultResponse(FileEntity, { description: '更新成功' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, '文件不存在')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFileDto,
    @CurrentUser() user: FileActor,
  ) {
    return this.fileService.toAccessUrl(await this.fileService.update(id, dto, user));
  }

  @Delete('batch')
  @Permissions('file:delete')
  @ApiOperation({ summary: '批量删除文件' })
  @ApiResultResponse(SimpleMessageResponseDto, { description: '删除成功' })
  removeBatch(@Body() dto: BatchDeleteDto, @CurrentUser() user: FileActor) {
    return this.fileService.removeBatch(dto.ids, user);
  }

  @Delete(':id')
  @Permissions('file:delete')
  @ApiOperation({ summary: '删除文件' })
  @ApiParam({ name: 'id', description: '文件 ID' })
  @ApiResultResponse(SimpleMessageResponseDto, { description: '删除成功' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, '文件不存在')
  remove(@Param('id') id: string, @CurrentUser() user: FileActor) {
    return this.fileService.remove(id, user);
  }

  @Post('upload')
  @Permissions('file:upload')
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
  async upload(@Req() req: FastifyRequest, @CurrentUser() user: FileActor) {
    const data = await req.file();
    if (!data) {
      throw new BadRequestException('请选择要上传的文件');
    }

    const tempFilePath = path.join(os.tmpdir(), `zhuostack-upload-${crypto.randomUUID()}`);
    try {
      let fileSize: number;
      try {
        await pipeline(data.file, fs.createWriteStream(tempFilePath, { mode: 0o600 }));
        fileSize = (await fs.promises.stat(tempFilePath)).size;
      } catch (error) {
        if (data.file.truncated) {
          throw new PayloadTooLargeException(
            `文件大小超过限制，请上传 ${this.fileService.maxFileSizeMB}MB 以内的文件`,
          );
        }
        throw error;
      }

      if (data.file.truncated) {
        throw new PayloadTooLargeException(
          `文件大小超过限制，请上传 ${this.fileService.maxFileSizeMB}MB 以内的文件`,
        );
      }
      if (fileSize === 0) {
        throw new BadRequestException('不能上传空文件');
      }

      const record = await this.fileService.saveUploadedFile(
        data.filename,
        data.mimetype,
        tempFilePath,
        fileSize,
        user.id,
      );
      return this.fileService.toAccessUrl(record);
    } finally {
      await fs.promises.unlink(tempFilePath).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error;
      });
    }
  }

  @Post('upload/image')
  @Permissions('file:upload')
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
  async uploadImage(@Req() req: FastifyRequest, @CurrentUser() user: FileActor) {
    const data = await req.file();
    if (!data) {
      throw new BadRequestException('请选择要上传的图片');
    }

    const tempFilePath = path.join(os.tmpdir(), `zhuostack-image-${crypto.randomUUID()}`);
    try {
      let fileSize: number;
      try {
        await pipeline(data.file, fs.createWriteStream(tempFilePath, { mode: 0o600 }));
        fileSize = (await fs.promises.stat(tempFilePath)).size;
      } catch (error) {
        if (data.file.truncated) {
          throw new PayloadTooLargeException(
            `图片大小超过限制，请上传 ${this.fileService.maxImageSizeMB}MB 以内的图片`,
          );
        }
        throw error;
      }

      if (data.file.truncated) {
        throw new PayloadTooLargeException(
          `图片大小超过限制，请上传 ${this.fileService.maxImageSizeMB}MB 以内的图片`,
        );
      }
      if (fileSize === 0) {
        throw new BadRequestException('不能上传空图片');
      }

      return this.fileService.saveUploadedImage(
        data.filename,
        data.mimetype,
        tempFilePath,
        fileSize,
        user.id,
      );
    } finally {
      await fs.promises.unlink(tempFilePath).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error;
      });
    }
  }

  @Get('download/:id')
  @Permissions('file:download')
  @ApiOperation({ summary: '下载文件' })
  @ApiParam({ name: 'id', description: '文件 ID' })
  @ApiProduces('application/octet-stream')
  @ApiResponse({ status: 200, description: '文件二进制流' })
  async download(
    @Param('id') id: string,
    @CurrentUser() user: FileActor,
    @Res() res: FastifyReply,
  ) {
    return this.sendFile(id, user, res, 'attachment');
  }

  @Get('content/:id')
  @Permissions('file:upload', 'file:download', 'system:file')
  @ApiOperation({ summary: '预览文件（需要登录并有文件访问权限）' })
  @ApiParam({ name: 'id', description: '文件 ID' })
  @ApiProduces('application/octet-stream')
  @ApiResponse({ status: 200, description: '文件二进制流' })
  async content(
    @Param('id') id: string,
    @CurrentUser() user: FileActor,
    @Res() res: FastifyReply,
  ) {
    return this.sendFile(id, user, res, 'inline');
  }

  private async sendFile(
    id: string,
    user: FileActor,
    res: FastifyReply,
    disposition: 'inline' | 'attachment',
  ) {
    const { body, contentLength, originalName, mimeType } = await this.fileService.getDownloadInfo(
      id,
      user,
    );
    const safeName = encodeURIComponent(originalName.replace(/[\r\n]/g, ''));
    res.header('Content-Disposition', `${disposition}; filename*=UTF-8''${safeName}`);
    res.header('Content-Length', String(contentLength));
    res.header('Cache-Control', 'private, no-store');
    res.header('X-Content-Type-Options', 'nosniff');
    res.type(mimeType);
    return res.send(body);
  }
}
