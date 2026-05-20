export const RABBIT_EXCHANGES = {
  EVENTS_TOPIC: 'events.topic',
  EVENTS_DLX: 'events.dlx',
  NOTIFICATIONS_DIRECT: 'notifications.direct',
  NOTIFICATIONS_DLX: 'notifications.dlx',
} as const;

export const RABBIT_QUEUES = {
  EVENTS_MAIN: 'events.main',
  EVENTS_DLQ: 'events.dlq',
  EVENTS_RETRY: 'events.retry',
  NOTIFICATIONS_TELEGRAM: 'notifications.telegram',
  NOTIFICATIONS_DLQ: 'notifications.dlq',
  NOTIFICATIONS_RETRY: 'notifications.retry',
} as const;

export const RABBIT_ROUTING_KEYS = {
  EVENT_PATTERN: 'event.#',
  EVENT_DEFAULT: 'event.default',
  NOTIFICATION_TELEGRAM: 'notification.telegram',
} as const;

export const MESSAGE_HEADERS = {
  IDEMPOTENCY_KEY: 'x-idempotency-key',
  CORRELATION_ID: 'x-correlation-id',
  RETRY_COUNT: 'x-retry-count',
} as const;

export const RETRY_POLICY = {
  MAX_RETRIES: 5,
  RETRY_TTL_MS: 5000,
} as const;
