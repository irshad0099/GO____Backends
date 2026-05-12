-- ═══════════════════════════════════════════════════════════════════════════════
-- SEED TEST DATA — Payment & Subscription API Testing
-- Creates: 2 Passengers, 2 Drivers, 2 Rides, Wallets, Subscription Plans
-- ═══════════════════════════════════════════════════════════════════════════════

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ 1. CREATE USERS (Passengers & Drivers)                                       │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Passenger 1: Rahul Sharma
INSERT INTO users (id, phone_number, email, full_name, role, is_verified, is_active, created_at, updated_at)
VALUES 
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '9876543210', 'rahul@test.com', 'Rahul Sharma', 'passenger', true, true, NOW(), NOW())
ON CONFLICT (phone_number, role) DO NOTHING;

-- Passenger 2: Priya Patel
INSERT INTO users (id, phone_number, email, full_name, role, is_verified, is_active, created_at, updated_at)
VALUES 
    ('b2c3d4e5-f6a7-8901-bcde-f12345678901', '9876543211', 'priya@test.com', 'Priya Patel', 'passenger', true, true, NOW(), NOW())
ON CONFLICT (phone_number, role) DO NOTHING;

-- Driver 1: Amit Kumar
INSERT INTO users (id, phone_number, email, full_name, role, is_verified, is_active, created_at, updated_at)
VALUES 
    ('c3d4e5f6-a7b8-9012-cdef-123456789012', '9876543212', 'amit@test.com', 'Amit Kumar', 'driver', true, true, NOW(), NOW())
ON CONFLICT (phone_number, role) DO NOTHING;

-- Driver 2: Sunil Verma
INSERT INTO users (id, phone_number, email, full_name, role, is_verified, is_active, created_at, updated_at)
VALUES 
    ('d4e5f6a7-b8c9-0123-defa-234567890123', '9876543213', 'sunil@test.com', 'Sunil Verma', 'driver', true, true, NOW(), NOW())
ON CONFLICT (phone_number, role) DO NOTHING;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ 2. CREATE DRIVER PROFILES                                                    │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Driver profile for Amit Kumar
INSERT INTO drivers (user_id, is_verified, is_available, is_on_duty, current_latitude, current_longitude, total_rides, rating, total_earnings, created_at, updated_at, verified_at)
VALUES 
    ('c3d4e5f6-a7b8-9012-cdef-123456789012', true, true, true, 19.0760, 72.8777, 150, 4.7, 45000.00, NOW(), NOW(), NOW())
ON CONFLICT (user_id) DO NOTHING;

-- Driver profile for Sunil Verma
INSERT INTO drivers (user_id, is_verified, is_available, is_on_duty, current_latitude, current_longitude, total_rides, rating, total_earnings, created_at, updated_at, verified_at)
VALUES 
    ('d4e5f6a7-b8c9-0123-defa-234567890123', true, true, false, 19.2183, 72.9781, 89, 4.5, 28000.00, NOW(), NOW(), NOW())
ON CONFLICT (user_id) DO NOTHING;

-- Get driver IDs for later use
DO $$
DECLARE
    v_driver1_id INTEGER;
    v_driver2_id INTEGER;
BEGIN
    SELECT id INTO v_driver1_id FROM drivers WHERE user_id = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
    SELECT id INTO v_driver2_id FROM drivers WHERE user_id = 'd4e5f6a7-b8c9-0123-defa-234567890123';

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ 3. CREATE WALLETS                                                            │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Wallet for Rahul (₹500 balance)
INSERT INTO wallets (user_id, balance, total_credited, total_debited, last_transaction_at, created_at, updated_at)
VALUES 
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 500.00, 1000.00, 500.00, NOW(), NOW(), NOW())
ON CONFLICT (user_id) DO NOTHING;

-- Wallet for Priya (₹0 balance - empty wallet)
INSERT INTO wallets (user_id, balance, total_credited, total_debited, last_transaction_at, created_at, updated_at)
VALUES 
    ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 0.00, 0.00, 0.00, NULL, NOW(), NOW())
ON CONFLICT (user_id) DO NOTHING;

-- Wallet for Amit Driver (earnings)
INSERT INTO wallets (user_id, balance, total_credited, total_debited, last_transaction_at, created_at, updated_at)
VALUES 
    ('c3d4e5f6-a7b8-9012-cdef-123456789012', 5000.00, 45000.00, 40000.00, NOW(), NOW(), NOW())
ON CONFLICT (user_id) DO NOTHING;

-- Wallet for Sunil Driver (earnings)
INSERT INTO wallets (user_id, balance, total_credited, total_debited, last_transaction_at, created_at, updated_at)
VALUES 
    ('d4e5f6a7-b8c9-0123-defa-234567890123', 3200.00, 28000.00, 24800.00, NOW(), NOW(), NOW())
ON CONFLICT (user_id) DO NOTHING;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ 4. CREATE RIDES                                                              │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Ride 1: Completed ride (Rahul + Amit) — Ready for payment testing
INSERT INTO rides (
    ride_number, passenger_id, driver_id, vehicle_type,
    pickup_latitude, pickup_longitude, pickup_address, pickup_location_name,
    dropoff_latitude, dropoff_longitude, dropoff_address, dropoff_location_name,
    distance_km, duration_minutes,
    base_fare, distance_fare, time_fare, surge_multiplier, estimated_fare, actual_fare, discount_amount, final_fare,
    status, payment_status, payment_method,
    requested_at, driver_assigned_at, driver_arrived_at, started_at, completed_at,
    driver_current_latitude, driver_current_longitude,
    created_at, updated_at
) VALUES (
    'RD202401010001', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', v_driver1_id, 'car',
    19.0760, 72.8777, 'Andheri West, Mumbai', 'Andheri Station',
    19.2183, 72.9781, 'Powai, Mumbai', 'Phoenix Mall',
    12.5, 35,
    50.00, 187.50, 35.00, 1.0, 272.50, 272.50, 0.00, 272.50,
    'completed', 'pending', 'upi',
    NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 50 minutes', NOW() - INTERVAL '1 hour 40 minutes', 
    NOW() - INTERVAL '1 hour 30 minutes', NOW() - INTERVAL '1 hour',
    19.1500, 72.9300,
    NOW(), NOW()
);

-- Ride 2: Completed ride (Priya + Sunil) — Ready for cash payment testing
INSERT INTO rides (
    ride_number, passenger_id, driver_id, vehicle_type,
    pickup_latitude, pickup_longitude, pickup_address, pickup_location_name,
    dropoff_latitude, dropoff_longitude, dropoff_address, dropoff_location_name,
    distance_km, duration_minutes,
    base_fare, distance_fare, time_fare, surge_multiplier, estimated_fare, actual_fare, discount_amount, final_fare,
    status, payment_status, payment_method,
    requested_at, driver_assigned_at, driver_arrived_at, started_at, completed_at,
    driver_current_latitude, driver_current_longitude,
    created_at, updated_at
) VALUES (
    'RD202401010002', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', v_driver2_id, 'auto',
    19.1136, 72.8691, 'Bandra West, Mumbai', 'Bandra Station',
    19.1996, 72.8426, 'Juhu, Mumbai', 'Juhu Beach',
    8.2, 22,
    30.00, 98.40, 22.00, 1.2, 180.48, 180.48, 0.00, 180.48,
    'completed', 'pending', 'cash',
    NOW() - INTERVAL '3 hours', NOW() - INTERVAL '2 hours 50 minutes', NOW() - INTERVAL '2 hours 40 minutes', 
    NOW() - INTERVAL '2 hours 30 minutes', NOW() - INTERVAL '2 hours',
    19.1500, 72.8500,
    NOW(), NOW()
);

-- Ride 3: In-progress ride (Rahul + Amit) — For testing live ride
INSERT INTO rides (
    ride_number, passenger_id, driver_id, vehicle_type,
    pickup_latitude, pickup_longitude, pickup_address, pickup_location_name,
    dropoff_latitude, dropoff_longitude, dropoff_address, dropoff_location_name,
    distance_km, duration_minutes,
    base_fare, distance_fare, time_fare, surge_multiplier, estimated_fare, actual_fare, discount_amount, final_fare,
    status, payment_status, payment_method,
    requested_at, driver_assigned_at, driver_arrived_at, started_at, completed_at,
    driver_current_latitude, driver_current_longitude,
    created_at, updated_at
) VALUES (
    'RD202401010003', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', v_driver1_id, 'bike',
    19.0760, 72.8777, 'Andheri East, Mumbai', 'Andheri East Station',
    19.1200, 72.9100, 'Vile Parle, Mumbai', 'Domestic Airport',
    5.5, 18,
    20.00, 44.00, 18.00, 1.0, 82.00, NULL, 0.00, NULL,
    'in_progress', 'pending', NULL,
    NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '10 minutes', 
    NOW() - INTERVAL '5 minutes', NULL,
    19.1000, 72.8900,
    NOW(), NOW()
);

-- Ride 4: Requested ride (Priya - no driver yet) — For testing ride request flow
INSERT INTO rides (
    ride_number, passenger_id, driver_id, vehicle_type,
    pickup_latitude, pickup_longitude, pickup_address, pickup_location_name,
    dropoff_latitude, dropoff_longitude, dropoff_address, dropoff_location_name,
    distance_km, duration_minutes,
    base_fare, distance_fare, time_fare, surge_multiplier, estimated_fare, actual_fare, discount_amount, final_fare,
    status, payment_status, payment_method,
    requested_at, driver_assigned_at, driver_arrived_at, started_at, completed_at,
    driver_current_latitude, driver_current_longitude,
    created_at, updated_at
) VALUES (
    'RD202401010004', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', NULL, 'car',
    19.0330, 72.8730, 'Colaba, Mumbai', 'Gateway of India',
    19.0760, 72.8777, 'Andheri, Mumbai', 'Andheri West',
    25.0, 55,
    50.00, 375.00, 55.00, 1.5, 720.00, NULL, 0.00, NULL,
    'requested', 'pending', NULL,
    NOW() - INTERVAL '5 minutes', NULL, NULL, NULL, NULL,
    NULL, NULL,
    NOW(), NOW()
);

END $$;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ 5. CREATE SUBSCRIPTION PLANS (If not exists from migration 011)              │
-- └─────────────────────────────────────────────────────────────────────────────┘

INSERT INTO subscription_plans 
    (name, slug, description, price, duration_days, ride_discount_percent, free_rides_per_month, priority_booking, cancellation_waiver, surge_protection, is_active, created_at, updated_at)
VALUES
    ('Test Basic', 'test-basic', 'Basic plan for testing', 99.00, 30, 5, 0, false, false, false, true, NOW(), NOW()),
    ('Test Premium', 'test-premium', 'Premium plan with all benefits', 299.00, 30, 15, 5, true, true, true, true, NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ 6. CREATE SAMPLE TRANSACTIONS (Wallet History)                               │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Transaction: Rahul's wallet recharge
INSERT INTO transactions (transaction_number, user_id, wallet_id, ride_id, amount, type, category, payment_method, payment_gateway, gateway_transaction_id, status, description, metadata, created_at)
VALUES (
    'TXN202401010001', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 
    (SELECT id FROM wallets WHERE user_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
    NULL, 500.00, 'credit', 'wallet_recharge', 'upi', 'razorpay', 'pay_test_001', 'success', 
    'Wallet recharge via Razorpay', '{"source": "razorpay"}'::jsonb, 
    NOW() - INTERVAL '1 day'
);

-- Transaction: Rahul's ride payment
INSERT INTO transactions (transaction_number, user_id, wallet_id, ride_id, amount, type, category, payment_method, status, description, metadata, created_at)
VALUES (
    'TXN202401010002', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 
    (SELECT id FROM wallets WHERE user_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
    (SELECT id FROM rides WHERE ride_number = 'RD202401010001'),
    150.00, 'debit', 'ride_payment', 'wallet', 'success', 
    'Ride payment - Andheri to Powai', '{"ride_number": "RD202401010001"}'::jsonb, 
    NOW() - INTERVAL '12 hours'
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ SUMMARY                                                                      │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Test Users:
-- ┌─────────────┬──────────────┬─────────────────────┬──────────┐
-- │ Phone       │ Name         │ Role                │ Status   │
-- ├─────────────┼──────────────┼─────────────────────┼──────────┤
-- │ 9876543210  │ Rahul Sharma │ passenger (wallet)  │ Verified │
-- │ 9876543211  │ Priya Patel  │ passenger (no wallet)│ Verified │
-- │ 9876543212  │ Amit Kumar   │ driver (available)  │ Verified │
-- │ 9876543213  │ Sunil Verma  │ driver (off-duty)   │ Verified │
-- └─────────────┴──────────────┴─────────────────────┴──────────┘

-- Test Rides:
-- ┌──────────────────┬───────────┬──────────┬──────────┬───────────────┬──────────┐
-- │ Ride Number      │ Passenger │ Driver   │ Vehicle  │ Status        │ Payment  │
-- ├──────────────────┼───────────┼──────────┼──────────┼───────────────┼──────────┤
-- │ RD202401010001   │ Rahul     │ Amit     │ car      │ completed     │ pending  │
-- │ RD202401010002   │ Priya     │ Sunil    │ auto     │ completed     │ pending  │
-- │ RD202401010003   │ Rahul     │ Amit     │ bike     │ in_progress   │ pending  │
-- │ RD202401010004   │ Priya     │ -        │ car      │ requested     │ pending  │
-- └──────────────────┴───────────┴──────────┴──────────┴───────────────┴──────────┘

-- To run this seed:
-- psql -d your_database -f 044_seed_test_data.sql
