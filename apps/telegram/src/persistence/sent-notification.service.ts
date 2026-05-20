import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { SentNotificationEntity } from './sent-notification.entity';

@Injectable()
export class SentNotificationService {
  constructor(
    @InjectRepository(SentNotificationEntity)
    private readonly repo: Repository<SentNotificationEntity>,
  ) {}

  /** Atomically reserve eventId before calling Telegram API. */
  async tryReserve(eventId: string, chatId: string): Promise<boolean> {
    try {
      await this.repo.insert({
        eventId,
        chatId,
        telegramMessageId: null,
      });
      return true;
    } catch (error) {
      if ((error as { code?: string })?.code === '23505') {
        return false;
      }
      throw error;
    }
  }

  async markDelivered(
    eventId: string,
    telegramMessageId: number,
  ): Promise<void> {
    await this.repo.update(
      { eventId },
      { telegramMessageId: String(telegramMessageId) },
    );
  }

  /** Release reservation when Telegram API call fails (allows retry). */
  async releaseReservation(eventId: string): Promise<void> {
    await this.repo.delete({
      eventId,
      telegramMessageId: IsNull(),
    });
  }
}
