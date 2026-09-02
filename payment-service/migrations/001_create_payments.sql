CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  order_id VARCHAR(255) NOT NULL,
  amount NUMERIC(20,2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL,
  status VARCHAR(32) NOT NULL,
  gateway VARCHAR(64) NOT NULL,
  gateway_reference VARCHAR(255) UNIQUE NOT NULL,
  idempotency_key VARCHAR(255),
  refund_amount NUMERIC(20,2),
  history JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE(user_id, order_id, idempotency_key)
);
CREATE TABLE IF NOT EXISTS payment_webhook_events (
  event_id VARCHAR(255) PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS payment_outbox (
  id VARCHAR(255) PRIMARY KEY,
  type VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
