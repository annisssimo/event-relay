import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { NotifyController } from '../src/notify/notify.controller';
import { NotificationSenderService } from '../src/telegram/notification-sender.service';

describe('NotifyController (e2e)', () => {
  let app: INestApplication;
  const sendFromDto = jest.fn().mockResolvedValue({
    eventId: '550e8400-e29b-41d4-a716-446655440000',
    status: 'sent',
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [NotifyController],
      providers: [
        {
          provide: NotificationSenderService,
          useValue: { sendFromDto },
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

  it('POST /api/v1/notify returns 201', () => {
    return request(app.getHttpServer())
      .post('/api/v1/notify')
      .send({
        type: 'manual.alert',
        chatId: '123456789',
        text: 'Hello',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.status).toBe('sent');
        expect(res.body.eventId).toBeDefined();
      });
  });

  it('rejects invalid body', () => {
    return request(app.getHttpServer())
      .post('/api/v1/notify')
      .send({ type: 'x', chatId: '', text: '' })
      .expect(400);
  });
});
