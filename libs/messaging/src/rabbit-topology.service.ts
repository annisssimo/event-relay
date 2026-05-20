import { Injectable, Logger } from '@nestjs/common';
import {
  RABBIT_EXCHANGES,
  RABBIT_QUEUES,
  RABBIT_ROUTING_KEYS,
  RETRY_POLICY,
} from '@app/contracts';
import type { Channel } from 'amqplib';

@Injectable()
export class RabbitTopologyService {
  private readonly logger = new Logger(RabbitTopologyService.name);

  async declare(channel: Channel): Promise<void> {
    await channel.assertExchange(RABBIT_EXCHANGES.EVENTS_DLX, 'fanout', {
      durable: true,
    });
    await channel.assertExchange(
      RABBIT_EXCHANGES.NOTIFICATIONS_DLX,
      'fanout',
      { durable: true },
    );

    await channel.assertExchange(RABBIT_EXCHANGES.EVENTS_TOPIC, 'topic', {
      durable: true,
    });
    await channel.assertExchange(
      RABBIT_EXCHANGES.NOTIFICATIONS_DIRECT,
      'direct',
      { durable: true },
    );

    const eventsRetryArgs = {
      'x-dead-letter-exchange': RABBIT_EXCHANGES.EVENTS_TOPIC,
      'x-dead-letter-routing-key': RABBIT_ROUTING_KEYS.EVENT_DEFAULT,
      'x-message-ttl': RETRY_POLICY.RETRY_TTL_MS,
    };
    const eventsMainArgs = {
      'x-dead-letter-exchange': RABBIT_EXCHANGES.EVENTS_TOPIC,
      'x-dead-letter-routing-key': 'event.retry',
    };

    await channel.assertQueue(RABBIT_QUEUES.EVENTS_DLQ, { durable: true });
    await channel.bindQueue(
      RABBIT_QUEUES.EVENTS_DLQ,
      RABBIT_EXCHANGES.EVENTS_DLX,
      '',
    );

    await channel.assertQueue(RABBIT_QUEUES.EVENTS_RETRY, {
      durable: true,
      arguments: eventsRetryArgs,
    });

    await channel.assertQueue(RABBIT_QUEUES.EVENTS_MAIN, {
      durable: true,
      arguments: eventsMainArgs,
    });

    await channel.bindQueue(
      RABBIT_QUEUES.EVENTS_MAIN,
      RABBIT_EXCHANGES.EVENTS_TOPIC,
      RABBIT_ROUTING_KEYS.EVENT_PATTERN,
    );
    await channel.bindQueue(
      RABBIT_QUEUES.EVENTS_RETRY,
      RABBIT_EXCHANGES.EVENTS_TOPIC,
      'event.retry',
    );

    const notificationsRetryArgs = {
      'x-dead-letter-exchange': RABBIT_EXCHANGES.NOTIFICATIONS_DIRECT,
      'x-dead-letter-routing-key':
        RABBIT_ROUTING_KEYS.NOTIFICATION_TELEGRAM,
      'x-message-ttl': RETRY_POLICY.RETRY_TTL_MS,
    };
    const notificationsMainArgs = {
      'x-dead-letter-exchange': RABBIT_EXCHANGES.NOTIFICATIONS_DIRECT,
      'x-dead-letter-routing-key': 'notification.retry',
    };

    await channel.assertQueue(RABBIT_QUEUES.NOTIFICATIONS_DLQ, {
      durable: true,
    });
    await channel.bindQueue(
      RABBIT_QUEUES.NOTIFICATIONS_DLQ,
      RABBIT_EXCHANGES.NOTIFICATIONS_DLX,
      '',
    );

    await channel.assertQueue(RABBIT_QUEUES.NOTIFICATIONS_RETRY, {
      durable: true,
      arguments: notificationsRetryArgs,
    });

    await channel.assertQueue(RABBIT_QUEUES.NOTIFICATIONS_TELEGRAM, {
      durable: true,
      arguments: notificationsMainArgs,
    });

    await channel.bindQueue(
      RABBIT_QUEUES.NOTIFICATIONS_TELEGRAM,
      RABBIT_EXCHANGES.NOTIFICATIONS_DIRECT,
      RABBIT_ROUTING_KEYS.NOTIFICATION_TELEGRAM,
    );
    await channel.bindQueue(
      RABBIT_QUEUES.NOTIFICATIONS_RETRY,
      RABBIT_EXCHANGES.NOTIFICATIONS_DIRECT,
      'notification.retry',
    );

    this.logger.log('RabbitMQ topology declared');
  }
}
