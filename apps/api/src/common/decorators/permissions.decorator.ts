import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * 声明接口所需权限。传入多个标识时满足任意一个即可。
 * 基础标识（如 system:user）会匹配同模块的按钮权限（如 system:user:edit）。
 */
export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);
