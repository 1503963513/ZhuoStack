import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationGateway } from './notification.gateway';
import { NotificationListener } from './notification.listener';
import { NotificationCleanupService } from './notification.cleanup';

@Module({
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationGateway,
    NotificationListener,
    NotificationCleanupService,
  ],
  exports: [NotificationService, NotificationGateway],
})
export class NotificationModule {}
