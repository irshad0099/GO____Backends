import appConfig from '../../../config/app.config.js';
// ─── Check if current time is peak hour ──────────────────────────────────────
export const isPeakHour = (date = new Date()) => {
    const hhmm = date.toTimeString().slice(0, 5); // "HH:MM"

    return appConfig.peakHours.some(({ start, end }) => hhmm >= start && hhmm <= end);
};

// ─── Get convenience fee for vehicle type ────────────────────────────────────
export const getConvenienceFee = (vehicleType, peak = false) => {
    const fees = appConfig.convenienceFee[vehicleType];
    if (!fees) return 0;

    if (vehicleType === 'bike') {
        return peak ? fees.peakMax : fees.nonPeak;
    }
    // auto / cab — use mid of range
    return peak
        ? Math.round((fees.peakMin + fees.peakMax) / 2)
        : Math.round((fees.nonPeakMin + fees.nonPeakMax) / 2);
};

// ─── Calculate surge multiplier from demand/supply ratio ─────────────────────
// Section 2: demand_supply_ratio = ride_requests / available_drivers
export const calculateSurgeMultiplier = (rideRequests, availableDrivers) => {
    const { surge } = appConfig;

    if (availableDrivers === 0) return surge.maxCap; // no drivers → max surge

    const ratio = rideRequests / availableDrivers;

    if (ratio <= surge.thresholds.noSurge) {
        return surge.defaultMultiplier; // 1.0 — no surge
    }

    if (ratio <= surge.thresholds.normalSurgeMax) {
        // Linear interpolation between 1.1 and 1.2
        const t = (ratio - surge.thresholds.noSurge) /
                  (surge.thresholds.normalSurgeMax - surge.thresholds.noSurge);
        const multiplier = surge.normalRangeMin + t * (surge.normalRangeMax - surge.normalRangeMin);
        return parseFloat(multiplier.toFixed(2));
    }

    // ratio > 1.3 → gradual increase, hard capped at 1.75
    const excess      = ratio - surge.thresholds.normalSurgeMax;
    const multiplier  = surge.normalRangeMax + excess * 0.25; // gradual ramp
    return parseFloat(Math.min(multiplier, surge.maxCap).toFixed(2));
};

// ─── Calculate waiting charges ────────────────────────────────────────────────
// Section 5: free for first 3 minutes
export const calculateWaitingCharges = (vehicleType, waitMinutes) => {
    const { waitingCharges } = appConfig;
    const billableMinutes = Math.max(0, waitMinutes - waitingCharges.freeWaitingMinutes);
    const ratePerMin      = waitingCharges[vehicleType] || 0;
    return parseFloat((billableMinutes * ratePerMin).toFixed(2));
};

// ─── Calculate traffic delay compensation ────────────────────────────────────
// Section 6: no charge within grace buffer
export const calculateTrafficCompensation = (vehicleType, estimatedMinutes, actualMinutes) => {
    const { trafficDelay } = appConfig;
    const graceCutoff      = estimatedMinutes + trafficDelay.graceBufferMinutes;
    const excessMinutes    = Math.max(0, actualMinutes - graceCutoff);
    const rate             = trafficDelay.compensationPerMinute[vehicleType] || 0;
    return parseFloat((excessMinutes * rate).toFixed(2));
};

// ─── Calculate pickup distance compensation ───────────────────────────────────
// Section 7: extra pay for driver if pickup > 2.5km
export const calculatePickupCompensation = (vehicleType, pickupDistanceKm) => {
    const { pickupCompensation } = appConfig;
    const extraKm = Math.max(0, pickupDistanceKm - pickupCompensation.defaultRadiusKm);
    const rate    = pickupCompensation.extraPerKm[vehicleType] || 0;
    return parseFloat((extraKm * rate).toFixed(2));
};

// ─── Calculate platform fee for driver ───────────────────────────────────────
// Section 1: only first 10 rides per day
export const calculatePlatformFee = (vehicleType, driverDailyRideCount) => {
    const { platformFee } = appConfig;
    if (driverDailyRideCount > platformFee.dailyRideCap) return 0;
    return platformFee.perRide[vehicleType] || 0;
};

// ─── Check cancellation penalty ──────────────────────────────────────────────
// Section 4: ₹50 if driver within 500m
export const getCancellationPenalty = (driverDistanceMeters) => {
    const { cancellation } = appConfig;
    if (driverDistanceMeters <= cancellation.proximityPenaltyMeters) {
        return {
            penalty:         cancellation.proximityPenaltyAmount,
            driverShare:     cancellation.driverShareAmount,
            platformShare:   cancellation.platformShareAmount,
        };
    }
    return {
        penalty:       0,
        driverShare:   0,
        platformShare: 0,
    };
};