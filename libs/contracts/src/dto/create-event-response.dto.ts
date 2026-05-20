import { ApiProperty } from '@nestjs/swagger';

export class CreateEventResponseDto {
  @ApiProperty({ format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  eventId!: string;

  @ApiProperty({ example: 'accepted', enum: ['accepted'] })
  status!: 'accepted';

  @ApiProperty({ format: 'date-time', example: '2026-05-20T12:00:00.000Z' })
  publishedAt!: string;
}
