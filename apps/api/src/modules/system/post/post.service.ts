import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreatePostDto, UpdatePostDto, QueryPostDto } from './dto';

@Injectable()
export class PostService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 创建岗位
   */
  async create(dto: CreatePostDto) {
    const existing = await this.prisma.sysPost.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictException('岗位编码已存在');
    }

    return this.prisma.sysPost.create({
      data: {
        name: dto.name,
        code: dto.code,
        sort: dto.sort || 0,
        status: dto.status,
        remark: dto.remark,
      },
    });
  }

  /**
   * 获取岗位列表（分页）
   */
  async findAll(query: QueryPostDto) {
    const { page = 1, pageSize = 10, search } = query;
    const skip = (page - 1) * pageSize;

    const where = search
      ? {
          OR: [
            { name: { contains: search } },
            { code: { contains: search } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.sysPost.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { sort: 'asc' },
      }),
      this.prisma.sysPost.count({ where }),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 获取岗位详情
   */
  async findOne(id: string) {
    const post = await this.prisma.sysPost.findUnique({
      where: { id },
    });

    if (!post) {
      throw new NotFoundException(`岗位 ${id} 不存在`);
    }

    return post;
  }

  /**
   * 更新岗位
   */
  async update(id: string, dto: UpdatePostDto) {
    await this.findOne(id);

    if (dto.code) {
      const existing = await this.prisma.sysPost.findUnique({
        where: { code: dto.code },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException('岗位编码已存在');
      }
    }

    return this.prisma.sysPost.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * 删除岗位
   */
  async remove(id: string) {
    await this.findOne(id);

    // 检查是否有关联用户
    const users = await this.prisma.user.findMany({
      where: { posts: { some: { id } } },
    });

    if (users.length > 0) {
      throw new ConflictException('该岗位下存在用户，无法删除');
    }

    await this.prisma.sysPost.delete({ where: { id } });
    return { message: '删除成功' };
  }
}
