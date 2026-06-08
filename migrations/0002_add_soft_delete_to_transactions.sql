ALTER TABLE transactions
ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_transactions_user_deleted_created
ON transactions (user_id, deleted_at, created_at);
