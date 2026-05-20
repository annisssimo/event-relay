export class TransientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransientError';
  }
}

export class PermanentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentError';
  }
}

export function isTransientError(error: unknown): boolean {
  if (error instanceof TransientError) {
    return true;
  }
  if (error instanceof PermanentError) {
    return false;
  }
  const code = (error as NodeJS.ErrnoException)?.code;
  if (
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'EPIPE'
  ) {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('channel closed') ||
    message.includes('Connection closed') ||
    message.includes('timeout')
  );
}
