import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { EventsController } from '../src/events/events.controller';
import { EventsService } from '../src/events/events.service';
import { RabbitPublisherService } from '@app/messaging';
import { TopologyBootstrapService } from '../src/topology-bootstrap.service';

describe('EventsController (e2e)', () => {
  let app: INestApplication;
  const publish = jest.fn().mockResolvedValue(undefined);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [
        EventsService,
        { provide: RabbitPublisherService, useValue: { publish } },
        {
          provide: TopologyBootstrapService,
          useValue: { whenReady: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    publish.mockClear();
  });

  it('POST /api/v1/events returns 201 with real EventsService', () => {
    return request(app.getHttpServer())
      .post('/api/v1/events')
      .send({ type: 'user.registered', payload: { userId: '1' } })
      .expect(201)
      .expect((res) => {
        expect(res.body.status).toBe('accepted');
        expect(res.body.eventId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        );
        expect(res.body.publishedAt).toBeDefined();
        expect(publish).toHaveBeenCalledTimes(1);
        const envelope = JSON.parse(publish.mock.calls[0][0] as string);
        expect(envelope.eventId).toBe(res.body.eventId);
        expect(envelope.type).toBe('user.registered');
      });
  });

  it('accepts client-provided eventId', () => {
    const eventId = '550e8400-e29b-41d4-a716-446655440000';
    return request(app.getHttpServer())
      .post('/api/v1/events')
      .send({ type: 'user.registered', payload: { userId: '1' }, eventId })
      .expect(201)
      .expect((res) => {
        expect(res.body.eventId).toBe(eventId);
      });
  });

  it('rejects invalid body', () => {
    return request(app.getHttpServer())
      .post('/api/v1/events')
      .send({ type: '', payload: 'not-object' })
      .expect(400);
  });
});
