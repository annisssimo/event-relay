import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, { Channel, ChannelModel, ConfirmChannel } from 'amqplib';
import { RabbitHealthProbe } from '@app/common';
import { sleep } from '@app/common';

@Injectable()
export class RabbitConnectionManager
  implements OnModuleInit, OnModuleDestroy, RabbitHealthProbe
{
  private readonly logger = new Logger(RabbitConnectionManager.name);
  private connection: ChannelModel | null = null;
  private connected = false;
  private shuttingDown = false;
  private readonly reconnectBaseMs: number;

  constructor(private readonly config: ConfigService) {
    this.reconnectBaseMs = Number(
      this.config.get('RABBITMQ_RECONNECT_BASE_MS', 1000),
    );
  }

  isConnected(): boolean {
    return this.connected && this.connection !== null;
  }

  async onModuleInit(): Promise<void> {
    await this.connectWithRetry();
  }

  async onModuleDestroy(): Promise<void> {
    this.shuttingDown = true;
    await this.close();
  }

  private getUrl(): string {
    return (
      this.config.get<string>('RABBITMQ_URL') ??
      'amqp://guest:guest@localhost:5672'
    );
  }

  private async connectWithRetry(): Promise<void> {
    let attempt = 0;
    while (!this.shuttingDown) {
      attempt++;
      try {
        await this.connect();
        return;
      } catch (error) {
        const delay = Math.min(
          this.reconnectBaseMs * 2 ** Math.min(attempt - 1, 6),
          30_000,
        );
        this.logger.warn(
          `RabbitMQ connect failed (attempt ${attempt}): ${(error as Error).message}. Retry in ${delay}ms`,
        );
        await sleep(delay + Math.random() * 200);
      }
    }
  }

  private async connect(): Promise<void> {
    const conn = await amqp.connect(this.getUrl());
    this.connection = conn;
    this.connected = true;

    conn.on('error', (err) => {
      this.logger.error(`RabbitMQ connection error: ${err.message}`);
    });

    conn.on('close', () => {
      this.connected = false;
      this.connection = null;
      if (!this.shuttingDown) {
        this.logger.warn('RabbitMQ connection closed, reconnecting...');
        void this.connectWithRetry();
      }
    });

    this.logger.log('RabbitMQ connected');
  }

  async createChannel(): Promise<Channel> {
    if (!this.connection) {
      throw new Error('RabbitMQ connection is not available');
    }
    return this.connection.createChannel();
  }

  async createConfirmChannel(): Promise<ConfirmChannel> {
    if (!this.connection) {
      throw new Error('RabbitMQ connection is not available');
    }
    const channel = await this.connection.createConfirmChannel();
    channel.on('error', (err) => {
      this.logger.error(`RabbitMQ channel error: ${err.message}`);
    });
    channel.on('close', () => {
      this.logger.warn('RabbitMQ confirm channel closed');
    });
    return channel;
  }

  private async close(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.close();
      } catch {
        // ignore shutdown errors
      }
      this.connection = null;
      this.connected = false;
    }
  }
}
