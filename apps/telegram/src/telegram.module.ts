import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TerminusModule } from '@nestjs/terminus';
import { LoggerModule } from 'nestjs-pino';
import { MessagingModule } from '@app/messaging';
import { RabbitHealthIndicator, RABBIT_HEALTH_PROBE } from '@app/common';
import { RabbitConnectionManager } from '@app/messaging';
import { SentNotificationEntity } from './persistence/sent-notification.entity';
import { SentNotificationService } from './persistence/sent-notification.service';
import { TelegramApiClient } from './telegram/telegram-api.client';
import { NotificationSenderService } from './telegram/notification-sender.service';
import { NotificationsConsumerService } from './notifications/notifications-consumer.service';
import { NotifyController } from './notify/notify.controller';
import { HealthController } from './health/health.controller';

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
        entities: [SentNotificationEntity],
        synchronize: config.get('DB_SYNCHRONIZE', 'true') === 'true',
        logging: config.get('DB_LOGGING', 'false') === 'true',
      }),
    }),
    TypeOrmModule.forFeature([SentNotificationEntity]),
    MessagingModule.forRoot(),
    TerminusModule,
  ],
  controllers: [NotifyController, HealthController],
  providers: [
    TelegramApiClient,
    SentNotificationService,
    NotificationSenderService,
    NotificationsConsumerService,
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
export class TelegramModule {}
