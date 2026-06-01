import { ApiProperty } from '@nestjs/swagger';

export class UserEntity {
  @ApiProperty({ description: 'User ID' })
  id: string;

  @ApiProperty({ description: 'User email' })
  email: string;

  @ApiProperty({ description: 'User name', required: false })
  name: string | null;

  @ApiProperty({ description: 'User role', enum: ['USER', 'ADMIN'] })
  role: string;

  @ApiProperty({ description: 'User avatar URL', required: false })
  avatar: string | null;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;
}
