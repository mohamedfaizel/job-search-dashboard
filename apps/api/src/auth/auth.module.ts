import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthGuard } from './auth.guard';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';

const DEV_SECRET = 'dev-only-secret-change-me';

function jwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET');
  if (secret) return secret;
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  new Logger('AuthModule').warn('JWT_SECRET is not set; using a development-only secret');
  return DEV_SECRET;
}

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ secret: jwtSecret(config) }),
    }),
  ],
  providers: [
    AuthService,
    AuthResolver,
    // Every resolver and controller is protected unless marked @Public().
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
