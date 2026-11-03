import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { LogModule } from '../log/log.module';
import { MonitorController } from './monitor.controller';
import { MonitorService } from './monitor.service';
import { SystemJobsService } from './system-jobs.service';
import { SessionModule } from '../auth/session.module';

@Module({
  imports: [ScheduleModule.forRoot(), LogModule, SessionModule],
  controllers: [MonitorController],
  providers: [MonitorService, SystemJobsService],
  exports: [MonitorService],
})
export class MonitorModule {}
