CREATE TABLE IF NOT EXISTS rides (
    id SERIAL PRIMARY KEY,
    ride_number VARCHAR(50) UNIQUE NOT NULL,
    passenger_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    driver_id INTEGER REFERENCES drivers(id),
    vehicle_type VARCHAR(50) NOT NULL CHECK (vehicle_type IN ('bike', 'auto', 'car')),
    
    -- Pickup location
    pickup_latitude DECIMAL(10, 8) NOT NULL,
    pickup_longitude DECIMAL(11, 8) NOT NULL,
    pickup_address TEXT NOT NULL,
    pickup_location_name VARCHAR(255),
    
    -- Dropoff location
    dropoff_latitude DECIMAL(10, 8) NOT NULL,
    dropoff_longitude DECIMAL(11, 8) NOT NULL,
    dropoff_address TEXT NOT NULL,
    dropoff_location_name VARCHAR(255),
    
    -- Route details
    distance_km DECIMAL(10, 2) NOT NULL,
    duration_minutes INTEGER NOT NULL,
    
    -- Pricing
    base_fare DECIMAL(10, 2) NOT NULL,
    distance_fare DECIMAL(10, 2) NOT NULL,
    time_fare DECIMAL(10, 2) NOT NULL,
    surge_multiplier DECIMAL(3, 2) DEFAULT 1.0,
    estimated_fare DECIMAL(10, 2) NOT NULL,
    actual_fare DECIMAL(10, 2),
    discount_amount DECIMAL(10, 2) DEFAULT 0.0,
    final_fare DECIMAL(10, 2),
    
    -- Status tracking
    status VARCHAR(50) NOT NULL CHECK (status IN (
        'requested', 'driver_assigned', 'driver_arrived', 
        'in_progress', 'completed', 'cancelled', 'expired'
    )) DEFAULT 'requested',
    payment_status VARCHAR(50) CHECK (payment_status IN (
        'pending', 'completed', 'failed', 'refunded'
    )) DEFAULT 'pending',
    payment_method VARCHAR(50) CHECK (payment_method IN (
        'cash', 'card', 'wallet', 'upi'
    )),
    
    -- Timestamps
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    driver_assigned_at TIMESTAMP,
    driver_arrived_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancelled_by VARCHAR(20) CHECK (cancelled_by IN ('passenger', 'driver', 'system')),
    cancellation_reason TEXT,
    
    -- Tracking
    driver_current_latitude DECIMAL(10, 8),
    driver_current_longitude DECIMAL(11, 8),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_rides_passenger_id ON rides(passenger_id);
CREATE INDEX idx_rides_driver_id ON rides(driver_id);
CREATE INDEX idx_rides_status ON rides(status);
CREATE INDEX idx_rides_requested_at ON rides(requested_at);
CREATE INDEX idx_rides_vehicle_type ON rides(vehicle_type);