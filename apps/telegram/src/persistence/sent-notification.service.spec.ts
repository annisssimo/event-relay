import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IsNull } from 'typeorm';
import { SentNotificationService } from './sent-notification.service';
import { SentNotificationEntity } from './sent-notification.entity';

describe('SentNotificationService', () => {
  let service: SentNotificationService;
  let repo: {
    insert: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SentNotificationService,
        {
          provide: getRepositoryToken(SentNotificationEntity),
          useValue: repo,
        },
      ],
    }).compile();

    service = module.get(SentNotificationService);
  });

  it('reserves eventId atomically', async () => {
    repo.insert.mockResolvedValue(undefined);

    await expect(
      service.tryReserve('550e8400-e29b-41d4-a716-446655440000', '123'),
    ).resolves.toBe(true);
  });

  it('returns false on duplicate eventId', async () => {
    repo.insert.mockRejectedValue({ code: '23505' });

    await expect(
      service.tryReserve('550e8400-e29b-41d4-a716-446655440000', '123'),
    ).resolves.toBe(false);
  });

  it('releases pending reservation on failure', async () => {
    repo.delete.mockResolvedValue(undefined);

    await service.releaseReservation('550e8400-e29b-41d4-a716-446655440000');

    expect(repo.delete).toHaveBeenCalledWith({
      eventId: '550e8400-e29b-41d4-a716-446655440000',
      telegramMessageId: IsNull(),
    });
  });
});
