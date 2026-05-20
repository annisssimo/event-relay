import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import type { ConsumeMessage } from 'amqplib';
import {
  EventEnvelope,
  RABBIT_EXCHANGES,
  RABBIT_QUEUES,
} from '@app/contracts';
import { PermanentError } from '@app/common';
import { RabbitConsumerService } from '@app/messaging';
import { IdempotencyService } from '../persistence/idempotency.service';
import { NotificationPublisherService } from '../notifications/notification-publisher.service';

@Injectable()
export class EventsConsumerService implements OnModuleInit {
  private readonly logger = new Logger(EventsConsumerService.name);

  constructor(
    private readonly consumer: RabbitConsumerService,
    private readonly idempotency: IdempotencyService,
    private readonly notifications: NotificationPublisherService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.consumer.start({
      queue: RABBIT_QUEUES.EVENTS_MAIN,
      exchange: RABBIT_EXCHANGES.EVENTS_TOPIC,
      dlqQueue: RABBIT_QUEUES.EVENTS_DLQ,
      retryRoutingKey: 'event.retry',
      prefetch: 10,
      handler: (content, raw) => this.handle(content, raw),
    });
  }

  private async handle(
    content: Buffer,
    _raw: ConsumeMessage,
  ): Promise<void> {
    const started = Date.now();
    let envelope: EventEnvelope;

    try {
      envelope = JSON.parse(content.toString('utf8')) as EventEnvelope;
    } catch {
      throw new PermanentError('Malformed JSON payload');
    }

    if (!envelope?.eventId || !envelope?.type) {
      throw new PermanentError('Invalid event envelope');
    }

    const begin = await this.idempotency.begin(
      envelope.eventId,
      envelope.type,
      envelope.payload,
    );

    if (begin.action === 'skip') {
      this.logger.log(
        `Skip duplicate eventId=${envelope.eventId} type=${envelope.type} reason=${begin.reason} durationMs=${Date.now() - started}`,
      );
      return;
    }

    try {
      await this.notifications.publishForEvent(envelope);
      await this.idempotency.complete(envelope.eventId);
      this.logger.log(
        `Processed eventId=${envelope.eventId} type=${envelope.type} result=success durationMs=${Date.now() - started}`,
      );
    } catch (error) {
      await this.idempotency.fail(
        envelope.eventId,
        (error as Error).message,
      );
      this.logger.error(
        `Processed eventId=${envelope.eventId} type=${envelope.type} result=failure durationMs=${Date.now() - started}`,
        (error as Error).stack,
      );
      throw error;
    }
  }
}
