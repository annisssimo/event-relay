import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { EventsController } from '../src/events/events.controller';
import { EventsService } from '../src/events/events.service';

describe('EventsController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [
        {
          provide: EventsService,
          useValue: {
            publish: jest.fn().mockResolvedValue({
              eventId: '550e8400-e29b-41d4-a716-446655440000',
              status: 'accepted',
              publishedAt: new Date().toISOString(),
            }),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/events returns 201', () => {
    return request(app.getHttpServer())
      .post('/api/v1/events')
      .send({ type: 'user.registered', payload: { userId: '1' } })
      .expect(201)
      .expect((res) => {
        expect(res.body.status).toBe('accepted');
        expect(res.body.eventId).toBeDefined();
      });
  });

  it('rejects invalid body', () => {
    return request(app.getHttpServer())
      .post('/api/v1/events')
      .send({ type: '', payload: 'not-object' })
      .expect(400);
  });
});
