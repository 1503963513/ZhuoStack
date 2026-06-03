import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CreateUserDto, UpdateUserDto, QueryUserDto } from './dto';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Create a new user
   */
  async create(dto: CreateUserDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: hashedPassword,
        avatar: dto.avatar || null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Find all users with pagination and search
   */
  async findAll(query: QueryUserDto) {
    const { page = 1, pageSize = 10, search } = query;
    const skip = (page - 1) * pageSize;

    const where = search
      ? {
          OR: [
            { name: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          avatar: true,
          createdAt: true,
          updatedAt: true,
        },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
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
   * Find user by ID
   */
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
        dept: { select: { id: true, name: true } },
        posts: { select: { id: true, name: true } },
        roles: { select: { id: true, name: true } },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  /**
   * Update user by ID
   */
  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);

    if (dto.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existingUser && existingUser.id !== id) {
        throw new ConflictException('Email already in use');
      }
    }

    // 分离关系字段和普通字段
    const { deptId, postIds, roleIds, role: roleValue, ...rest } = dto;

    return this.prisma.user.update({
      where: { id },
      data: {
        ...rest,
        // role 字段需要转为 Prisma 枚举
        ...(roleValue !== undefined && { role: roleValue as Role }),
        // 部门：通过关系连接
        ...(deptId !== undefined && {
          dept: deptId ? { connect: { id: deptId } } : { disconnect: true },
        }),
        // 岗位：多对多关系
        ...(postIds !== undefined && {
          posts: { set: postIds.map((pid) => ({ id: pid })) },
        }),
        // 角色：多对多关系
        ...(roleIds !== undefined && {
          roles: { set: roleIds.map((rid) => ({ id: rid })) },
        }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Delete user by ID
   */
  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.user.delete({ where: { id } });
    return { message: '用户删除成功' };
  }

  /**
   * 修改密码（前端密文经 RSA 解密后验证）
   */
  async changePassword(userId: string, oldPassword: string, newPassword: string, token?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // RSA 解密前端传来的密文
    const plainOldPassword = this.authService.decryptPassword(oldPassword);
    const plainNewPassword = this.authService.decryptPassword(newPassword);

    const isOldPasswordValid = await bcrypt.compare(plainOldPassword, user.password);
    if (!isOldPasswordValid) {
      throw new BadRequestException('旧密码错误');
    }

    const hashedNewPassword = await bcrypt.hash(plainNewPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    // 将当前 Token 加入黑名单，强制重新登录
    if (token) {
      await this.authService.blacklistToken(token);
    }

    return { message: '密码修改成功' };
  }
}
