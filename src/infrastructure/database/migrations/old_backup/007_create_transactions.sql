CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    transaction_number VARCHAR(50) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_id INTEGER REFERENCES wallets(id),
    ride_id INTEGER REFERENCES rides(id),
    
    amount DECIMAL(10, 2) NOT NULL,
    type VARCHAR(20) CHECK (type IN ('credit', 'debit')) NOT NULL,
    category VARCHAR(50) CHECK (category IN (
        'ride_payment', 'ride_refund', 'wallet_recharge', 
        'referral_bonus', 'cancellation_fee', 'withdrawal'
    )) NOT NULL,
    
    payment_method VARCHAR(50) CHECK (payment_method IN (
        'cash', 'card', 'wallet', 'upi'
    )),
    payment_gateway VARCHAR(50),
    gateway_transaction_id VARCHAR(255),
    
    status VARCHAR(20) CHECK (status IN (
        'pending', 'success', 'failed', 'refunded'
    )) DEFAULT 'pending',
    
    description TEXT,
    metadata JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_ride_id ON transactions(ride_id);
CREATE INDEX idx_transactions_transaction_number ON transactions(transaction_number);