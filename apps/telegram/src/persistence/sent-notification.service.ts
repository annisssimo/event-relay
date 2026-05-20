import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SentNotificationEntity } from './sent-notification.entity';

@Injectable()
export class SentNotificationService {
  constructor(
    @InjectRepository(SentNotificationEntity)
    private readonly repo: Repository<SentNotificationEntity>,
  ) {}

  async isAlreadySent(eventId: string): Promise<boolean> {
    const count = await this.repo.count({ where: { eventId } });
    return count > 0;
  }

  async markSent(
    eventId: string,
    chatId: string,
    telegramMessageId?: number,
  ): Promise<void> {
    try {
      await this.repo.insert({
        eventId,
        chatId,
        telegramMessageId:
          telegramMessageId !== undefined ? String(telegramMessageId) : null,
      });
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === '23505') {
        return;
      }
      throw error;
    }
  }
}
