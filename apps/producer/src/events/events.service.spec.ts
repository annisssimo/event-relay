import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { RabbitPublisherService } from '@app/messaging';

describe('EventsService', () => {
  let service: EventsService;
  const publish = jest.fn().mockResolvedValue(undefined);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: RabbitPublisherService, useValue: { publish } },
      ],
    }).compile();

    service = module.get(EventsService);
    publish.mockClear();
  });

  it('publishes envelope with generated eventId', async () => {
    const result = await service.publish({
      type: 'order.created',
      payload: { orderId: '1' },
    });

    expect(result.status).toBe('accepted');
    expect(result.eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(publish).toHaveBeenCalledTimes(1);
    const body = JSON.parse(publish.mock.calls[0][0] as string);
    expect(body.type).toBe('order.created');
    expect(body.eventId).toBe(result.eventId);
  });

  it('uses client-provided eventId', async () => {
    const eventId = '550e8400-e29b-41d4-a716-446655440000';
    const result = await service.publish({
      type: 'x',
      payload: {},
      eventId,
    });
    expect(result.eventId).toBe(eventId);
  });
});
