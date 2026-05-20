import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IdempotencyService } from './idempotency.service';
import {
  ProcessedEventEntity,
  ProcessedEventStatus,
} from './processed-event.entity';

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let repo: jest.Mocked<
    Pick<Repository<ProcessedEventEntity>, 'findOne' | 'insert' | 'update'>
  >;

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        {
          provide: getRepositoryToken(ProcessedEventEntity),
          useValue: repo,
        },
      ],
    }).compile();

    service = module.get(IdempotencyService);
  });

  it('skips already completed events', async () => {
    repo.findOne.mockResolvedValue({
      eventId: '550e8400-e29b-41d4-a716-446655440000',
      status: ProcessedEventStatus.COMPLETED,
    } as ProcessedEventEntity);

    const result = await service.begin('550e8400-e29b-41d4-a716-446655440000', 'x', {});

    expect(result).toEqual({ action: 'skip', reason: 'already_completed' });
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('processes new events via insert', async () => {
    repo.findOne.mockResolvedValue(null);
    repo.insert.mockResolvedValue({} as never);

    const result = await service.begin('550e8400-e29b-41d4-a716-446655440000', 'order.created', { id: 1 });

    expect(result).toEqual({ action: 'process' });
    expect(repo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: '550e8400-e29b-41d4-a716-446655440000',
        status: ProcessedEventStatus.PROCESSING,
      }),
    );
  });

  it('skips concurrent in-progress events', async () => {
    repo.findOne.mockResolvedValue({
      eventId: '550e8400-e29b-41d4-a716-446655440000',
      status: ProcessedEventStatus.PROCESSING,
      updatedAt: new Date(),
    } as ProcessedEventEntity);

    const result = await service.begin('550e8400-e29b-41d4-a716-446655440000', 'x', {});

    expect(result).toEqual({ action: 'skip', reason: 'in_progress' });
  });

  it('reclaims stale processing locks', async () => {
    repo.findOne.mockResolvedValue({
      eventId: '550e8400-e29b-41d4-a716-446655440000',
      status: ProcessedEventStatus.PROCESSING,
      updatedAt: new Date(Date.now() - 300_000),
    } as ProcessedEventEntity);
    repo.update.mockResolvedValue({} as never);

    const result = await service.begin('550e8400-e29b-41d4-a716-446655440000', 'x', {});

    expect(result).toEqual({ action: 'process' });
    expect(repo.update).toHaveBeenCalled();
  });

  it('handles insert race via unique violation', async () => {
    repo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        eventId: '550e8400-e29b-41d4-a716-446655440000',
        status: ProcessedEventStatus.PROCESSING,
        updatedAt: new Date(),
      } as ProcessedEventEntity);
    repo.insert.mockRejectedValue({ code: '23505' });

    const result = await service.begin('550e8400-e29b-41d4-a716-446655440000', 'x', {});

    expect(result).toEqual({ action: 'skip', reason: 'in_progress' });
  });
});
