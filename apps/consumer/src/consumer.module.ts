import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TerminusModule } from '@nestjs/terminus';
import { LoggerModule } from 'nestjs-pino';
import { MessagingModule } from '@app/messaging';
import { RabbitHealthIndicator, RABBIT_HEALTH_PROBE } from '@app/common';
import { RabbitConnectionManager } from '@app/messaging';
import { ProcessedEventEntity } from './persistence/processed-event.entity';
import { IdempotencyService } from './persistence/idempotency.service';
import { EventsConsumerService } from './events/events-consumer.service';
import { NotificationPublisherService } from './notifications/notification-publisher.service';
import { HealthController } from './health/health.controller';
import { TopologyBootstrapService } from './topology-bootstrap.service';

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
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url:
          config.get<string>('DATABASE_URL') ??
          'postgresql://app:app@localhost:5432/events',
        entities: [ProcessedEventEntity],
        synchronize: config.get('DB_SYNCHRONIZE', 'false') === 'true',
        logging: config.get('DB_LOGGING', 'false') === 'true',
      }),
    }),
    TypeOrmModule.forFeature([ProcessedEventEntity]),
    MessagingModule.forRoot(),
    TerminusModule,
  ],
  controllers: [HealthController],
  providers: [
    TopologyBootstrapService,
    IdempotencyService,
    NotificationPublisherService,
    EventsConsumerService,
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
export class ConsumerModule {}
