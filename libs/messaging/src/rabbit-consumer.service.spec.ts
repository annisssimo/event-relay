import { PermanentError, TransientError } from '@app/common';
import { MESSAGE_HEADERS, RETRY_POLICY } from '@app/contracts';
import { RabbitConsumerService } from './rabbit-consumer.service';
import { RabbitConnectionManager } from './rabbit-connection.manager';

function createMessage(overrides: Partial<{
  content: Buffer;
  retryCount: number;
}> = {}) {
  return {
    content: overrides.content ?? Buffer.from('{}'),
    fields: { deliveryTag: 1 },
    properties: {
      contentType: 'application/json',
      messageId: 'msg-1',
      headers: overrides.retryCount !== undefined
        ? { [MESSAGE_HEADERS.RETRY_COUNT]: overrides.retryCount }
        : {},
    },
  };
}

describe('RabbitConsumerService', () => {
  let service: RabbitConsumerService;
  let connection: {
    createChannel: jest.Mock;
    isConnected: jest.Mock;
    onReconnect: jest.Mock;
  };
  let channel: {
    prefetch: jest.Mock;
    consume: jest.Mock;
    ack: jest.Mock;
    sendToQueue: jest.Mock;
    publish: jest.Mock;
    cancel: jest.Mock;
    close: jest.Mock;
    on: jest.Mock;
  };
  let handler: jest.Mock;
  let reconnectListener: (() => void | Promise<void>) | null;

  beforeEach(async () => {
    handler = jest.fn().mockResolvedValue(undefined);
    reconnectListener = null;

    channel = {
      prefetch: jest.fn().mockResolvedValue(undefined),
      consume: jest.fn().mockResolvedValue({ consumerTag: 'tag-1' }),
      ack: jest.fn(),
      sendToQueue: jest.fn(),
      publish: jest.fn(),
      cancel: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
    };

    connection = {
      createChannel: jest.fn().mockResolvedValue(channel),
      isConnected: jest.fn().mockReturnValue(true),
      onReconnect: jest.fn((listener: () => void | Promise<void>) => {
        reconnectListener = listener;
        return () => {
          reconnectListener = null;
        };
      }),
    };

    service = new RabbitConsumerService(
      connection as unknown as RabbitConnectionManager,
    );

    await service.start({
      queue: 'events.main',
      exchange: 'events.topic',
      dlqQueue: 'events.dlq',
      retryRoutingKey: 'event.retry',
      handler,
    });
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('acks message after successful handler', async () => {
    const consumeCb = channel.consume.mock.calls[0][1] as (msg: unknown) => void;
    consumeCb(createMessage());

    await new Promise((r) => setTimeout(r, 10));

    expect(handler).toHaveBeenCalled();
    expect(channel.ack).toHaveBeenCalled();
  });

  it('schedules retry on transient error', async () => {
    handler.mockRejectedValue(new TransientError('temporary'));

    const consumeCb = channel.consume.mock.calls[0][1] as (msg: unknown) => void;
    consumeCb(createMessage());

    await new Promise((r) => setTimeout(r, 10));

    expect(channel.publish).toHaveBeenCalledWith(
      'events.topic',
      'event.retry',
      expect.any(Buffer),
      expect.objectContaining({
        headers: expect.objectContaining({
          [MESSAGE_HEADERS.RETRY_COUNT]: 1,
        }),
      }),
    );
    expect(channel.ack).toHaveBeenCalled();
  });

  it('moves permanent errors to DLQ', async () => {
    handler.mockRejectedValue(new PermanentError('bad payload'));

    const consumeCb = channel.consume.mock.calls[0][1] as (msg: unknown) => void;
    consumeCb(createMessage());

    await new Promise((r) => setTimeout(r, 10));

    expect(channel.sendToQueue).toHaveBeenCalledWith(
      'events.dlq',
      expect.any(Buffer),
      expect.any(Object),
    );
    expect(channel.ack).toHaveBeenCalled();
  });

  it('moves to DLQ when max retries exceeded', async () => {
    handler.mockRejectedValue(new TransientError('still failing'));

    const consumeCb = channel.consume.mock.calls[0][1] as (msg: unknown) => void;
    consumeCb(createMessage({ retryCount: RETRY_POLICY.MAX_RETRIES }));

    await new Promise((r) => setTimeout(r, 10));

    expect(channel.sendToQueue).toHaveBeenCalledWith(
      'events.dlq',
      expect.any(Buffer),
      expect.any(Object),
    );
  });

  it('resubscribes on reconnect', async () => {
    expect(reconnectListener).toBeTruthy();
    const createCallsBefore = connection.createChannel.mock.calls.length;

    await reconnectListener!();

    expect(connection.createChannel.mock.calls.length).toBeGreaterThan(
      createCallsBefore,
    );
    expect(channel.consume.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
