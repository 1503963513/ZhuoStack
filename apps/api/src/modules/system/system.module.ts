import { Module } from '@nestjs/common';
import { DeptModule } from './dept/dept.module';
import { PostModule } from './post/post.module';
import { RoleModule } from './role/role.module';
import { MenuModule } from './menu/menu.module';
import { DictModule } from './dict/dict.module';

@Module({
  imports: [DeptModule, PostModule, RoleModule, MenuModule, DictModule],
  exports: [DeptModule, PostModule, RoleModule, MenuModule, DictModule],
})
export class SystemModule {}
