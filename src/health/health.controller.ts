import { Controller, Get } from '@nestjs/common';

/**
 * Remplace le endpoint `/actuator/health` de spring-boot-starter-actuator,
 * utilisé par le health check de Koyeb.
 */
@Controller('actuator/health')
export class HealthController {
  @Get()
  health(): { status: string } {
    return { status: 'UP' };
  }
}
