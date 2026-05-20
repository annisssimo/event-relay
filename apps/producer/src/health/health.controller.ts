import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  HealthCheckResult,
} from '@nestjs/terminus';
import { RabbitHealthIndicator } from '@app/common';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly rabbit: RabbitHealthIndicator,
  ) {}

  @Get('health')
  @HealthCheck()
  healthCheck(): Promise<HealthCheckResult> {
    return this.health.check([]);
  }

  @Get('ready')
  @HealthCheck()
  readyCheck(): Promise<HealthCheckResult> {
    return this.health.check([() => this.rabbit.isHealthy('rabbitmq')]);
  }
}
