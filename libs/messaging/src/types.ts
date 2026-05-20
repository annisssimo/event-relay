import type { ConsumeMessage } from 'amqplib';

export type MessageHandler = (
  content: Buffer,
  raw: ConsumeMessage,
) => Promise<void>;

export interface PublishOptions {
  exchange: string;
  routingKey: string;
  eventId: string;
  correlationId?: string;
  persistent?: boolean;
}

export interface ConsumerOptions {
  queue: string;
  exchange: string;
  dlqQueue: string;
  prefetch?: number;
  retryRoutingKey: string;
  handler: MessageHandler;
}
