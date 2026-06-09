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
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { FileService } from './file.service';
import { QueryFileDto, UpdateFileDto } from './dto';
import { FileEntity, UploadResultEntity } from './entities/file.entity';
import * as fs from 'fs';

@ApiTags('系统-文件管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('system/file')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Get()
  @ApiOperation({ summary: '获取文件列表' })
  @ApiResponse({ status: 200, description: '获取成功', type: [FileEntity] })
  findAll(@Query() query: QueryFileDto) {
    return this.fileService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取文件详情' })
  @ApiParam({ name: 'id', description: '文件 ID' })
  @ApiResponse({ status: 200, description: '获取成功', type: FileEntity })
  @ApiResponse({ status: 404, description: '文件不存在' })
  findOne(@Param('id') id: string) {
    return this.fileService.findOne(id);
  }

  @Put(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '更新文件信息' })
  @ApiParam({ name: 'id', description: '文件 ID' })
  @ApiResponse({ status: 200, description: '更新成功', type: FileEntity })
  update(@Param('id') id: string, @Body() dto: UpdateFileDto) {
    return this.fileService.update(id, dto);
  }

  @Delete('batch')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '批量删除文件' })
  @ApiResponse({ status: 200, description: '删除成功' })
  removeBatch(@Body('ids') ids: string[]) {
    if (!ids || ids.length === 0) {
      throw new BadRequestException('请选择要删除的文件');
    }
    return this.fileService.removeBatch(ids);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '删除文件' })
  @ApiParam({ name: 'id', description: '文件 ID' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 404, description: '文件不存在' })
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
  @ApiResponse({ status: 201, description: '上传成功', type: FileEntity })
  async upload(@Req() req: any, @CurrentUser('id') userId: string) {
    const data = await req.file();
    if (!data) {
      throw new BadRequestException('请选择要上传的文件');
    }

    const buffer = await data.toBuffer();
    if (buffer.length === 0) {
      throw new PayloadTooLargeException(`文件大小超过限制，请上传 ${this.fileService.maxFileSizeMB}MB 以内的文件`);
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
  @ApiResponse({ status: 201, description: '上传成功', type: UploadResultEntity })
  async uploadImage(@Req() req: any, @CurrentUser('id') userId: string) {
    const data = await req.file();
    if (!data) {
      throw new BadRequestException('请选择要上传的图片');
    }

    const buffer = await data.toBuffer();
    if (buffer.length === 0) {
      throw new PayloadTooLargeException(`图片大小超过限制，请上传 ${this.fileService.maxImageSizeMB}MB 以内的图片`);
    }
    return this.fileService.saveImage(data.filename, data.mimetype, buffer, userId);
  }

  @Get('download/:id')
  @ApiOperation({ summary: '下载文件' })
  @ApiParam({ name: 'id', description: '文件 ID' })
  @ApiResponse({ status: 200, description: '下载成功' })
  async download(@Param('id') id: string, @Res() res: any) {
    const { filePath, originalName, mimeType } =
      await this.fileService.getDownloadInfo(id);

    res.header('Content-Disposition', `attachment; filename="${encodeURIComponent(originalName)}"`);
    res.type(mimeType);
    return res.send(fs.readFileSync(filePath));
  }
}
