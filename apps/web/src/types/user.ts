import type { AuthUserDto } from '@/api/generated/models';

export type Role = 'USER' | 'ADMIN';

/** 用户领域模型直接对齐后端 OpenAPI 契约 */
export type User = AuthUserDto;
