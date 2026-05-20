import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'sent_notifications' })
export class SentNotificationEntity {
  @PrimaryColumn({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @Column({ name: 'chat_id', type: 'varchar', length: 64 })
  chatId!: string;

  @Column({ name: 'telegram_message_id', type: 'bigint', nullable: true })
  telegramMessageId!: string | null;

  @CreateDateColumn({ name: 'sent_at' })
  sentAt!: Date;
}
