import { Module } from '@nestjs/common';
import { RedisModule } from '../../database/redis.module';
import { SessionService } from './session.service';

@Module({
  imports: [RedisModule],
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule {}
