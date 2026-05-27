-- 066_add_platform_fee_ledger_type.sql
-- driver_ledger.type CHECK constraint me 'platform_fee' add karo.
-- Pehle constraint isko allow nahi karta tha, isliye platform fee track hi nahi ho raha tha.

ALTER TABLE driver_ledger DROP CONSTRAINT IF EXISTS driver_ledger_type_check;

ALTER TABLE driver_ledger ADD CONSTRAINT driver_ledger_type_check CHECK (type IN (
    'ride_earning', 'tip', 'incentive', 'referral',
    'penalty_deduction', 'cash_deposit', 'withdrawal', 'auto_deduct',
    'platform_fee'
));
