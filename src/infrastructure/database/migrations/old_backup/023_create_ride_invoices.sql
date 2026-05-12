-- ─────────────────────────────────────────────────────────────────────────────
-- RIDE INVOICES — Fare Breakdown + Tax Receipt
-- Ride complete hone ke baad detailed invoice generate hota hai
--
-- rides table mein sirf final_fare hai, yahan full breakdown store hoga:
--   base_fare + distance_fare + time_fare + surge + convenience_fee
--   - discount - coupon + waiting_charges + toll + tax = total
--
-- Invoice number GST compliant format mein hoga
-- Passenger app mein "View Receipt" pe yahi data dikhega
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ride_invoices (
    id                      SERIAL PRIMARY KEY,
    ride_id                 INTEGER         NOT NULL REFERENCES rides(id) ON DELETE CASCADE UNIQUE,

    -- Unique invoice number (format: INV-YYYYMMDD-XXXXX)
    invoice_number          VARCHAR(50)     NOT NULL UNIQUE,

    -- ─── Fare Breakdown ───────────────────────────────────────────────────
    base_fare               DECIMAL(10,2)   NOT NULL DEFAULT 0,
    distance_fare           DECIMAL(10,2)   NOT NULL DEFAULT 0,      -- per km charge
    time_fare               DECIMAL(10,2)   NOT NULL DEFAULT 0,      -- per min charge
    surge_charge            DECIMAL(10,2)   NOT NULL DEFAULT 0,      -- surge multiplier ka extra
    convenience_fee         DECIMAL(10,2)   NOT NULL DEFAULT 0,      -- platform convenience fee
    platform_fee            DECIMAL(10,2)   NOT NULL DEFAULT 0,      -- fixed platform fee
    waiting_charges         DECIMAL(10,2)   NOT NULL DEFAULT 0,      -- grace period ke baad
    pickup_charges          DECIMAL(10,2)   NOT NULL DEFAULT 0,      -- extra pickup distance

    -- ─── Deductions ───────────────────────────────────────────────────────
    discount_amount         DECIMAL(10,2)   NOT NULL DEFAULT 0,      -- coupon/subscription discount
    coupon_code             VARCHAR(30),                              -- agar coupon use kiya
    subscription_discount   DECIMAL(10,2)   NOT NULL DEFAULT 0,      -- subscription benefit

    -- ─── Toll & Tax ──────────────────────────────────────────────────────
    toll_charges            DECIMAL(10,2)   NOT NULL DEFAULT 0,
    tax_amount              DECIMAL(10,2)   NOT NULL DEFAULT 0,      -- GST
    tax_percent             DECIMAL(5,2)    NOT NULL DEFAULT 0,      -- GST % (e.g. 5.00)

    -- ─── Tip ─────────────────────────────────────────────────────────────
    tip_amount              DECIMAL(10,2)   NOT NULL DEFAULT 0,

    -- ─── Totals ──────────────────────────────────────────────────────────
    subtotal                DECIMAL(10,2)   NOT NULL,                -- before tax + tip
    total_amount            DECIMAL(10,2)   NOT NULL,                -- final amount charged
    currency                VARCHAR(5)      NOT NULL DEFAULT 'INR',

    -- ─── Payment Info ────────────────────────────────────────────────────
    payment_method          VARCHAR(50)     CHECK (payment_method IN ('cash', 'card', 'wallet', 'upi')),
    payment_status          VARCHAR(20)     CHECK (payment_status IN ('pending', 'paid', 'refunded')),
    paid_at                 TIMESTAMP,

    -- ─── Ride Snapshot (denormalized — invoice independent rehna chahiye) ─
    vehicle_type            VARCHAR(50)     NOT NULL,
    distance_km             DECIMAL(10,2)   NOT NULL,
    duration_minutes        INTEGER         NOT NULL,
    pickup_address          TEXT            NOT NULL,
    dropoff_address         TEXT            NOT NULL,
    ride_date               TIMESTAMP       NOT NULL,

    created_at              TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
-- Ride se invoice (1:1 mapping)
CREATE INDEX idx_ride_invoices_ride ON ride_invoices(ride_id);

-- Invoice number se lookup (share/download ke liye)
CREATE INDEX idx_ride_invoices_number ON ride_invoices(invoice_number);
