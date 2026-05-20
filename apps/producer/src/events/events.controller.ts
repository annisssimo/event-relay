import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateEventDto } from '@app/contracts';
import { EventsService } from './events.service';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Publish a domain event to RabbitMQ' })
  @ApiCreatedResponse({ description: 'Event accepted by broker' })
  publish(@Body() dto: CreateEventDto) {
    return this.eventsService.publish(dto);
  }
}
