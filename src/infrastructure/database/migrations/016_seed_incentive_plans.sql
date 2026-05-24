-- 060_seed_incentive_plans.sql
-- Seed sample incentive plans for testing

INSERT INTO incentive_plans (
    title,
    description,
    type,
    target_value,
    bonus_amount,
    vehicle_type,
    duration_type,
    valid_from,
    valid_until,
    peak_start_hour,
    peak_end_hour,
    is_active,
    created_at,
    updated_at
) VALUES
    -- Ride count based incentive
    (
        '20 Rides Bonus',
        '20 rides pore ₹500 bonus',
        'ride_count',
        20,
        500.00,
        'car',
        'daily',
        NOW(),
        NOW() + INTERVAL '30 days',
        NULL,
        NULL,
        TRUE,
        NOW(),
        NOW()
    ),

    -- Peak hours incentive
    (
        'Peak Hours Boost',
        '9-11 AM mein 10 rides karenge toh ₹300 bonus',
        'peak_rides',
        10,
        300.00,
        'bike',
        'daily',
        NOW(),
        NOW() + INTERVAL '30 days',
        9,
        11,
        TRUE,
        NOW(),
        NOW()
    ),

    -- Earning target
    (
        'Daily Earnings Target',
        '₹2000 kamao, ₹200 bonus pao',
        'earning_target',
        2000,
        200.00,
        NULL,
        'daily',
        NOW(),
        NOW() + INTERVAL '30 days',
        NULL,
        NULL,
        TRUE,
        NOW(),
        NOW()
    ),

    -- Auto incentive
    (
        'Auto Rides 25',
        '25 auto rides = ₹400 bonus',
        'ride_count',
        25,
        400.00,
        'auto',
        'weekly',
        NOW(),
        NOW() + INTERVAL '30 days',
        NULL,
        NULL,
        TRUE,
        NOW(),
        NOW()
    ),

    -- Acceptance rate bonus
    (
        'High Acceptance Rate',
        '95% acceptance rate maintain karoge toh ₹250 bonus',
        'acceptance_rate',
        95,
        250.00,
        NULL,
        'weekly',
        NOW(),
        NOW() + INTERVAL '30 days',
        NULL,
        NULL,
        TRUE,
        NOW(),
        NOW()
    ),

    -- Night shift incentive
    (
        'Night Shift Peak',
        '10 PM - 2 AM mein 8 rides = ₹600 bonus',
        'peak_rides',
        8,
        600.00,
        'car',
        'daily',
        NOW(),
        NOW() + INTERVAL '30 days',
        22,
        23,
        TRUE,
        NOW(),
        NOW()
    )
ON CONFLICT DO NOTHING;
