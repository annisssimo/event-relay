import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { NotificationEnvelope, RABBIT_EXCHANGES, RABBIT_QUEUES } from '@app/contracts';
import { PermanentError } from '@app/common';
import { RabbitConsumerService } from '@app/messaging';
import { NotificationSenderService } from '../telegram/notification-sender.service';

@Injectable()
export class NotificationsConsumerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(NotificationsConsumerService.name);

  constructor(
    private readonly consumer: RabbitConsumerService,
    private readonly sender: NotificationSenderService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.consumer.start({
      queue: RABBIT_QUEUES.NOTIFICATIONS_TELEGRAM,
      exchange: RABBIT_EXCHANGES.NOTIFICATIONS_DIRECT,
      dlqExchange: RABBIT_EXCHANGES.NOTIFICATIONS_DLX,
      retryRoutingKey: 'notification.retry',
      prefetch: 5,
      handler: (content) => this.handle(content),
    });
  }

  private async handle(content: Buffer): Promise<void> {
    const started = Date.now();
    let envelope: NotificationEnvelope;

    try {
      envelope = JSON.parse(content.toString('utf8')) as NotificationEnvelope;
    } catch {
      throw new PermanentError('Malformed notification JSON');
    }

    if (!envelope?.eventId || !envelope?.notification?.text) {
      throw new PermanentError('Invalid notification envelope');
    }

    try {
      await this.sender.sendFromEnvelope(envelope);
      this.logger.log(
        `Notification processed eventId=${envelope.eventId} result=success durationMs=${Date.now() - started}`,
      );
    } catch (error) {
      this.logger.error(
        `Notification processed eventId=${envelope.eventId} result=failure durationMs=${Date.now() - started}`,
        (error as Error).stack,
      );
      throw error;
    }
  }
}
