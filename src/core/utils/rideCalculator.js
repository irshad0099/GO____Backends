import { ENV } from '../../config/envConfig.js';

// ─── Helpers ────────────────────────────────────────────────────────────────
const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const clamp  = (v, min, max) => Math.min(max, Math.max(min, v));
const pickInRange = (min, max, ratio = 0.5) => {
    if (min === max) return min;
    return round2(min + ((max - min) * clamp(ratio, 0, 1)));
};

const VEHICLE_ENV_KEY = { bike: 'BIKE', auto: 'AUTO', car: 'CAR', cab: 'CAR', taxi: 'CAR' };

const normalizeVehicleType = (vehicleType) => {
    const type = String(vehicleType || '').toLowerCase();
    if (type === 'cab' || type === 'taxi') return 'car';
    return type;
};

const envKey = (vehicleType) => {
    const norm = normalizeVehicleType(vehicleType);
    const key = VEHICLE_ENV_KEY[norm];
    if (!key) throw new Error(`Invalid vehicle type: ${vehicleType}`);
    return { norm, key };
};

// ─── Vehicle Pricing (from ENV — Spec Section 8) ───────────────────────────
const getVehiclePricing = (vehicleType) => {
    const { norm, key } = envKey(vehicleType);
    return {
        vehicleType: norm,
        baseFare:    Number(ENV[`${key}_BASE_FARE`])    || 0,
        perKm:       Number(ENV[`${key}_PER_KM`])       || 0,
        minimumFare: Number(ENV[`${key}_MINIMUM_FARE`]) || 0
    };
};

// ─── Time-based Peak Detection ──────────────────────────────────────────────
// Returns true if current server time falls within configured peak windows
export const isTimePeak = () => {
    const now  = new Date();
    const hour = now.getHours();

    const morningStart = Number(ENV.PEAK_HOURS_MORNING_START) || 8;
    const morningEnd   = Number(ENV.PEAK_HOURS_MORNING_END)   || 10;
    const eveningStart = Number(ENV.PEAK_HOURS_EVENING_START) || 18;
    const eveningEnd   = Number(ENV.PEAK_HOURS_EVENING_END)   || 21;

    const isMorningPeak = hour >= morningStart && hour < morningEnd;
    const isEveningPeak = hour >= eveningStart && hour < eveningEnd;

    return {
        isTimePeak: isMorningPeak || isEveningPeak,
        timeWindow: isMorningPeak ? 'morning_peak'
                  : isEveningPeak ? 'evening_peak'
                  : 'off_peak',
        currentHour: hour
    };
};

// ─── Demand-based Peak Detection (with minimum volume guard) ────────────────
// Demand ratio only considered if rideRequests >= MIN_DEMAND_REQUESTS
// This prevents 2 requests / 1 driver = 2.0 from falsely triggering peak
export const isDemandPeak = ({ rideRequests = 0, availableDrivers = 0, requestVelocity = 0 }) => {
    const safeDrivers       = Math.max(1, Number(availableDrivers));
    const requests           = Number(rideRequests) || 0;
    const demandSupplyRatio = round2(requests / safeDrivers);
    const vel               = Number(requestVelocity) || 0;

    const minVolume      = Number(ENV.MIN_DEMAND_REQUESTS)      || 5;
    const ratioThreshold = Number(ENV.PEAK_RATIO_THRESHOLD)     || 1.2;
    const velThreshold   = Number(ENV.PEAK_VELOCITY_THRESHOLD)  || 18;

    // Minimum volume guard — low volume means no demand peak, period
    const hasSufficientVolume = requests >= minVolume;

    const highRatio    = hasSufficientVolume && demandSupplyRatio >= ratioThreshold;
    const highVelocity = hasSufficientVolume && vel >= velThreshold;
    const isDemand     = highRatio || highVelocity;

    let demandReason = 'normal_demand';
    if (highRatio && highVelocity) demandReason = 'high_demand_and_velocity';
    else if (highRatio)            demandReason = 'high_demand_supply_ratio';
    else if (highVelocity)         demandReason = 'high_request_velocity';

    return { isDemandPeak: isDemand, demandReason, demandSupplyRatio, requestVelocity: vel, hasSufficientVolume };
};

// ─── Combined Peak Detection (Time + Demand + Weather) ──────────────────────
// isPeak = TRUE if time-based peak OR demand-based peak OR weather-based peak
// weatherSignal is optional — comes from weatherService.getWeatherSignal()
export const detectPeak = ({ rideRequests = 0, availableDrivers = 0, requestVelocity = 0, weatherSignal = null }) => {
    const time   = isTimePeak();
    const demand = isDemandPeak({ rideRequests, availableDrivers, requestVelocity });

    // Weather signal (plug & play — null/undefined = ignored)
    const isWeatherPeak  = weatherSignal?.isWeatherPeak || false;
    const weatherSurge   = Number(weatherSignal?.weatherSurge) || 1.0;

    const isPeak = time.isTimePeak || demand.isDemandPeak || isWeatherPeak;

    // Peak reason — prioritize combined reasons
    let peakReasons = [];
    if (time.isTimePeak)    peakReasons.push('peak_hour');
    if (demand.isDemandPeak) peakReasons.push('high_demand');
    if (isWeatherPeak)      peakReasons.push('bad_weather');

    const peakReason = peakReasons.length > 0 ? peakReasons.join('_and_') : 'normal_load';

    return {
        isPeak,
        peakReason,
        isTimePeak:            time.isTimePeak,
        timeWindow:            time.timeWindow,
        currentHour:           time.currentHour,
        isDemandPeak:          demand.isDemandPeak,
        demandReason:          demand.demandReason,
        demandSupplyRatio:     demand.demandSupplyRatio,
        requestVelocity:       demand.requestVelocity,
        hasSufficientVolume:   demand.hasSufficientVolume,
        isWeatherPeak,
        weatherCondition:      weatherSignal?.weatherCondition || 'unknown',
        weatherSeverity:       weatherSignal?.severity || 'none',
        weatherSurge
    };
};

// ─── Surge Multiplier (Spec Section 2) ──────────────────────────────────────
export const calculateSurgeByDemandSupply = (demandSupplyRatio) => {
    const ratio    = Number(demandSupplyRatio) || 0;
    const surgeCap = Number(ENV.SURGE_MAX_MULTIPLIER) || 1.75;

    if (ratio <= 1.1) return 1.0;

    if (ratio <= 1.3) {
        const factor = (ratio - 1.1) / 0.2;
        return round2(1.1 + (0.1 * factor));
    }

    const progressive = 1.2 + ((ratio - 1.3) * 0.4);
    return round2(clamp(progressive, 1.2, surgeCap));
};

// ─── Convenience Fee (from ENV — Spec Section 3) ────────────────────────────
export const calculateConvenienceFee = (vehicleType, isPeak, demandSupplyRatio = 1) => {
    const { key } = envKey(vehicleType);
    const band    = isPeak ? 'PEAK' : 'NONPEAK';

    const min = Number(ENV[`CONV_FEE_${key}_${band}_MIN`]) || 0;
    const max = Number(ENV[`CONV_FEE_${key}_${band}_MAX`]) || 0;

    const ratioFactor   = clamp(((Number(demandSupplyRatio) || 1) - 1) / 1.5, 0, 1);
    const convenienceFee = pickInRange(min, max, ratioFactor);

    return { convenienceFee, feeBand: { min, max }, isPeak: Boolean(isPeak) };
};

// ─── Cancellation Penalty (from ENV — Spec Section 4) ───────────────────────
export const calculateCancellationPenalty = (cancellationDistanceMeters) => {
    const threshold      = Number(ENV.CANCELLATION_DISTANCE_THRESHOLD)      || 500;
    const penalty        = Number(ENV.CANCELLATION_PENALTY)                 || 50;
    const driverPercent  = Number(ENV.CANCELLATION_DRIVER_SHARE_PERCENT)    || 80;
    const platformPercent = Number(ENV.CANCELLATION_PLATFORM_SHARE_PERCENT) || 20;

    if (Number(cancellationDistanceMeters) > threshold) {
        return { isApplicable: false, penalty: 0, driverShare: 0, platformShare: 0, thresholdMeters: threshold };
    }

    return {
        isApplicable: true,
        penalty,
        driverShare:   round2(penalty * driverPercent / 100),
        platformShare: round2(penalty * platformPercent / 100),
        thresholdMeters: threshold
    };
};

// ─── Waiting Charges (from ENV — Spec Section 5) ────────────────────────────
export const calculateWaitingCharges = (vehicleType, waitedMinutes = 0) => {
    const { key }          = envKey(vehicleType);
    const graceMinutes     = Number(ENV.WAITING_GRACE_MINUTES)       || 3;
    const ratePerMin       = Number(ENV[`WAITING_RATE_${key}`])      || 0;
    const chargeableMinutes = Math.max(0, Number(waitedMinutes) - graceMinutes);

    return {
        waitingRatePerMin: ratePerMin,
        graceMinutes,
        chargeableMinutes,
        waitingCharges: round2(chargeableMinutes * ratePerMin)
    };
};

// ─── Traffic Delay Compensation (from ENV — Spec Section 6) ─────────────────
export const calculateTrafficDelayCompensation = (vehicleType, estimatedMin = 0, actualMin = 0) => {
    const { key }    = envKey(vehicleType);
    const graceBuffer = Number(ENV.TRAFFIC_GRACE_BUFFER_MINUTES) || 30;
    const ratePerMin  = Number(ENV[`TRAFFIC_RATE_${key}`])       || 0;
    const noChargeUntil = Number(estimatedMin) + graceBuffer;
    const overage       = Math.max(0, Number(actualMin) - noChargeUntil);

    return {
        graceBufferMinutes:       graceBuffer,
        noChargeUntilMinutes:     noChargeUntil,
        trafficOverageMinutes:    overage,
        trafficDelayRatePerMin:   ratePerMin,
        trafficDelayCompensation: round2(overage * ratePerMin)
    };
};

// ─── Pickup Distance Compensation (from ENV — Spec Section 7) ───────────────
export const calculatePickupCompensation = (vehicleType, pickupDistanceKm = 0) => {
    const { key }    = envKey(vehicleType);
    const baseRadius = Number(ENV.PICKUP_BASE_RADIUS_KM)    || 2.5;
    const compPerKm  = Number(ENV[`PICKUP_COMP_${key}`])    || 0;
    const extraKm    = Math.max(0, Number(pickupDistanceKm) - baseRadius);

    return {
        baseRadiusKm:       baseRadius,
        pickupDistanceKm:   round2(pickupDistanceKm),
        extraPickupKm:      round2(extraKm),
        compensationPerKm:  compPerKm,
        pickupCompensation: round2(extraKm * compPerKm)
    };
};

// ─── Platform Fee (from ENV — Spec Section 1) ───────────────────────────────
export const calculatePlatformFee = (vehicleType, driverDailyRideCount = 0) => {
    const { key }  = envKey(vehicleType);
    const dailyCap = Number(ENV.PLATFORM_FEE_DAILY_CAP) || 10;
    const feeRate  = Number(ENV[`PLATFORM_FEE_${key}`]) || 0;
    const charged  = Number(driverDailyRideCount) <= dailyCap;

    return {
        platformFee:    round2(charged ? feeRate : 0),
        isCharged:      charged,
        capApplied:     !charged,
        rideCountForDay: Number(driverDailyRideCount),
        dailyCapRide:   dailyCap
    };
};

// ═════════════════════════════════════════════════════════════════════════════
//  ESTIMATED FARE — called at ride request / calculate-fare API
//  Uses REAL demand signals (from DB) → dynamic surge & peak detection
//  No waiting charges at estimate time (ride hasn't started yet)
// ═════════════════════════════════════════════════════════════════════════════
export const calculateEstimatedFare = ({
    vehicleType,
    distanceKm            = 0,
    estimatedDurationMinutes = 0,
    pickupDistanceKm      = 0,
    driverDailyRideCount  = 0,
    rideRequests          = 0,
    availableDrivers      = 0,
    requestVelocity       = 0,
    weatherSignal         = null
}) => {
    const pricing    = getVehiclePricing(vehicleType);
    const peakSignal = detectPeak({ rideRequests, availableDrivers, requestVelocity, weatherSignal });

    // Demand surge (volume guard: low volume = no demand surge)
    const demandSurge = peakSignal.hasSufficientVolume
        ? calculateSurgeByDemandSupply(peakSignal.demandSupplyRatio)
        : 1.0;

    // Weather surge (independent — rain/storm adds its own multiplier)
    const weatherSurge = peakSignal.weatherSurge || 1.0;

    // Final surge = higher of demand surge or weather surge (not stacked)
    // Example: demand 1.3x + rain 1.1x → use 1.3x (demand wins)
    // Example: demand 1.0x + thunderstorm 1.25x → use 1.25x (weather wins)
    const surgeCap = Number(ENV.SURGE_MAX_MULTIPLIER) || 1.75;
    const surgeMultiplier = clamp(Math.max(demandSurge, weatherSurge), 1, surgeCap);

    // Convenience fee uses COMBINED peak (time OR demand OR weather)
    const convenience = calculateConvenienceFee(pricing.vehicleType, peakSignal.isPeak, peakSignal.demandSupplyRatio);
    const pickup      = calculatePickupCompensation(pricing.vehicleType, pickupDistanceKm);
    const platform    = calculatePlatformFee(pricing.vehicleType, driverDailyRideCount);

    // Spec Section 9:  (BaseFare + DistanceFare + ConvenienceFee) × Surge
    // No waiting at estimate time
    const distanceFare      = round2(Number(distanceKm) * pricing.perKm);
    const preSurgeSubtotal  = round2(pricing.baseFare + distanceFare + convenience.convenienceFee);
    const surgedFare        = round2(preSurgeSubtotal * surgeMultiplier);
    const estimatedFare     = Math.max(Math.round(surgedFare), Math.round(pricing.minimumFare));

    const driverNet = round2(estimatedFare - platform.platformFee + pickup.pickupCompensation);

    return {
        passenger: {
            vehicleType:    pricing.vehicleType,
            baseFare:       round2(pricing.baseFare),
            perKmRate:      round2(pricing.perKm),
            distanceKm:     round2(distanceKm),
            distanceFare,
            waitingCharges: 0,
            convenienceFee: convenience.convenienceFee,
            surgeMultiplier,
            minimumFare:    round2(pricing.minimumFare),
            estimatedFare,
            isPeak:         peakSignal.isPeak,
            peakReason:     peakSignal.peakReason
        },
        driver: {
            grossFare:                  round2(estimatedFare),
            platformFee:                platform.platformFee,
            platformFeeCharged:         platform.isCharged,
            pickupDistanceCompensation: pickup.pickupCompensation,
            waitingEarnings:            0,
            trafficDelayCompensation:   0,
            netEarnings:                driverNet,
            dailyRideCount:             platform.rideCountForDay,
            platformFeeCapRide:         platform.dailyCapRide
        },
        signals: {
            demandSupplyRatio:    peakSignal.demandSupplyRatio,
            requestVelocity:     peakSignal.requestVelocity,
            surgeCap,
            demandSurge,
            weatherSurge,
            appliedSurge:        surgeMultiplier,
            isPeak:              peakSignal.isPeak,
            peakReason:          peakSignal.peakReason,
            isTimePeak:          peakSignal.isTimePeak,
            timeWindow:          peakSignal.timeWindow,
            isDemandPeak:        peakSignal.isDemandPeak,
            demandReason:        peakSignal.demandReason,
            hasSufficientVolume: peakSignal.hasSufficientVolume,
            isWeatherPeak:       peakSignal.isWeatherPeak,
            weatherCondition:    peakSignal.weatherCondition,
            weatherSeverity:     peakSignal.weatherSeverity
        },
        meta: {
            estimatedDurationMinutes: Math.round(Number(estimatedDurationMinutes)),
            convenienceFeeBand: convenience.feeBand,
            pickup,
            platform
        }
    };
};

// ═════════════════════════════════════════════════════════════════════════════
//  FINAL FARE — called when ride completes
//  Surge is LOCKED from request time (not recalculated)
//  Actual waiting + traffic delay calculated from real timestamps
// ═════════════════════════════════════════════════════════════════════════════
export const calculateFinalRideFare = ({
    vehicleType,
    distanceKm               = 0,
    estimatedDurationMinutes = 0,
    actualDurationMinutes    = 0,
    waitedMinutes            = 0,
    surgeMultiplier          = 1,
    pickupDistanceKm         = 0,
    driverDailyRideCount     = 0
}) => {
    const pricing  = getVehiclePricing(vehicleType);
    const surgeCap = Number(ENV.SURGE_MAX_MULTIPLIER) || 1.75;
    const lockedSurge = clamp(Number(surgeMultiplier), 1, surgeCap);

    // Peak was determined at request time — infer from locked surge
    const wasPeak    = lockedSurge > 1;
    const convenience = calculateConvenienceFee(pricing.vehicleType, wasPeak, lockedSurge);
    const waiting     = calculateWaitingCharges(pricing.vehicleType, waitedMinutes);
    const traffic     = calculateTrafficDelayCompensation(pricing.vehicleType, estimatedDurationMinutes, actualDurationMinutes);
    const pickup      = calculatePickupCompensation(pricing.vehicleType, pickupDistanceKm);
    const platform    = calculatePlatformFee(pricing.vehicleType, driverDailyRideCount);

    // Spec Section 9:  (BaseFare + DistanceFare + WaitingCharges + ConvenienceFee) × Surge
    const distanceFare     = round2(Number(distanceKm) * pricing.perKm);
    const preSurgeSubtotal = round2(pricing.baseFare + distanceFare + waiting.waitingCharges + convenience.convenienceFee);
    const surgedFare       = round2(preSurgeSubtotal * lockedSurge);
    const finalFare        = Math.max(Math.round(surgedFare), Math.round(pricing.minimumFare));

    // Driver: FinalFare − PlatformFee + PickupComp + WaitingEarnings + TrafficComp
    const driverNet = round2(
        finalFare
        - platform.platformFee
        + pickup.pickupCompensation
        + waiting.waitingCharges
        + traffic.trafficDelayCompensation
    );

    return {
        passenger: {
            vehicleType:    pricing.vehicleType,
            baseFare:       round2(pricing.baseFare),
            perKmRate:      round2(pricing.perKm),
            distanceKm:     round2(distanceKm),
            distanceFare,
            waitingCharges: waiting.waitingCharges,
            convenienceFee: convenience.convenienceFee,
            surgeMultiplier: lockedSurge,
            minimumFare:    round2(pricing.minimumFare),
            finalFare,
            isPeak:         wasPeak
        },
        driver: {
            grossFare:                  round2(finalFare),
            platformFee:                platform.platformFee,
            platformFeeCharged:         platform.isCharged,
            pickupDistanceCompensation: pickup.pickupCompensation,
            waitingEarnings:            waiting.waitingCharges,
            trafficDelayCompensation:   traffic.trafficDelayCompensation,
            netEarnings:                driverNet,
            dailyRideCount:             platform.rideCountForDay,
            platformFeeCapRide:         platform.dailyCapRide
        },
        meta: {
            actualDurationMinutes: Math.round(Number(actualDurationMinutes)),
            estimatedDurationMinutes: Math.round(Number(estimatedDurationMinutes)),
            waitedMinutes: round2(waitedMinutes),
            convenienceFeeBand: convenience.feeBand,
            waiting,
            traffic,
            pickup,
            platform
        }
    };
};

// ─── Distance — Haversine Formula ───────────────────────────────────────────
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R    = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a    =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
};

// ─── Duration Estimate (speed from ENV) ─────────────────────────────────────
export const calculateDuration = (distanceKm, vehicleType) => {
    const { key }     = envKey(vehicleType);
    const averageSpeed = Number(ENV[`SPEED_${key}`]) || 30;
    return Math.ceil((distanceKm / averageSpeed) * 60);
};

// ─── Ride Number Generator ──────────────────────────────────────────────────
export const generateRideNumber = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random    = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `RIDE-${timestamp}${random}`;
};
