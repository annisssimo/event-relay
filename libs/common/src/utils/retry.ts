import { isTransientError } from '../errors';
import { sleep } from './sleep';

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs?: number;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const maxDelay = options.maxDelayMs ?? 30_000;
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isTransientError(error) || attempt === options.maxAttempts) {
        throw error;
      }
      const delay = Math.min(
        options.baseDelayMs * 2 ** (attempt - 1) + Math.random() * 100,
        maxDelay,
      );
      await sleep(delay);
    }
  }

  throw lastError;
}
