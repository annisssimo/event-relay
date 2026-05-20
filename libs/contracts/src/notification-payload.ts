export type TelegramParseMode = 'HTML' | 'MarkdownV2';

export interface TelegramNotificationPayload {
  chatId: string | number;
  text: string;
  parseMode?: TelegramParseMode;
  disableNotification?: boolean;
}

export interface NotificationEnvelope {
  eventId: string;
  type: string;
  correlationId?: string;
  notification: TelegramNotificationPayload;
}
