import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { NotificationEnvelope, NotifyDto } from '@app/contracts';
import { SentNotificationService } from '../persistence/sent-notification.service';
import { TelegramApiClient } from './telegram-api.client';

@Injectable()
export class NotificationSenderService {
  private readonly logger = new Logger(NotificationSenderService.name);

  constructor(
    private readonly telegram: TelegramApiClient,
    private readonly sent: SentNotificationService,
  ) {}

  async sendFromEnvelope(envelope: NotificationEnvelope): Promise<void> {
    if (await this.sent.isAlreadySent(envelope.eventId)) {
      this.logger.log(`Skip duplicate notification eventId=${envelope.eventId}`);
      return;
    }

    const result = await this.telegram.sendMessage({
      chatId: envelope.notification.chatId,
      text: envelope.notification.text,
      parseMode: envelope.notification.parseMode,
      disableNotification: envelope.notification.disableNotification,
    });

    await this.sent.markSent(
      envelope.eventId,
      String(envelope.notification.chatId),
      result.messageId,
    );

    this.logger.log(
      `Telegram sent eventId=${envelope.eventId} messageId=${result.messageId}`,
    );
  }

  async sendFromDto(dto: NotifyDto): Promise<{ eventId: string; status: string }> {
    const eventId = dto.eventId ?? uuidv4();
    const envelope: NotificationEnvelope = {
      eventId,
      type: dto.type,
      correlationId: dto.correlationId,
      notification: {
        chatId: dto.chatId,
        text: dto.text,
        parseMode: dto.parseMode,
        disableNotification: dto.disableNotification,
      },
    };
    await this.sendFromEnvelope(envelope);
    return { eventId, status: 'sent' };
  }
}
