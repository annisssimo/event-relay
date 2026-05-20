import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { TelegramParseMode } from '../notification-payload';

export class NotifyDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  eventId?: string;

  @ApiProperty({ example: 'manual.notify' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  type!: string;

  @ApiProperty({ example: '123456789' })
  @IsString()
  @IsNotEmpty()
  chatId!: string;

  @ApiProperty({ example: 'Hello from the notification service' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  text!: string;

  @ApiPropertyOptional({ enum: ['HTML', 'MarkdownV2'] })
  @IsOptional()
  @IsEnum(['HTML', 'MarkdownV2'])
  parseMode?: TelegramParseMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  disableNotification?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  correlationId?: string;
}
