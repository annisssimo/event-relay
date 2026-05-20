import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EventEnvelope,
  NotificationEnvelope,
  RABBIT_EXCHANGES,
  RABBIT_ROUTING_KEYS,
  TelegramNotificationPayload,
} from '@app/contracts';
import { RabbitPublisherService } from '@app/messaging';

@Injectable()
export class NotificationPublisherService {
  constructor(
    private readonly publisher: RabbitPublisherService,
    private readonly config: ConfigService,
  ) {}

  async publishForEvent(envelope: EventEnvelope): Promise<void> {
    const defaultChatId = this.config.get<string>('TELEGRAM_DEFAULT_CHAT_ID');
    if (!defaultChatId) {
      throw new Error('TELEGRAM_DEFAULT_CHAT_ID is not configured');
    }

    const notification: TelegramNotificationPayload = {
      chatId: defaultChatId,
      text: this.formatMessage(envelope),
      parseMode: 'HTML',
    };

    const out: NotificationEnvelope = {
      eventId: envelope.eventId,
      type: envelope.type,
      correlationId: envelope.correlationId,
      notification,
    };

    await this.publisher.publish(JSON.stringify(out), {
      exchange: RABBIT_EXCHANGES.NOTIFICATIONS_DIRECT,
      routingKey: RABBIT_ROUTING_KEYS.NOTIFICATION_TELEGRAM,
      eventId: envelope.eventId,
      correlationId: envelope.correlationId,
    });
  }

  private formatMessage(envelope: EventEnvelope): string {
    const payloadJson = JSON.stringify(envelope.payload, null, 2);
    const truncated =
      payloadJson.length > 3000
        ? `${payloadJson.slice(0, 2997)}...`
        : payloadJson;
    return (
      `<b>Event</b>: <code>${this.escapeHtml(envelope.type)}</code>\n` +
      `<b>ID</b>: <code>${envelope.eventId}</code>\n` +
      `<b>At</b>: ${envelope.occurredAt}\n` +
      `<pre>${this.escapeHtml(truncated)}</pre>`
    );
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
