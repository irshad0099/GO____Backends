// ─────────────────────────────────────────────────────────────────────────────
//  GO Mobility — App Configuration
//  All values sourced from GO Mobility Pricing & Fare Algorithm document
// ─────────────────────────────────────────────────────────────────────────────

const appConfig = {
    name: 'GO Mobility API',
    version: '1.0.0',

    // ─── 1. Vehicle Types — Base Fare & Per KM (Section 8) ───────────────────
    vehicleTypes: {
        bike: {
            baseFare: 20,
            perKmMin: 7,
            perKmMax: 8,
            perKm: 8,
            perMinute: 1,
            minimumFare: 35,
            label: 'Bike',
        },
        auto: {
            baseFare: 30,
            perKmMin: 10,
            perKmMax: 12,
            perKm: 12,
            perMinute: 1.5,
            minimumFare: 50,
            label: 'Auto',
        },
        cab: {
            baseFare: 50,
            perKmMin: 14,
            perKmMax: 16,
            perKm: 15,
            perMinute: 2,
            minimumFare: 90,
            label: 'Cab / Taxi',
        },
    },

    // ─── 2. Surge Pricing (Section 2) ────────────────────────────────────────
    surge: {
        defaultMultiplier: 1.0,
        normalRangeMin: 1.1,
        normalRangeMax: 1.2,
        maxCap: 1.75,

        thresholds: {
            noSurge: 1.1,
            normalSurgeMax: 1.3,
        },
    },

    // ─── 3. Convenience Fee (Section 3) — charged from RIDER ────────────────
    convenienceFee: {
        bike: {
            nonPeak: 5,
            peakMin: 10,
            peakMax: 12,
        },
        auto: {
            nonPeakMin: 12,
            nonPeakMax: 15,
            peakMin: 20,
            peakMax: 25,
        },
        cab: {
            nonPeakMin: 20,
            nonPeakMax: 25,
            peakMin: 30,
            peakMax: 50,
        },
    },

    // ─── 4. Cancellation Policy (Section 4) ──────────────────────────────────
    cancellation: {
        freeCancellationMinutes: 5,
        proximityPenaltyMeters: 500,
        proximityPenaltyAmount: 50,
        driverShareAmount: 40,
        platformShareAmount: 10,
        driverCancellationPenalty: 20,
    },

    // ─── 5. Waiting Charges (Section 5) — applied AFTER 3 min ───────────────
    waitingCharges: {
        freeWaitingMinutes: 3,
        bike: 1,
        auto: 1.5,
        cab: 2,
    },

    // ─── 6. Traffic Delay Protection (Section 6) ─────────────────────────────
    trafficDelay: {
        graceBufferMinutes: 30,
        compensationPerMinute: {
            bike: 0.5,
            auto: 1.0,
            cab: 1.5,
        },
    },

    // ─── 7. Driver Pickup Distance Compensation (Section 7) ──────────────────
    pickupCompensation: {
        defaultRadiusKm: 2.5,
        extraPerKm: {
            bike: 3,
            auto: 5,
            cab: 7,
        },
    },

    // ─── 8. Platform Fee (Section 1) — charged from DRIVER ──────────────────
    platformFee: {
        dailyRideCap: 10,
        perRide: {
            bike: 1,
            auto: 1.5,
            cab: 5,
        },
    },

    // ─── Peak Hours Definition ────────────────────────────────────────────────
    peakHours: [
        { start: '07:00', end: '10:00', label: 'Morning peak' },
        { start: '17:00', end: '21:00', label: 'Evening peak' },
    ],

    // ─── Pagination Defaults ─────────────────────────────────────────────────
    pagination: {
        defaultLimit: 20,
        maxLimit: 100,
    },
};

export default appConfig;