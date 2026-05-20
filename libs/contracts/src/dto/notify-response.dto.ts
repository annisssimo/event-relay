import { ApiProperty } from '@nestjs/swagger';

export class NotifyResponseDto {
  @ApiProperty({ format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  eventId!: string;

  @ApiProperty({ example: 'sent', enum: ['sent'] })
  status!: 'sent';
}
