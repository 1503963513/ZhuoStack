import { Module } from '@nestjs/common';
import { DeptModule } from './dept/dept.module';
import { PostModule } from './post/post.module';
import { RoleModule } from './role/role.module';
import { MenuModule } from './menu/menu.module';
import { DictModule } from './dict/dict.module';
import { FileModule } from './file/file.module';
import { SysConfigModule } from './config/config.module';
import { AlertModule } from './alert/alert.module';
import { SecurityModule } from './security/security.module';

@Module({
  imports: [
    DeptModule,
    PostModule,
    RoleModule,
    MenuModule,
    DictModule,
    FileModule,
    SysConfigModule,
    AlertModule,
    SecurityModule,
  ],
  exports: [
    DeptModule,
    PostModule,
    RoleModule,
    MenuModule,
    DictModule,
    FileModule,
    SysConfigModule,
    SecurityModule,
  ],
})
export class SystemModule {}
