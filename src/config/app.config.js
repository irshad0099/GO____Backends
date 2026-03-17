// ─────────────────────────────────────────────────────────────────────────────
//  GO Mobility — App Configuration
//  All values sourced from GO Mobility Pricing & Fare Algorithm document
// ─────────────────────────────────────────────────────────────────────────────

export const appConfig = {
    name:    'GO Mobility API',
    version: '1.0.0',

    // ─── 1. Vehicle Types — Base Fare & Per KM (Section 8) ───────────────────
    vehicleTypes: {
        bike: {
            baseFare:         20,
            perKmMin:         7,       // competitive lower bound
            perKmMax:         8,       // competitive upper bound
            perKm:            8,       // default used in fare calc
            perMinute:        1,
            minimumFare:      35,      // updated from doc (was 25)
            label:            'Bike',
        },
        auto: {
            baseFare:         30,
            perKmMin:         10,
            perKmMax:         12,
            perKm:            12,
            perMinute:        1.5,
            minimumFare:      50,      // updated from doc (was 35)
            label:            'Auto',
        },
        cab: {
            baseFare:         50,
            perKmMin:         14,
            perKmMax:         16,
            perKm:            15,
            perMinute:        2,
            minimumFare:      90,      // updated from doc (was 60)
            label:            'Cab / Taxi',
        },
    },

    // ─── 2. Surge Pricing (Section 2) ────────────────────────────────────────
    surge: {
        defaultMultiplier:    1.0,
        normalRangeMin:       1.1,
        normalRangeMax:       1.2,
        maxCap:               1.75,   // hard cap — never exceed this

        // demand_supply_ratio thresholds
        thresholds: {
            noSurge:          1.1,    // ratio <= 1.1  → surge = 1.0
            normalSurgeMax:   1.3,    // ratio 1.1–1.3 → surge = 1.1–1.2
            // ratio > 1.3 → gradual increase capped at 1.75
        },
    },

    // ─── 3. Convenience Fee (Section 3) — charged from RIDER ────────────────
    convenienceFee: {
        bike: {
            nonPeak:          5,
            peakMin:          10,
            peakMax:          12,
        },
        auto: {
            nonPeakMin:       12,
            nonPeakMax:       15,
            peakMin:          20,
            peakMax:          25,
        },
        cab: {
            nonPeakMin:       20,
            nonPeakMax:       25,
            peakMin:          30,
            peakMax:          50,
        },
    },

    // ─── 4. Cancellation Policy (Section 4) ──────────────────────────────────
    cancellation: {
        freeCancellationMinutes:  5,

        // Rider cancels when driver is within 500m of pickup
        proximityPenaltyMeters:   500,
        proximityPenaltyAmount:   50,

        // Split of the ₹50 penalty
        driverShareAmount:        40,   // 80% to driver
        platformShareAmount:      10,   // 20% to platform

        // Driver cancellation penalty (internal)
        driverCancellationPenalty: 20,
    },

    // ─── 5. Waiting Charges (Section 5) — applied AFTER 3 min ───────────────
    waitingCharges: {
        freeWaitingMinutes:  3,   // no charge for first 3 minutes
        bike:                1,   // ₹1 per minute after free window
        auto:                1.5, // ₹1.5 per minute
        cab:                 2,   // ₹2 per minute
    },

    // ─── 6. Traffic Delay Protection (Section 6) ─────────────────────────────
    trafficDelay: {
        graceBufferMinutes:  30,  // estimated_time + 30min grace

        // Minimal compensation if trip exceeds grace buffer
        compensationPerMinute: {
            bike:            0.5,
            auto:            1.0,
            cab:             1.5,
        },
    },

    // ─── 7. Driver Pickup Distance Compensation (Section 7) ──────────────────
    pickupCompensation: {
        defaultRadiusKm:     2.5, // standard search radius
        // Extra pay per km beyond 2.5km
        extraPerKm: {
            bike:            3,
            auto:            5,
            cab:             7,
        },
    },

    // ─── 1. Platform Fee (Section 1) — charged from DRIVER ──────────────────
    platformFee: {
        dailyRideCap:        10,  // fee charged only for first 10 rides/day
        perRide: {
            bike:            1,
            auto:            1.5,
            cab:             5,
        },
    },

    // ─── Peak Hours Definition ────────────────────────────────────────────────
    peakHours: [
        { start: '07:00', end: '10:00', label: 'Morning peak' },
        { start: '17:00', end: '21:00', label: 'Evening peak' },
    ],

    // ─── Pagination Defaults ─────────────────────────────────────────────────
    pagination: {
        defaultLimit:   20,
        maxLimit:       100,
    },
};
