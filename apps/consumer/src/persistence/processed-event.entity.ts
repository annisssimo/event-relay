import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export enum ProcessedEventStatus {
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity({ name: 'processed_events' })
export class ProcessedEventEntity {
  @PrimaryColumn({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @Column({ type: 'varchar', length: 128 })
  type!: string;

  @Column({
    type: 'enum',
    enum: ProcessedEventStatus,
    default: ProcessedEventStatus.PROCESSING,
  })
  status!: ProcessedEventStatus;

  @Column({ type: 'varchar', length: 64, default: 'events-consumer' })
  handler!: string;

  @Column({ name: 'payload_hash', type: 'varchar', length: 64 })
  payloadHash!: string;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
