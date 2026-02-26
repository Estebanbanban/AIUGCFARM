-- 008: Credit transactions
CREATE TYPE credit_transaction_type AS ENUM ('subscription_grant', 'generation_debit', 'refund_credit', 'overage_debit');

CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id),
  batch_id UUID REFERENCES segment_batches(id),
  type credit_transaction_type NOT NULL,
  amount INT NOT NULL,
  balance_after INT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_subscription_id ON credit_transactions(subscription_id);
