import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  CreateEventDto,
  EVENT_ENVELOPE_VERSION,
  EventEnvelope,
  RABBIT_EXCHANGES,
} from '@app/contracts';
import { RabbitPublisherService } from '@app/messaging';
import { isTransientError } from '@app/common';

export interface PublishEventResult {
  eventId: string;
  status: 'accepted';
  publishedAt: string;
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(private readonly publisher: RabbitPublisherService) {}

  async publish(dto: CreateEventDto): Promise<PublishEventResult> {
    const eventId = dto.eventId ?? uuidv4();
    const envelope: EventEnvelope = {
      eventId,
      type: dto.type,
      version: EVENT_ENVELOPE_VERSION,
      occurredAt: new Date().toISOString(),
      payload: dto.payload,
      correlationId: dto.correlationId,
    };

    const routingKey = `event.${dto.type}`;

    try {
      await this.publisher.publish(JSON.stringify(envelope), {
        exchange: RABBIT_EXCHANGES.EVENTS_TOPIC,
        routingKey,
        eventId,
        correlationId: dto.correlationId,
      });
    } catch (error) {
      this.logger.error(
        `Failed to publish eventId=${eventId}: ${(error as Error).message}`,
      );
      if (isTransientError(error)) {
        throw new ServiceUnavailableException(
          'Message broker temporarily unavailable',
        );
      }
      throw error;
    }

    return {
      eventId,
      status: 'accepted',
      publishedAt: new Date().toISOString(),
    };
  }
}
