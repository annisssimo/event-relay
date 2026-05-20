import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hashPayload } from '@app/common';
import {
  ProcessedEventEntity,
  ProcessedEventStatus,
} from './processed-event.entity';

/** Reclaim stale PROCESSING locks after crash between publish and complete. */
const STALE_PROCESSING_MS = 120_000;

export type IdempotencyBeginResult =
  | { action: 'process' }
  | {
      action: 'skip';
      reason: 'already_completed' | 'in_progress';
    };

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
    const payloadHash = hashPayload(payload);

    const existing = await this.repo.findOne({ where: { eventId } });
    if (existing?.status === ProcessedEventStatus.COMPLETED) {
      return { action: 'skip', reason: 'already_completed' };
    }

    if (!existing) {
      try {
        await this.repo.insert({
          eventId,
          type,
          status: ProcessedEventStatus.PROCESSING,
          handler: 'events-consumer',
          payloadHash,
          error: null,
        });
        return { action: 'process' };
      } catch (error) {
        if (!this.isUniqueViolation(error)) {
          throw error;
        }
        return this.resolveExisting(eventId, type, payloadHash);
      }
    }

    return this.resolveExisting(eventId, type, payloadHash, existing);
  }

  private async resolveExisting(
    eventId: string,
    type: string,
    payloadHash: string,
    existing?: ProcessedEventEntity | null,
  ): Promise<IdempotencyBeginResult> {
    const row =
      existing ?? (await this.repo.findOne({ where: { eventId } }));
    if (!row) {
      return { action: 'process' };
    }

    if (row.status === ProcessedEventStatus.COMPLETED) {
      return { action: 'skip', reason: 'already_completed' };
    }

    if (row.status === ProcessedEventStatus.PROCESSING) {
      const ageMs = Date.now() - row.updatedAt.getTime();
      if (ageMs < STALE_PROCESSING_MS) {
        return { action: 'skip', reason: 'in_progress' };
      }
    }

    await this.repo.update(
      { eventId },
      {
        type,
        status: ProcessedEventStatus.PROCESSING,
        error: null,
        payloadHash,
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

  private isUniqueViolation(error: unknown): boolean {
    return (error as { code?: string })?.code === '23505';
  }
}
