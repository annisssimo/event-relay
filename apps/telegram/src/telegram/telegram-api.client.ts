import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PermanentError, TransientError, withRetry } from '@app/common';
import { TelegramParseMode } from '@app/contracts';

export interface SendMessageParams {
  chatId: string | number;
  text: string;
  parseMode?: TelegramParseMode;
  disableNotification?: boolean;
}

export interface SendMessageResult {
  messageId: number;
}

interface TelegramApiResponse {
  ok: boolean;
  result?: { message_id: number };
  description?: string;
  error_code?: number;
  parameters?: { retry_after?: number };
}

@Injectable()
export class TelegramApiClient implements OnModuleInit {
  private readonly logger = new Logger(TelegramApiClient.name);
  private token = '';

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.token = this.config.get<string>('TELEGRAM_BOT_TOKEN', '');
    if (!this.token) {
      throw new Error('TELEGRAM_BOT_TOKEN is required');
    }
  }

  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    const text = this.normalizeText(params.text);
    const url = `https://api.telegram.org/bot${this.token}/sendMessage`;

    return withRetry(
      async () => {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: params.chatId,
            text,
            parse_mode: params.parseMode,
            disable_notification: params.disableNotification ?? false,
          }),
          signal: AbortSignal.timeout(15_000),
        });

        const body = (await response.json()) as TelegramApiResponse;

        if (body.ok && body.result?.message_id) {
          return { messageId: body.result.message_id };
        }

        const code = body.error_code ?? response.status;
        const description = body.description ?? 'Unknown Telegram API error';

        if (code === 429) {
          const retryAfter = (body.parameters?.retry_after ?? 1) * 1000;
          await new Promise((r) => setTimeout(r, retryAfter));
          throw new TransientError(`Telegram rate limit: ${description}`);
        }

        if (code === 400 || code === 403) {
          throw new PermanentError(description);
        }

        if (code >= 500 || !response.ok) {
          throw new TransientError(description);
        }

        throw new PermanentError(description);
      },
      { maxAttempts: 5, baseDelayMs: 500, maxDelayMs: 30_000 },
    );
  }

  private normalizeText(text: string): string {
    const maxLen = 4096;
    if (text.length <= maxLen) {
      return text;
    }
    this.logger.warn(`Truncating message from ${text.length} to ${maxLen}`);
    return `${text.slice(0, maxLen - 3)}...`;
  }
}
