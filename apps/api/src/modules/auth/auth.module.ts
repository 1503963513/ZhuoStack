import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LogModule } from '../log/log.module';
import { SessionModule } from './session.module';
import { RsaKeyService } from './rsa-key.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
    LogModule,
    SessionModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RsaKeyService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
