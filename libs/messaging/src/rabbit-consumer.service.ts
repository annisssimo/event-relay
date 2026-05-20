import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Channel, ConsumeMessage, Options } from 'amqplib';
import { MESSAGE_HEADERS, RETRY_POLICY } from '@app/contracts';
import { PermanentError, isTransientError, sleep } from '@app/common';
import { RabbitConnectionManager } from './rabbit-connection.manager';
import { ConsumerOptions } from './types';

@Injectable()
export class RabbitConsumerService implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitConsumerService.name);
  private channel: Channel | null = null;
  private consumerTag: string | null = null;
  private inFlight = 0;
  private options: ConsumerOptions | null = null;
  private shuttingDown = false;
  private reconnecting = false;
  private tearingDown = false;
  private unsubscribeReconnect: (() => void) | null = null;

  constructor(private readonly connection: RabbitConnectionManager) {}

  async start(options: ConsumerOptions): Promise<void> {
    this.options = options;
    this.unsubscribeReconnect = this.connection.onReconnect(() =>
      this.handleReconnect('connection'),
    );
    await this.setupConsumer();
  }

  private async setupConsumer(): Promise<void> {
    if (!this.options || this.shuttingDown) {
      return;
    }

    const channel = await this.connection.createChannel();
    this.channel = channel;

    channel.on('close', () => {
      if (
        !this.shuttingDown &&
        !this.tearingDown &&
        this.connection.isConnected()
      ) {
        void this.handleReconnect('channel');
      }
    });

    const prefetch = this.options.prefetch ?? 10;
    await channel.prefetch(prefetch);

    const { consumerTag } = await channel.consume(
      this.options.queue,
      (msg) => {
        if (!msg) {
          return;
        }
        void this.handleMessage(msg);
      },
      { noAck: false },
    );
    this.consumerTag = consumerTag;
    this.logger.log(`Consuming queue=${this.options.queue} tag=${consumerTag}`);
  }

  private async handleReconnect(source: 'connection' | 'channel'): Promise<void> {
    if (this.shuttingDown || !this.options || this.reconnecting) {
      return;
    }

    this.reconnecting = true;
    try {
      this.logger.warn(`Consumer reconnect triggered by ${source}`);
      await this.teardownConsumer(false);
      if (!this.shuttingDown && this.connection.isConnected()) {
        await this.setupConsumer();
      }
    } catch (error) {
      this.logger.error(
        `Consumer reconnect failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
    } finally {
      this.reconnecting = false;
    }
  }

  private async teardownConsumer(waitInFlight: boolean): Promise<void> {
    if (waitInFlight) {
      const deadline = Date.now() + 30_000;
      while (this.inFlight > 0 && Date.now() < deadline) {
        await sleep(100);
      }
    }

    this.tearingDown = true;
    try {
      if (this.channel && this.consumerTag) {
        try {
          await this.channel.cancel(this.consumerTag);
          await this.channel.close();
        } catch {
          // ignore
        }
      }
    } finally {
      this.channel = null;
      this.consumerTag = null;
      this.tearingDown = false;
    }
  }

  private getRetryCount(msg: ConsumeMessage): number {
    const header = msg.properties.headers?.[MESSAGE_HEADERS.RETRY_COUNT];
    if (typeof header === 'number') {
      return header;
    }
    const deaths = msg.properties.headers?.['x-death'] as
      | Array<{ count?: number }>
      | undefined;
    if (Array.isArray(deaths) && deaths.length > 0) {
      return deaths.reduce((sum, d) => sum + (d.count ?? 0), 0);
    }
    return 0;
  }

  private async handleMessage(msg: ConsumeMessage): Promise<void> {
    if (!this.channel || !this.options) {
      return;
    }
    this.inFlight++;
    const started = Date.now();
    try {
      await this.options.handler(msg.content, msg);
      this.channel.ack(msg);
      this.logger.debug(
        `Ack message deliveryTag=${msg.fields.deliveryTag} durationMs=${Date.now() - started}`,
      );
    } catch (error) {
      const transient = isTransientError(error);
      const retryCount = this.getRetryCount(msg);
      const toDlq =
        error instanceof PermanentError ||
        retryCount >= RETRY_POLICY.MAX_RETRIES ||
        !transient;

      this.logger.error(
        `Message processing failed deliveryTag=${msg.fields.deliveryTag} transient=${transient} retries=${retryCount} error=${(error as Error).message}`,
        (error as Error).stack,
      );

      if (toDlq) {
        await this.publishConfirmed(
          this.options.dlqExchange,
          '',
          msg.content,
          {
            persistent: true,
            contentType: msg.properties.contentType,
            messageId: msg.properties.messageId,
            headers: {
              ...msg.properties.headers,
              'x-error': (error as Error).message,
            },
          },
        );
        this.channel.ack(msg);
        this.logger.warn(
          `Moved to DLQ via ${this.options.dlqExchange} deliveryTag=${msg.fields.deliveryTag}`,
        );
      } else {
        const nextRetry = retryCount + 1;
        const headers = {
          ...msg.properties.headers,
          [MESSAGE_HEADERS.RETRY_COUNT]: nextRetry,
        };
        await this.publishConfirmed(
          this.options.exchange,
          this.options.retryRoutingKey,
          msg.content,
          {
            headers,
            persistent: true,
            contentType: msg.properties.contentType,
            messageId: msg.properties.messageId,
          },
        );
        this.channel.ack(msg);
        this.logger.warn(`Scheduled retry #${nextRetry}`);
      }
    } finally {
      this.inFlight--;
    }
  }

  private async publishConfirmed(
    exchange: string,
    routingKey: string,
    content: Buffer,
    properties: Options.Publish,
  ): Promise<void> {
    const confirmChannel = await this.connection.createConfirmChannel();
    try {
      const published = confirmChannel.publish(
        exchange,
        routingKey,
        content,
        properties,
      );
      if (!published) {
        throw new Error('RabbitMQ publish buffer full (backpressure)');
      }
      await confirmChannel.waitForConfirms();
    } finally {
      try {
        await confirmChannel.close();
      } catch {
        // ignore
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.shuttingDown = true;
    this.unsubscribeReconnect?.();
    this.unsubscribeReconnect = null;
    await this.teardownConsumer(true);
  }
}
