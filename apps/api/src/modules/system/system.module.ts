import { Module } from '@nestjs/common';
import { DeptModule } from './dept/dept.module';
import { PostModule } from './post/post.module';
import { RoleModule } from './role/role.module';
import { MenuModule } from './menu/menu.module';
import { DictModule } from './dict/dict.module';
import { FileModule } from './file/file.module';

@Module({
  imports: [DeptModule, PostModule, RoleModule, MenuModule, DictModule, FileModule],
  exports: [DeptModule, PostModule, RoleModule, MenuModule, DictModule, FileModule],
})
export class SystemModule {}
