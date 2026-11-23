import { Module } from '@nestjs/common';
import { DeptController } from './dept.controller';
import { DeptService } from './dept.service';
import { DataScopeService } from '../../../common/access/data-scope.service';

@Module({
  controllers: [DeptController],
  providers: [DeptService, DataScopeService],
  exports: [DeptService],
})
export class DeptModule {}
