export interface EventEnvelope<T = unknown> {
  eventId: string;
  type: string;
  version: number;
  occurredAt: string;
  payload: T;
  correlationId?: string;
}

export const EVENT_ENVELOPE_VERSION = 1;
