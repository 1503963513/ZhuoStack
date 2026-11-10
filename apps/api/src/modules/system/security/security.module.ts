import { Module, Global } from '@nestjs/common';
import { SecurityController } from './security.controller';
import { SecurityService } from './security.service';

@Global()
@Module({
  controllers: [SecurityController],
  providers: [SecurityService],
  exports: [SecurityService],
})
export class SecurityModule {}
