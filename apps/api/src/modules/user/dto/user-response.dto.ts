import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class UserItemDto {
  @ApiProperty({ description: '用户 ID' })
  id: string;

  @ApiProperty({ description: '邮箱' })
  email: string;

  @ApiPropertyOptional({ type: String, description: '姓名', nullable: true })
  name: string | null;

  @ApiProperty({ enum: Role, description: '角色' })
  role: Role;

  @ApiPropertyOptional({ type: String, description: '头像 URL', nullable: true })
  avatar: string | null;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}

export class RelationItemDto {
  @ApiProperty({ description: '关联实体 ID' })
  id: string;

  @ApiProperty({ description: '关联实体名称' })
  name: string;
}

export class UserDetailDto extends UserItemDto {
  @ApiPropertyOptional({
    type: () => RelationItemDto,
    description: '所属部门',
    nullable: true,
  })
  dept?: RelationItemDto | null;

  @ApiProperty({
    type: () => [RelationItemDto],
    description: '关联岗位列表',
  })
  posts: RelationItemDto[];

  @ApiProperty({
    type: () => [RelationItemDto],
    description: '关联角色列表',
  })
  roles: RelationItemDto[];
}

export class SimpleMessageResponseDto {
  @ApiProperty({ description: '提示消息', example: '操作成功' })
  message: string;
}
