-- Cash ride ka driver ka hissa (net earnings) hold karo jab tak platform fee settle na ho
ALTER TABLE driver_cash_balance
ADD COLUMN IF NOT EXISTS pending_net_earnings DECIMAL(10,2) NOT NULL DEFAULT 0
    CHECK (pending_net_earnings >= 0);
