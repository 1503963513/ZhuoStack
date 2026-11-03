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
import { PostService } from './post.service';
import { CreatePostDto, UpdatePostDto, QueryPostDto, PostItemDto } from './dto';
import {
  Permissions,
  ApiSessionAuth,
  ApiResultResponse,
  ApiPaginatedResultResponse,
  ApiErrorResponse,
} from '../../../common/decorators';
import { SimpleMessageResponseDto } from '../../user/dto/user-response.dto';

@ApiTags('system-post')
@ApiSessionAuth()
@Permissions('system:post')
@Controller('system/post')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Post()
  @Permissions('system:post:add')
  @ApiOperation({ summary: '创建岗位' })
  @ApiResultResponse(PostItemDto, { status: HttpStatus.CREATED, description: '创建成功' })
  @ApiErrorResponse(HttpStatus.CONFLICT, '岗位编码已存在')
  create(@Body() dto: CreatePostDto) {
    return this.postService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: '获取岗位列表' })
  @ApiPaginatedResultResponse(PostItemDto, { description: '获取成功' })
  findAll(@Query() query: QueryPostDto) {
    return this.postService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取岗位详情' })
  @ApiParam({ name: 'id', description: '岗位ID' })
  @ApiResultResponse(PostItemDto, { description: '获取成功' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, '岗位不存在')
  findOne(@Param('id') id: string) {
    return this.postService.findOne(id);
  }

  @Put(':id')
  @Permissions('system:post:edit')
  @ApiOperation({ summary: '更新岗位' })
  @ApiParam({ name: 'id', description: '岗位ID' })
  @ApiResultResponse(PostItemDto, { description: '更新成功' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, '岗位不存在')
  update(@Param('id') id: string, @Body() dto: UpdatePostDto) {
    return this.postService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('system:post:delete')
  @ApiOperation({ summary: '删除岗位' })
  @ApiParam({ name: 'id', description: '岗位ID' })
  @ApiResultResponse(SimpleMessageResponseDto, { description: '删除成功' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, '岗位不存在')
  remove(@Param('id') id: string) {
    return this.postService.remove(id);
  }
}
