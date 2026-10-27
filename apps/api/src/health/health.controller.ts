import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/auth.decorators';

export interface HealthStatus {
  status: 'ok';
  uptimeSeconds: number;
}

@Public()
@Controller('health')
export class HealthController {
  @Get()
  check(): HealthStatus {
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()) };
  }
}
