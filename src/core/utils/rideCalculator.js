import { ENV } from '../../config/envConfig.js';
import {
    getPricingConfig,
    getVehicleConfig,
    getSubscriberRule,
    getDistanceTierMultiplier,
    getSetting,
    normalizeVehicleType,
} from '../../modules/pricing/services/pricingConfigLoader.js';

// ─── Helpers ────────────────────────────────────────────────────────────────
const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const clamp  = (v, min, max) => Math.min(max, Math.max(min, v));
const num    = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
};

// ═════════════════════════════════════════════════════════════════════════════
//  PEAK DETECTION (time / demand / weather)
// ═════════════════════════════════════════════════════════════════════════════
export const isTimePeak = () => {
    const now  = new Date();
    const hour = now.getHours();

    const morningStart = num(getSetting('peak_hours_morning_start'), 8);
    const morningEnd   = num(getSetting('peak_hours_morning_end'),   10);
    const eveningStart = num(getSetting('peak_hours_evening_start'), 18);
    const eveningEnd   = num(getSetting('peak_hours_evening_end'),   21);

    const isMorningPeak = hour >= morningStart && hour < morningEnd;
    const isEveningPeak = hour >= eveningStart && hour < eveningEnd;

    return {
        isTimePeak: isMorningPeak || isEveningPeak,
        timeWindow: isMorningPeak ? 'morning_peak'
                  : isEveningPeak ? 'evening_peak'
                  : 'off_peak',
        currentHour: hour,
    };
};

export const isDemandPeak = ({ rideRequests = 0, availableDrivers = 0, requestVelocity = 0 }) => {
    const safeDrivers       = Math.max(1, num(availableDrivers));
    const requests          = num(rideRequests);
    const demandSupplyRatio = round2(requests / safeDrivers);
    const vel               = num(requestVelocity);

    const minVolume      = num(getSetting('min_demand_requests'),      5);
    const ratioThreshold = num(getSetting('peak_ratio_threshold'),    1.2);
    const velThreshold   = num(getSetting('peak_velocity_threshold'), 18);

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

export const detectPeak = ({ rideRequests = 0, availableDrivers = 0, requestVelocity = 0, weatherSignal = null }) => {
    const time   = isTimePeak();
    const demand = isDemandPeak({ rideRequests, availableDrivers, requestVelocity });

    const isWeatherPeak = weatherSignal?.isWeatherPeak || false;
    const weatherSurge  = num(weatherSignal?.weatherSurge, 1.0);

    const isPeak = time.isTimePeak || demand.isDemandPeak || isWeatherPeak;

    const peakReasons = [];
    if (time.isTimePeak)     peakReasons.push('peak_hour');
    if (demand.isDemandPeak) peakReasons.push('high_demand');
    if (isWeatherPeak)       peakReasons.push('bad_weather');

    return {
        isPeak,
        peakReason:          peakReasons.length ? peakReasons.join('_and_') : 'normal_load',
        isTimePeak:          time.isTimePeak,
        timeWindow:          time.timeWindow,
        currentHour:         time.currentHour,
        isDemandPeak:        demand.isDemandPeak,
        demandReason:        demand.demandReason,
        demandSupplyRatio:   demand.demandSupplyRatio,
        requestVelocity:     demand.requestVelocity,
        hasSufficientVolume: demand.hasSufficientVolume,
        isWeatherPeak,
        weatherCondition:    weatherSignal?.weatherCondition || 'unknown',
        weatherSeverity:     weatherSignal?.severity || 'none',
        weatherSurge,
    };
};

// ═════════════════════════════════════════════════════════════════════════════
//  SURGE MULTIPLIER
// ═════════════════════════════════════════════════════════════════════════════
export const calculateSurgeByDemandSupply = (demandSupplyRatio) => {
    const ratio    = num(demandSupplyRatio, 0);
    const surgeCap = num(getSetting('surge_max_multiplier'), 1.75);

    if (ratio <= 1.1) return 1.0;

    if (ratio <= 1.3) {
        const factor = (ratio - 1.1) / 0.2;
        return round2(1.1 + (0.1 * factor));
    }

    const progressive = 1.2 + ((ratio - 1.3) * 0.4);
    return round2(clamp(progressive, 1.2, surgeCap));
};

// ═════════════════════════════════════════════════════════════════════════════
//  CONVENIENCE FEE — tiered + subscriber-aware (PRD Section 3.3 & 8)
//
//  1. tierMult = distance band multiplier (0.75 / 1.0 / 1.2 / 1.4)
//  2. standardFee = baseFee(peak|off-peak) * tierMult
//  3. Subscriber: free <= freeKm, then discount% off standardFee
//  4. Non-subscriber: standardFee
// ═════════════════════════════════════════════════════════════════════════════
export const calculateConvenienceFee = ({
    vehicleType,
    distanceKm = 0,
    isPeak     = false,
    subscriberTier = 'none',
    isSubscribed   = false,
}) => {
    const v    = getVehicleConfig(vehicleType);
    const tier = getDistanceTierMultiplier(distanceKm);
    const base = isPeak ? v.conveniencePeak : v.convenienceOffPeak;

    const standardFee = round2(base * tier.multiplier);

    let convenienceFee = standardFee;
    let freeZoneApplied = false;
    let subscriberDiscount = 0;

    if (isSubscribed) {
        const rule = getSubscriberRule(subscriberTier);
        if (distanceKm <= rule.freeKm) {
            convenienceFee  = 0;
            freeZoneApplied = true;
        } else {
            const discountPct = rule.discountPctBeyond / 100;
            subscriberDiscount = round2(standardFee * discountPct);
            convenienceFee     = round2(standardFee - subscriberDiscount);
        }
    }

    return {
        convenienceFee,
        standardFee,
        tierName:           tier.name,
        tierMultiplier:     tier.multiplier,
        baseRate:           round2(base),
        isPeak:             Boolean(isPeak),
        freeZoneApplied,
        subscriberDiscount,
    };
};

// ═════════════════════════════════════════════════════════════════════════════
//  CANCELLATION PENALTY
// ═════════════════════════════════════════════════════════════════════════════
export const calculateCancellationPenalty = (cancellationDistanceMeters) => {
    const threshold       = num(getSetting('cancellation_distance_threshold'),  300);
    const penalty         = num(getSetting('cancellation_penalty'),             50);
    const driverPercent   = num(getSetting('cancellation_driver_share_pct'),    80);
    const platformPercent = num(getSetting('cancellation_platform_share_pct'),  20);

    if (num(cancellationDistanceMeters) > threshold) {
        return { isApplicable: false, penalty: 0, driverShare: 0, platformShare: 0, thresholdMeters: threshold };
    }

    return {
        isApplicable:    true,
        penalty,
        driverShare:     round2(penalty * driverPercent / 100),
        platformShare:   round2(penalty * platformPercent / 100),
        thresholdMeters: threshold,
    };
};

// ═════════════════════════════════════════════════════════════════════════════
//  WAITING CHARGES — 7 min grace (PRD Section 6)
//  100% to driver. Not multiplied by surge.
// ═════════════════════════════════════════════════════════════════════════════
export const calculateWaitingCharges = (vehicleType, waitedMinutes = 0) => {
    const v = getVehicleConfig(vehicleType);
    const chargeable = Math.max(0, num(waitedMinutes) - v.waitingGraceMinutes);

    return {
        waitingRatePerMin:  v.waitingRatePerMin,
        graceMinutes:       v.waitingGraceMinutes,
        chargeableMinutes:  round2(chargeable),
        waitingCharges:     round2(chargeable * v.waitingRatePerMin),
    };
};

// ═════════════════════════════════════════════════════════════════════════════
//  TRAFFIC DELAY COMPENSATION — 100% to driver
// ═════════════════════════════════════════════════════════════════════════════
export const calculateTrafficDelayCompensation = (vehicleType, estimatedMin = 0, actualMin = 0) => {
    const v            = getVehicleConfig(vehicleType);
    const noChargeUntil = num(estimatedMin) + v.trafficGraceMinutes;
    const overage       = Math.max(0, num(actualMin) - noChargeUntil);

    return {
        graceBufferMinutes:       v.trafficGraceMinutes,
        noChargeUntilMinutes:     noChargeUntil,
        trafficOverageMinutes:    round2(overage),
        trafficDelayRatePerMin:   v.trafficRatePerMin,
        trafficDelayCompensation: round2(overage * v.trafficRatePerMin),
    };
};

// ═════════════════════════════════════════════════════════════════════════════
//  PICKUP DISTANCE COMPENSATION — PRD Section 5
//  100% to driver. Not multiplied by surge. Not in passenger total.
// ═════════════════════════════════════════════════════════════════════════════
export const calculatePickupCompensation = (vehicleType, pickupDistanceKm = 0) => {
    const v        = getVehicleConfig(vehicleType);
    const extraKm  = Math.max(0, num(pickupDistanceKm) - v.pickupFreeKm);

    return {
        baseRadiusKm:       v.pickupFreeKm,
        pickupDistanceKm:   round2(num(pickupDistanceKm)),
        extraPickupKm:      round2(extraKm),
        compensationPerKm:  v.pickupRatePerKm,
        pickupCompensation: round2(extraKm * v.pickupRatePerKm),
    };
};

// ═════════════════════════════════════════════════════════════════════════════
//  PLATFORM FEE — daily cap applies
// ═════════════════════════════════════════════════════════════════════════════
export const calculatePlatformFee = (vehicleType, driverDailyRideCount = 0) => {
    const v       = getVehicleConfig(vehicleType);
    const charged = num(driverDailyRideCount) < v.platformFeeDailyCap;

    return {
        platformFee:     round2(charged ? v.platformFee : 0),
        isCharged:       charged,
        capApplied:      !charged,
        rideCountForDay: num(driverDailyRideCount),
        dailyCapRide:    v.platformFeeDailyCap,
    };
};

// ═════════════════════════════════════════════════════════════════════════════
//  GST — PRD Section 4
// ═════════════════════════════════════════════════════════════════════════════
export const calculateGst = (fareBeforeGst, platformFee) => {
    const { gst } = getPricingConfig();
    if (!gst.enabled) {
        return {
            enabled:            false,
            riderRatePct:       0,
            platformRatePct:    0,
            gstOnFare:          0,
            gstOnPlatformFee:   0,
            passengerTotal:     round2(fareBeforeGst),
            driverPlatformTotal: round2(platformFee),
            riderSacCode:       gst.riderSacCode,
            platformSacCode:    gst.platformSacCode,
        };
    }

    const gstOnFare         = round2(num(fareBeforeGst) * gst.riderRatePct / 100);
    const gstOnPlatformFee  = round2(num(platformFee)   * gst.platformRatePct / 100);

    return {
        enabled:             true,
        riderRatePct:        gst.riderRatePct,
        platformRatePct:     gst.platformRatePct,
        gstOnFare,
        gstOnPlatformFee,
        passengerTotal:      round2(num(fareBeforeGst) + gstOnFare),
        driverPlatformTotal: round2(num(platformFee) + gstOnPlatformFee),
        riderSacCode:        gst.riderSacCode,
        platformSacCode:     gst.platformSacCode,
    };
};

// ═════════════════════════════════════════════════════════════════════════════
//  CORE FARE BUILDER — shared by estimate + final
//
//  Formula (PRD Section 8):
//    preSurge   = baseFare + distanceFare + waitingCharges       (no convFee here)
//    surged     = preSurge * surgeMultiplier
//    fareFloor  = max(surged, minimumFare)                        (Edge 10.3)
//    fareB4Gst  = fareFloor + convenienceFee                      (convFee post-floor)
//    passengerTotal = fareB4Gst + gstOnFare
//    driverNet  = fareFloor - (platformFee + gstOnPlatform)
//               + pickupComp + waitingCharges + trafficComp
// ═════════════════════════════════════════════════════════════════════════════
const buildFare = ({
    vehicleType,
    distanceKm,
    surgeMultiplier,
    convenienceFeeInput,
    waitingCharges,
    pickupCompensation,
    trafficDelayCompensation,
    platformFee,
}) => {
    const v = getVehicleConfig(vehicleType);

    const distanceFare      = round2(num(distanceKm) * v.perKmRate);
    const preSurge          = round2(v.baseFare + distanceFare + num(waitingCharges));
    const surgedFare        = round2(preSurge * num(surgeMultiplier, 1));
    const fareFloor         = round2(Math.max(surgedFare, v.minimumFare));
    const fareBeforeGst     = round2(fareFloor + num(convenienceFeeInput));

    const gst = calculateGst(fareBeforeGst, platformFee);

    // Driver net — Bug 2 fix: subtract convenience fee (GO's revenue, not driver's)
    const driverNet = round2(
        fareFloor
        - num(platformFee)
        - gst.gstOnPlatformFee
        + num(pickupCompensation)
        + num(waitingCharges)
        + num(trafficDelayCompensation)
    );

    return {
        baseFare:       round2(v.baseFare),
        perKmRate:      round2(v.perKmRate),
        distanceFare,
        minimumFare:    round2(v.minimumFare),
        preSurgeSubtotal: preSurge,
        surgedFare,
        fareFloor,
        convenienceFee: round2(num(convenienceFeeInput)),
        fareBeforeGst,
        gst,
        passengerTotal: gst.passengerTotal,
        driverNet,
    };
};

// ═════════════════════════════════════════════════════════════════════════════
//  ESTIMATED FARE — called at ride request / calculate-fare API
// ═════════════════════════════════════════════════════════════════════════════
export const calculateEstimatedFare = ({
    vehicleType,
    distanceKm              = 0,
    estimatedDurationMinutes = 0,
    pickupDistanceKm        = 0,
    driverDailyRideCount    = 0,
    rideRequests            = 0,
    availableDrivers        = 0,
    requestVelocity         = 0,
    weatherSignal           = null,
    subscriberTier          = 'none',
    isSubscribed            = false,
}) => {
    const v          = getVehicleConfig(vehicleType);
    const peakSignal = detectPeak({ rideRequests, availableDrivers, requestVelocity, weatherSignal });

    const demandSurge  = peakSignal.hasSufficientVolume
        ? calculateSurgeByDemandSupply(peakSignal.demandSupplyRatio)
        : 1.0;
    const weatherSurge = peakSignal.weatherSurge || 1.0;

    // Surge cap — subscriber tier overrides global cap
    const subRule  = getSubscriberRule(isSubscribed ? subscriberTier : 'none');
    const surgeCap = subRule.surgeCap;
    const surgeMultiplier = clamp(Math.max(demandSurge, weatherSurge), 1, surgeCap);

    const conv     = calculateConvenienceFee({
        vehicleType, distanceKm, isPeak: peakSignal.isPeak, subscriberTier, isSubscribed,
    });
    const pickup   = calculatePickupCompensation(vehicleType, pickupDistanceKm);
    const platform = calculatePlatformFee(vehicleType, driverDailyRideCount);

    const fare = buildFare({
        vehicleType,
        distanceKm,
        surgeMultiplier,
        convenienceFeeInput:      conv.convenienceFee,
        waitingCharges:           0,   // no waiting at estimate time
        pickupCompensation:       pickup.pickupCompensation,
        trafficDelayCompensation: 0,   // no traffic at estimate time
        platformFee:              platform.platformFee,
    });

    return {
        passenger: {
            vehicleType:     normalizeVehicleType(vehicleType),
            baseFare:        fare.baseFare,
            perKmRate:       fare.perKmRate,
            distanceKm:      round2(distanceKm),
            distanceFare:    fare.distanceFare,
            waitingCharges:  0,
            convenienceFee:  fare.convenienceFee,
            surgeMultiplier,
            minimumFare:     fare.minimumFare,
            fareFloor:       fare.fareFloor,
            fareBeforeGst:   fare.fareBeforeGst,
            gstOnFare:       fare.gst.gstOnFare,
            passengerTotal:  fare.passengerTotal,
            estimatedFare:   fare.passengerTotal,    // alias
            isPeak:          peakSignal.isPeak,
            peakReason:      peakSignal.peakReason,
            tierName:        conv.tierName,
            freeZoneApplied: conv.freeZoneApplied,
        },
        driver: {
            grossFare:                  fare.fareFloor,
            platformFee:                platform.platformFee,
            gstOnPlatformFee:           fare.gst.gstOnPlatformFee,
            platformFeeCharged:         platform.isCharged,
            pickupDistanceCompensation: pickup.pickupCompensation,
            waitingEarnings:            0,
            trafficDelayCompensation:   0,
            netEarnings:                fare.driverNet,
            dailyRideCount:             platform.rideCountForDay,
            platformFeeCapRide:         platform.dailyCapRide,
        },
        signals: {
            demandSupplyRatio:   peakSignal.demandSupplyRatio,
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
            weatherSeverity:     peakSignal.weatherSeverity,
        },
        gst: fare.gst,
        meta: {
            estimatedDurationMinutes: Math.round(num(estimatedDurationMinutes)),
            convenience: conv,
            pickup,
            platform,
        },
    };
};

// ═════════════════════════════════════════════════════════════════════════════
//  FINAL FARE — called when ride completes
//  Reads locked values from ride record (snapshot at request time).
// ═════════════════════════════════════════════════════════════════════════════
export const calculateFinalRideFare = ({
    vehicleType,
    distanceKm                = 0,
    estimatedDurationMinutes  = 0,
    actualDurationMinutes     = 0,
    waitedMinutes             = 0,
    surgeMultiplier           = 1,
    pickupDistanceKm          = 0,
    driverDailyRideCount      = 0,
    lockedConvenienceFee      = null,
    lockedIsPeak              = null,
    lockedSubscriberTier      = 'none',
    lockedIsSubscribed        = false,
    lockedSurgeCap            = null,
}) => {
    const surgeCapResolved = lockedSurgeCap != null
        ? num(lockedSurgeCap, 1.75)
        : getSubscriberRule(lockedIsSubscribed ? lockedSubscriberTier : 'none').surgeCap;
    const lockedSurge = clamp(num(surgeMultiplier, 1), 1, surgeCapResolved);

    const wasPeak = lockedIsPeak !== null ? Boolean(lockedIsPeak) : lockedSurge > 1;

    const conv = lockedConvenienceFee !== null
        ? { convenienceFee: round2(num(lockedConvenienceFee)), tierName: 'locked', tierMultiplier: null, baseRate: null, isPeak: wasPeak, freeZoneApplied: false, subscriberDiscount: 0, standardFee: null }
        : calculateConvenienceFee({
            vehicleType, distanceKm, isPeak: wasPeak,
            subscriberTier: lockedSubscriberTier, isSubscribed: lockedIsSubscribed,
        });

    const waiting  = calculateWaitingCharges(vehicleType, waitedMinutes);
    const traffic  = calculateTrafficDelayCompensation(vehicleType, estimatedDurationMinutes, actualDurationMinutes);
    const pickup   = calculatePickupCompensation(vehicleType, pickupDistanceKm);
    const platform = calculatePlatformFee(vehicleType, driverDailyRideCount);

    const fare = buildFare({
        vehicleType,
        distanceKm,
        surgeMultiplier:          lockedSurge,
        convenienceFeeInput:      conv.convenienceFee,
        waitingCharges:           waiting.waitingCharges,
        pickupCompensation:       pickup.pickupCompensation,
        trafficDelayCompensation: traffic.trafficDelayCompensation,
        platformFee:              platform.platformFee,
    });

    return {
        passenger: {
            vehicleType:     normalizeVehicleType(vehicleType),
            baseFare:        fare.baseFare,
            perKmRate:       fare.perKmRate,
            distanceKm:      round2(distanceKm),
            distanceFare:    fare.distanceFare,
            waitingCharges:  waiting.waitingCharges,
            convenienceFee:  fare.convenienceFee,
            surgeMultiplier: lockedSurge,
            minimumFare:     fare.minimumFare,
            fareFloor:       fare.fareFloor,
            fareBeforeGst:   fare.fareBeforeGst,
            gstOnFare:       fare.gst.gstOnFare,
            passengerTotal:  fare.passengerTotal,
            finalFare:       fare.passengerTotal,     // alias
            isPeak:          wasPeak,
            tierName:        conv.tierName,
            freeZoneApplied: conv.freeZoneApplied,
        },
        driver: {
            grossFare:                  fare.fareFloor,
            platformFee:                platform.platformFee,
            gstOnPlatformFee:           fare.gst.gstOnPlatformFee,
            platformFeeCharged:         platform.isCharged,
            pickupDistanceCompensation: pickup.pickupCompensation,
            waitingEarnings:            waiting.waitingCharges,
            trafficDelayCompensation:   traffic.trafficDelayCompensation,
            netEarnings:                fare.driverNet,
            dailyRideCount:             platform.rideCountForDay,
            platformFeeCapRide:         platform.dailyCapRide,
        },
        gst: fare.gst,
        meta: {
            actualDurationMinutes:    Math.round(num(actualDurationMinutes)),
            estimatedDurationMinutes: Math.round(num(estimatedDurationMinutes)),
            waitedMinutes:            round2(waitedMinutes),
            convenience: conv,
            waiting,
            traffic,
            pickup,
            platform,
        },
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

// ─── Duration estimate ──────────────────────────────────────────────────────
export const calculateDuration = (distanceKm, vehicleType) => {
    const v = getVehicleConfig(vehicleType);
    return Math.ceil((num(distanceKm) / v.avgSpeedKmph) * 60);
};

// ─── Ride number ────────────────────────────────────────────────────────────
export const generateRideNumber = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random    = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `RIDE-${timestamp}${random}`;
};

// ENV re-exported for back-compat (unused internally now)
export { ENV };
