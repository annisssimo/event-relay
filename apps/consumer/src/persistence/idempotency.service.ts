import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hashPayload } from '@app/common';
import {
  ProcessedEventEntity,
  ProcessedEventStatus,
} from './processed-event.entity';

export type IdempotencyBeginResult =
  | { action: 'process' }
  | { action: 'skip'; reason: 'already_completed' };

@Injectable()
export class IdempotencyService {
  constructor(
    @InjectRepository(ProcessedEventEntity)
    private readonly repo: Repository<ProcessedEventEntity>,
  ) {}

  async begin(
    eventId: string,
    type: string,
    payload: unknown,
  ): Promise<IdempotencyBeginResult> {
    const existing = await this.repo.findOne({ where: { eventId } });
    if (existing?.status === ProcessedEventStatus.COMPLETED) {
      return { action: 'skip', reason: 'already_completed' };
    }

    if (!existing) {
      await this.repo.insert({
        eventId,
        type,
        status: ProcessedEventStatus.PROCESSING,
        handler: 'events-consumer',
        payloadHash: hashPayload(payload),
        error: null,
      });
      return { action: 'process' };
    }

    if (existing.status === ProcessedEventStatus.PROCESSING) {
      return { action: 'process' };
    }

    await this.repo.update(
      { eventId },
      {
        status: ProcessedEventStatus.PROCESSING,
        error: null,
        payloadHash: hashPayload(payload),
      },
    );
    return { action: 'process' };
  }

  async complete(eventId: string): Promise<void> {
    await this.repo.update(
      { eventId },
      { status: ProcessedEventStatus.COMPLETED, error: null },
    );
  }

  async fail(eventId: string, error: string): Promise<void> {
    await this.repo.update(
      { eventId },
      { status: ProcessedEventStatus.FAILED, error },
    );
  }
}
