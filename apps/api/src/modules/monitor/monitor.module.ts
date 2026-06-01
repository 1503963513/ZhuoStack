import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MonitorController } from './monitor.controller';
import { MonitorService } from './monitor.service';
import { SystemJobsService } from './system-jobs.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [MonitorController],
  providers: [MonitorService, SystemJobsService],
  exports: [MonitorService],
})
export class MonitorModule {}
