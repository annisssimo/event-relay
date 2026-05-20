-- Production schema (use with DB_SYNCHRONIZE=false)
CREATE TYPE processed_event_status AS ENUM ('processing', 'completed', 'failed');

CREATE TABLE IF NOT EXISTS processed_events (
  event_id UUID PRIMARY KEY,
  type VARCHAR(128) NOT NULL,
  status processed_event_status NOT NULL DEFAULT 'processing',
  handler VARCHAR(64) NOT NULL DEFAULT 'events-consumer',
  payload_hash VARCHAR(64) NOT NULL,
  error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sent_notifications (
  event_id UUID PRIMARY KEY,
  chat_id VARCHAR(64) NOT NULL,
  telegram_message_id BIGINT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_events_status ON processed_events (status);
CREATE INDEX IF NOT EXISTS idx_sent_notifications_sent_at ON sent_notifications (sent_at);
