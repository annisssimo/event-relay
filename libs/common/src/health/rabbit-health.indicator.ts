import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';

export interface RabbitHealthProbe {
  isConnected(): boolean;
}

export const RABBIT_HEALTH_PROBE = Symbol('RABBIT_HEALTH_PROBE');

@Injectable()
export class RabbitHealthIndicator extends HealthIndicator {
  constructor(private readonly probe: RabbitHealthProbe) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const connected = this.probe.isConnected();
    const result = this.getStatus(key, connected);
    if (connected) {
      return result;
    }
    throw new HealthCheckError('RabbitMQ is not connected', result);
  }
}
