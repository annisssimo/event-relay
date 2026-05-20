import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotifyDto } from '@app/contracts';
import { NotificationSenderService } from '../telegram/notification-sender.service';

@ApiTags('notify')
@Controller('notify')
export class NotifyController {
  constructor(private readonly sender: NotificationSenderService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a Telegram notification directly (bypass queue)' })
  @ApiCreatedResponse()
  notify(@Body() dto: NotifyDto) {
    return this.sender.sendFromDto(dto);
  }
}
