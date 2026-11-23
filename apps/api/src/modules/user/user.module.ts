import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { AuthModule } from '../auth/auth.module';
import { DataScopeService } from '../../common/access/data-scope.service';

@Module({
  imports: [AuthModule],
  controllers: [UserController],
  providers: [UserService, DataScopeService],
  exports: [UserService],
})
export class UserModule {}
