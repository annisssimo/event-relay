import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateEventDto {
  @ApiProperty({ example: 'user.registered' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  type!: string;

  @ApiProperty({ example: { userId: '42', email: 'user@example.com' } })
  @IsObject()
  payload!: Record<string, unknown>;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  eventId?: string;

  @ApiPropertyOptional({ example: 'req-abc-123' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  correlationId?: string;
}
