import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** 显式声明无需身份认证的路由。未标记的路由默认要求 JWT。 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
