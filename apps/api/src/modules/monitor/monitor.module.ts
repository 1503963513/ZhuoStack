import { Module, Global } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { LogModule } from '../log/log.module';
import { MonitorController } from './monitor.controller';
import { MonitorService } from './monitor.service';
import { SystemJobsService } from './system-jobs.service';
import { SessionModule } from '../auth/session.module';
import { SystemLogService } from './log-runtime/system-log.service';
import { AppLoggerService } from './log-runtime/app-logger.service';

@Global()
@Module({
  imports: [ScheduleModule.forRoot(), LogModule, SessionModule],
  controllers: [MonitorController],
  providers: [MonitorService, SystemJobsService, SystemLogService, AppLoggerService],
  exports: [MonitorService, SystemLogService, AppLoggerService],
})
export class MonitorModule {}
