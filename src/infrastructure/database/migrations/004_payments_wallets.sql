-- 004_payments_wallets.sql

-- Payments & Wallets: wallets, transactions, payment_orders, payment_refunds, saved_payment_methods, cash_collections, cash_deposits, driver_cash_balance

-- Generated from live DB schema


-- ============================================================
-- Table: wallets
-- ============================================================
CREATE TABLE IF NOT EXISTS wallets (
    id SERIAL NOT NULL,
    user_id UUID NOT NULL,
    balance DECIMAL(10,2) DEFAULT 0.0,
    total_credited DECIMAL(10,2) DEFAULT 0.0,
    total_debited DECIMAL(10,2) DEFAULT 0.0,
    last_transaction_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT wallets_pkey PRIMARY KEY (id),
    CONSTRAINT wallets_user_id_key UNIQUE (user_id),
    CONSTRAINT wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON public.wallets USING btree (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS wallets_user_id_key ON public.wallets USING btree (user_id);

-- ============================================================
-- Table: transactions
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL NOT NULL,
    transaction_number VARCHAR(50) NOT NULL,
    user_id UUID NOT NULL,
    wallet_id INTEGER,
    ride_id INTEGER,
    amount DECIMAL(10,2) NOT NULL,
    type VARCHAR(20) NOT NULL,
    category VARCHAR(50) NOT NULL,
    payment_method VARCHAR(50),
    payment_gateway VARCHAR(50),
    gateway_transaction_id VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending',
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT transactions_category_check CHECK (((category)::text = ANY ((ARRAY['ride_payment'::character varying, 'ride_refund'::character varying, 'ride_earnings'::character varying, 'wallet_recharge'::character varying, 'referral_bonus'::character varying, 'cancellation_fee'::character varying, 'withdrawal'::character varying, 'subscription'::character varying, 'driver_incentive'::character varying, 'tip'::character varying])::text[]))),
    CONSTRAINT transactions_payment_method_check CHECK (((payment_method)::text = ANY ((ARRAY['cash'::character varying, 'card'::character varying, 'wallet'::character varying, 'upi'::character varying, 'upi_qr'::character varying, 'corporate'::character varying])::text[]))),
    CONSTRAINT transactions_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'success'::character varying, 'failed'::character varying, 'refunded'::character varying])::text[]))),
    CONSTRAINT transactions_type_check CHECK (((type)::text = ANY ((ARRAY['credit'::character varying, 'debit'::character varying])::text[]))),
    CONSTRAINT transactions_pkey PRIMARY KEY (id),
    CONSTRAINT transactions_transaction_number_key UNIQUE (transaction_number),
    CONSTRAINT transactions_ride_id_fkey FOREIGN KEY (ride_id) REFERENCES rides(id),
    CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT transactions_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES wallets(id)
);

CREATE INDEX IF NOT EXISTS idx_transactions_ride_id ON public.transactions USING btree (ride_id);

CREATE INDEX IF NOT EXISTS idx_transactions_transaction_number ON public.transactions USING btree (transaction_number);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions USING btree (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS transactions_transaction_number_key ON public.transactions USING btree (transaction_number);

-- ============================================================
-- Table: payment_orders
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_orders (
    id SERIAL NOT NULL,
    order_number VARCHAR(60) NOT NULL,
    user_id UUID NOT NULL,
    ride_id INTEGER,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(5) DEFAULT 'INR' NOT NULL,
    purpose VARCHAR(50) NOT NULL,
    payment_method VARCHAR(20),
    payment_gateway VARCHAR(50),
    gateway_order_id VARCHAR(255),
    gateway_payment_id VARCHAR(255),
    gateway_signature VARCHAR(500),
    status VARCHAR(20) DEFAULT 'created' NOT NULL,
    failure_reason TEXT,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    expires_at TIMESTAMP,
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT payment_orders_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT payment_orders_payment_method_check CHECK (((payment_method)::text = ANY ((ARRAY['cash'::character varying, 'card'::character varying, 'wallet'::character varying, 'upi'::character varying, 'qr'::character varying])::text[]))),
    CONSTRAINT payment_orders_purpose_check CHECK (((purpose)::text = ANY ((ARRAY['ride_payment'::character varying, 'wallet_recharge'::character varying, 'subscription'::character varying, 'cancellation_fee'::character varying, 'tip'::character varying])::text[]))),
    CONSTRAINT payment_orders_status_check CHECK (((status)::text = ANY ((ARRAY['created'::character varying, 'attempted'::character varying, 'success'::character varying, 'failed'::character varying, 'refunded'::character varying, 'partially_refunded'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT payment_orders_pkey PRIMARY KEY (id),
    CONSTRAINT payment_orders_order_number_key UNIQUE (order_number),
    CONSTRAINT payment_orders_ride_id_fkey FOREIGN KEY (ride_id) REFERENCES rides(id),
    CONSTRAINT payment_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_gateway ON public.payment_orders USING btree (gateway_order_id);

CREATE INDEX IF NOT EXISTS idx_payment_orders_number ON public.payment_orders USING btree (order_number);

CREATE INDEX IF NOT EXISTS idx_payment_orders_ride_id ON public.payment_orders USING btree (ride_id);

CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON public.payment_orders USING btree (status);

CREATE INDEX IF NOT EXISTS idx_payment_orders_user_id ON public.payment_orders USING btree (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS payment_orders_order_number_key ON public.payment_orders USING btree (order_number);

-- ============================================================
-- Table: payment_refunds
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_refunds (
    id SERIAL NOT NULL,
    refund_number VARCHAR(60) NOT NULL,
    payment_order_id INTEGER NOT NULL,
    user_id UUID NOT NULL,
    ride_id INTEGER,
    amount DECIMAL(10,2) NOT NULL,
    reason VARCHAR(500),
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    refund_method VARCHAR(20),
    gateway_refund_id VARCHAR(255),
    processed_at TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT payment_refunds_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT payment_refunds_refund_method_check CHECK (((refund_method)::text = ANY ((ARRAY['source'::character varying, 'wallet'::character varying])::text[]))),
    CONSTRAINT payment_refunds_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'success'::character varying, 'failed'::character varying])::text[]))),
    CONSTRAINT payment_refunds_pkey PRIMARY KEY (id),
    CONSTRAINT payment_refunds_refund_number_key UNIQUE (refund_number),
    CONSTRAINT payment_refunds_payment_order_id_fkey FOREIGN KEY (payment_order_id) REFERENCES payment_orders(id),
    CONSTRAINT payment_refunds_ride_id_fkey FOREIGN KEY (ride_id) REFERENCES rides(id),
    CONSTRAINT payment_refunds_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payment_refunds_order_id ON public.payment_refunds USING btree (payment_order_id);

CREATE INDEX IF NOT EXISTS idx_payment_refunds_user_id ON public.payment_refunds USING btree (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS payment_refunds_refund_number_key ON public.payment_refunds USING btree (refund_number);

-- ============================================================
-- Table: saved_payment_methods
-- ============================================================
CREATE TABLE IF NOT EXISTS saved_payment_methods (
    id SERIAL NOT NULL,
    user_id UUID NOT NULL,
    type VARCHAR(20) NOT NULL,
    card_last4 VARCHAR(4),
    card_brand VARCHAR(20),
    card_exp_month INTEGER,
    card_exp_year INTEGER,
    upi_id VARCHAR(100),
    gateway_token VARCHAR(500) NOT NULL,
    gateway_customer_id VARCHAR(255),
    payment_gateway VARCHAR(50),
    is_default BOOLEAN DEFAULT FALSE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT saved_payment_methods_type_check CHECK (((type)::text = ANY ((ARRAY['card'::character varying, 'upi'::character varying, 'netbanking'::character varying])::text[]))),
    CONSTRAINT saved_payment_methods_pkey PRIMARY KEY (id),
    CONSTRAINT saved_payment_methods_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_saved_methods_user_id ON public.saved_payment_methods USING btree (user_id);

-- ============================================================
-- Table: cash_collections
-- ============================================================
CREATE TABLE IF NOT EXISTS cash_collections (
    id SERIAL NOT NULL,
    ride_id INTEGER NOT NULL,
    driver_id INTEGER NOT NULL,
    passenger_id UUID NOT NULL,
    final_fare DECIMAL(10,2) NOT NULL,
    platform_fee DECIMAL(10,2) DEFAULT 0 NOT NULL,
    net_earnings DECIMAL(10,2) DEFAULT 0 NOT NULL,
    collection_method VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'confirmed' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT cash_collections_collection_method_check CHECK (((collection_method)::text = ANY ((ARRAY['cash'::character varying, 'personal_upi'::character varying])::text[]))),
    CONSTRAINT cash_collections_final_fare_check CHECK ((final_fare > (0)::numeric)),
    CONSTRAINT cash_collections_net_earnings_check CHECK ((net_earnings >= (0)::numeric)),
    CONSTRAINT cash_collections_platform_fee_check CHECK ((platform_fee >= (0)::numeric)),
    CONSTRAINT cash_collections_status_check CHECK (((status)::text = ANY ((ARRAY['confirmed'::character varying, 'disputed'::character varying, 'settled'::character varying])::text[]))),
    CONSTRAINT cash_collections_pkey PRIMARY KEY (id),
    CONSTRAINT cash_collections_ride_id_key UNIQUE (ride_id),
    CONSTRAINT cash_collections_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
    CONSTRAINT cash_collections_passenger_id_fkey FOREIGN KEY (passenger_id) REFERENCES users(id),
    CONSTRAINT cash_collections_ride_id_fkey FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS cash_collections_ride_id_key ON public.cash_collections USING btree (ride_id);

CREATE INDEX IF NOT EXISTS idx_cash_collections_created ON public.cash_collections USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_collections_driver ON public.cash_collections USING btree (driver_id);

CREATE INDEX IF NOT EXISTS idx_cash_collections_ride ON public.cash_collections USING btree (ride_id);

-- ============================================================
-- Table: cash_deposits
-- ============================================================
CREATE TABLE IF NOT EXISTS cash_deposits (
    id SERIAL NOT NULL,
    driver_id INTEGER NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    deposit_method VARCHAR(20) NOT NULL,
    reference_number VARCHAR(100),
    deposit_proof TEXT,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    verified_by UUID,
    verified_at TIMESTAMP,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT cash_deposits_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT cash_deposits_deposit_method_check CHECK (((deposit_method)::text = ANY ((ARRAY['upi'::character varying, 'bank_transfer'::character varying, 'cash_center'::character varying, 'auto_deduct'::character varying])::text[]))),
    CONSTRAINT cash_deposits_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'verified'::character varying, 'rejected'::character varying])::text[]))),
    CONSTRAINT cash_deposits_pkey PRIMARY KEY (id),
    CONSTRAINT cash_deposits_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
    CONSTRAINT cash_deposits_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_cash_deposits_driver ON public.cash_deposits USING btree (driver_id);

CREATE INDEX IF NOT EXISTS idx_cash_deposits_pending ON public.cash_deposits USING btree (status) WHERE ((status)::text = 'pending'::text);

-- ============================================================
-- Table: driver_cash_balance
-- ============================================================
CREATE TABLE IF NOT EXISTS driver_cash_balance (
    id SERIAL NOT NULL,
    driver_id INTEGER NOT NULL,
    pending_amount DECIMAL(10,2) DEFAULT 0 NOT NULL,
    total_cash_collected DECIMAL(10,2) DEFAULT 0 NOT NULL,
    total_deposited DECIMAL(10,2) DEFAULT 0 NOT NULL,
    total_platform_share DECIMAL(10,2) DEFAULT 0 NOT NULL,
    deposit_due_date TIMESTAMP,
    is_limit_exceeded BOOLEAN DEFAULT FALSE NOT NULL,
    cash_limit DECIMAL(10,2) DEFAULT 2000 NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT driver_cash_balance_pending_amount_check CHECK ((pending_amount >= (0)::numeric)),
    CONSTRAINT driver_cash_balance_pkey PRIMARY KEY (id),
    CONSTRAINT driver_cash_balance_driver_id_key UNIQUE (driver_id),
    CONSTRAINT driver_cash_balance_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS driver_cash_balance_driver_id_key ON public.driver_cash_balance USING btree (driver_id);

CREATE INDEX IF NOT EXISTS idx_driver_cash_balance_driver ON public.driver_cash_balance USING btree (driver_id);

CREATE INDEX IF NOT EXISTS idx_driver_cash_limit_exceeded ON public.driver_cash_balance USING btree (is_limit_exceeded) WHERE (is_limit_exceeded = true);
