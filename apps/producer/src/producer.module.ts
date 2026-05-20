import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { LoggerModule } from 'nestjs-pino';
import { MessagingModule } from '@app/messaging';
import { EventsController } from './events/events.controller';
import { EventsService } from './events/events.service';
import { HealthController } from './health/health.controller';
import { TopologyBootstrapService } from './topology-bootstrap.service';
import { RabbitHealthIndicator, RABBIT_HEALTH_PROBE } from '@app/common';
import { RabbitConnectionManager } from '@app/messaging';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
      },
    }),
    MessagingModule.forRoot(),
    TerminusModule,
  ],
  controllers: [EventsController, HealthController],
  providers: [
    TopologyBootstrapService,
    EventsService,
    {
      provide: RABBIT_HEALTH_PROBE,
      useExisting: RabbitConnectionManager,
    },
    {
      provide: RabbitHealthIndicator,
      useFactory: (probe: RabbitConnectionManager) =>
        new RabbitHealthIndicator(probe),
      inject: [RABBIT_HEALTH_PROBE],
    },
  ],
})
export class ProducerModule {}
