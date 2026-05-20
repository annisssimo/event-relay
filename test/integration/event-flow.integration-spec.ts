import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { connect } from 'amqplib';
import { Client } from 'pg';
import { GenericContainer, Wait } from 'testcontainers';
import { ConsumerModule } from '../../apps/consumer/src/consumer.module';
import {
  ProcessedEventStatus,
} from '../../apps/consumer/src/persistence/processed-event.entity';
import { EventsService } from '../../apps/producer/src/events/events.service';
import { ProducerModule } from '../../apps/producer/src/producer.module';
import { TelegramModule } from '../../apps/telegram/src/telegram.module';
import { RABBIT_QUEUES } from '@app/contracts';
import { applyMigration, waitFor } from './helpers';

describe('Event pipeline (integration)', () => {
  let rabbitUrl: string;
  let databaseUrl: string;
  let rabbitContainer: Awaited<ReturnType<GenericContainer['start']>>;
  let pgContainer: Awaited<ReturnType<GenericContainer['start']>>;
  let consumerApp: INestApplication;
  let producerApp: INestApplication;
  let telegramApp: INestApplication | null = null;
  let eventsService: EventsService;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DB_LOGGING = 'false';
    process.env.DB_SYNCHRONIZE = 'false';
    process.env.TELEGRAM_DEFAULT_CHAT_ID = '123456789';
    process.env.TELEGRAM_BOT_TOKEN = 'integration-test-token';

    const [rabbit, postgres] = await Promise.all([
      new GenericContainer('rabbitmq:3-alpine')
        .withExposedPorts(5672)
        .withWaitStrategy(Wait.forLogMessage('Server startup complete'))
        .withStartupTimeout(120_000)
        .start(),
      new GenericContainer('postgres:16-alpine')
        .withEnvironment({
          POSTGRES_USER: 'app',
          POSTGRES_PASSWORD: 'app',
          POSTGRES_DB: 'events',
        })
        .withExposedPorts(5432)
        .withWaitStrategy(
          Wait.forLogMessage('database system is ready to accept connections'),
        )
        .withStartupTimeout(120_000)
        .start(),
    ]);

    rabbitContainer = rabbit;
    pgContainer = postgres;

    rabbitUrl = `amqp://guest:guest@${rabbit.getHost()}:${rabbit.getMappedPort(5672)}`;
    databaseUrl = `postgresql://app:app@${postgres.getHost()}:${postgres.getMappedPort(5432)}/events`;

    process.env.RABBITMQ_URL = rabbitUrl;
    process.env.DATABASE_URL = databaseUrl;

    await applyMigration(databaseUrl);

    const consumerModule = await Test.createTestingModule({
      imports: [ConsumerModule],
    }).compile();
    consumerApp = consumerModule.createNestApplication();
    await consumerApp.init();

    const producerModule = await Test.createTestingModule({
      imports: [ProducerModule],
    }).compile();
    producerApp = producerModule.createNestApplication();
    await producerApp.init();

    eventsService = producerApp.get(EventsService);
  }, 180_000);

  afterAll(async () => {
    await telegramApp?.close();
    await producerApp?.close();
    await consumerApp?.close();
    await rabbitContainer?.stop();
    await pgContainer?.stop();
  }, 60_000);

  async function getProcessedStatus(eventId: string): Promise<string | null> {
    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    try {
      const result = await client.query<{ status: string }>(
        'SELECT status FROM processed_events WHERE event_id = $1',
        [eventId],
      );
      return result.rows[0]?.status ?? null;
    } finally {
      await client.end();
    }
  }

  async function drainNotificationQueue(): Promise<Buffer | null> {
    const conn = await connect(rabbitUrl);
    const channel = await conn.createChannel();
    try {
      const msg = await channel.get(RABBIT_QUEUES.NOTIFICATIONS_TELEGRAM, {
        noAck: true,
      });
      return msg === false ? null : msg.content;
    } finally {
      await channel.close();
      await conn.close();
    }
  }

  it('publishes event → consumer processes → notification enqueued', async () => {
    const result = await eventsService.publish({
      type: 'user.registered',
      payload: { userId: '42', email: 'u@example.com' },
    });

    await waitFor(async () => {
      const status = await getProcessedStatus(result.eventId);
      return status === ProcessedEventStatus.COMPLETED;
    }, 30_000);

    const notificationBody = await drainNotificationQueue();
    expect(notificationBody).toBeTruthy();
    const envelope = JSON.parse(notificationBody!.toString('utf8'));
    expect(envelope.eventId).toBe(result.eventId);
    expect(envelope.type).toBe('user.registered');
    expect(envelope.notification.text).toContain('user.registered');
  }, 60_000);

  it('skips duplicate eventId (idempotency)', async () => {
    const eventId = '660e8400-e29b-41d4-a716-446655440001';

    await eventsService.publish({
      type: 'order.created',
      payload: { orderId: '1' },
      eventId,
    });

    await waitFor(async () => {
      const status = await getProcessedStatus(eventId);
      return status === ProcessedEventStatus.COMPLETED;
    }, 30_000);

    await drainNotificationQueue();

    await eventsService.publish({
      type: 'order.created',
      payload: { orderId: '1' },
      eventId,
    });

    await new Promise((resolve) => setTimeout(resolve, 3000));

    const secondNotification = await drainNotificationQueue();
    expect(secondNotification).toBeNull();
  }, 60_000);

  it('delivers notification via Telegram service with mocked Bot API', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 42 } }),
    } as Response);

    const telegramModule = await Test.createTestingModule({
      imports: [TelegramModule],
    }).compile();
    telegramApp = telegramModule.createNestApplication();
    await telegramApp.init();

    try {
      const result = await eventsService.publish({
        type: 'payment.received',
        payload: { amount: 100 },
      });

      await waitFor(async () => {
        const status = await getProcessedStatus(result.eventId);
        return status === ProcessedEventStatus.COMPLETED;
      }, 30_000);

      await waitFor(async () => {
        const client = new Client({ connectionString: databaseUrl });
        await client.connect();
        try {
          const row = await client.query<{ telegram_message_id: string }>(
            'SELECT telegram_message_id FROM sent_notifications WHERE event_id = $1',
            [result.eventId],
          );
          return row.rows[0]?.telegram_message_id === '42';
        } finally {
          await client.end();
        }
      }, 30_000);

      expect(fetchMock).toHaveBeenCalled();
    } finally {
      fetchMock.mockRestore();
    }
  }, 90_000);
});
