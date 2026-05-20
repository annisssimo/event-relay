import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { ConfirmChannel } from 'amqplib';
import { MESSAGE_HEADERS } from '@app/contracts';
import { withRetry } from '@app/common';
import { RabbitConnectionManager } from './rabbit-connection.manager';
import { PublishOptions } from './types';

@Injectable()
export class RabbitPublisherService implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitPublisherService.name);
  private channel: ConfirmChannel | null = null;
  private channelPromise: Promise<ConfirmChannel> | null = null;

  constructor(private readonly connection: RabbitConnectionManager) {}

  async onModuleDestroy(): Promise<void> {
    if (this.channel) {
      try {
        await this.channel.close();
      } catch {
        // ignore
      }
      this.channel = null;
      this.channelPromise = null;
    }
  }

  private async getChannel(): Promise<ConfirmChannel> {
    if (this.channel) {
      return this.channel;
    }
    if (!this.channelPromise) {
      this.channelPromise = this.connection
        .createConfirmChannel()
        .then((ch) => {
          this.channel = ch;
          ch.on('close', () => {
            this.channel = null;
            this.channelPromise = null;
          });
          return ch;
        });
    }
    return this.channelPromise;
  }

  async publish(
    body: Buffer | string,
    options: PublishOptions,
  ): Promise<void> {
    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);

    await withRetry(
      async () => {
        const channel = await this.getChannel();
        const published = channel.publish(
          options.exchange,
          options.routingKey,
          buffer,
          {
            persistent: options.persistent ?? true,
            contentType: 'application/json',
            messageId: options.eventId,
            headers: {
              [MESSAGE_HEADERS.IDEMPOTENCY_KEY]: options.eventId,
              ...(options.correlationId
                ? { [MESSAGE_HEADERS.CORRELATION_ID]: options.correlationId }
                : {}),
            },
          },
        );

        if (!published) {
          throw new Error('RabbitMQ publish buffer full (backpressure)');
        }

        await channel.waitForConfirms();
      },
      { maxAttempts: 5, baseDelayMs: 200, maxDelayMs: 5000 },
    );

    this.logger.debug(
      `Published to ${options.exchange}/${options.routingKey} eventId=${options.eventId}`,
    );
  }
}
