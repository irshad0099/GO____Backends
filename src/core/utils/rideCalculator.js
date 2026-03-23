import {ENV} from '../../config/envConfig.js';

const VEHICLE_KEY_MAP = {
    bike: 'BIKE',
    auto: 'AUTO',
    car: 'CAR',
    cab: 'CAR',
    taxi: 'CAR'
};

const PLATFORM_FEE_PER_RIDE = {
    bike: 1,
    auto: 1.5,
    car: 5
};

const WAITING_RATE_PER_MIN = {
    bike: 1,
    auto: 1.5,
    car: 2
};

const TRAFFIC_WAIT_RATE_PER_MIN = {
    bike: 0.5,
    auto: 1,
    car: 1.5
};

const PICKUP_COMPENSATION_PER_KM = {
    bike: 3,
    auto: 5,
    car: 7
};

const CONVENIENCE_FEE = {
    bike: {
        nonPeak: { min: 5, max: 5 },
        peak: { min: 10, max: 12 }
    },
    auto: {
        nonPeak: { min: 12, max: 15 },
        peak: { min: 20, max: 25 }
    },
    car: {
        nonPeak: { min: 20, max: 25 },
        peak: { min: 30, max: 50 }
    }
};

const BASE_SURGE_MAX = 1.75;
const WAITING_GRACE_MINUTES = 3;
const TRAFFIC_GRACE_BUFFER_MINUTES = 30;
const PICKUP_BASE_RADIUS_KM = 2.5;

const normalizeVehicleType = (vehicleType) => {
    const type = String(vehicleType || '').toLowerCase();
    if (type === 'cab' || type === 'taxi') return 'car';
    return type;
};

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const pickInRange = (min, max, ratio = 0.5) => {
    if (min === max) return min;
    return round2(min + ((max - min) * clamp(ratio, 0, 1)));
};

const getVehiclePricing = (vehicleType) => {
    const normalizedType = normalizeVehicleType(vehicleType);
    const envKey = VEHICLE_KEY_MAP[normalizedType];

    if (!envKey) {
        throw new Error('Invalid vehicle type');
    }

    const fallbackMap = {
        bike: { baseFare: 20, perKm: 8, minimumFare: 35 },
        auto: { baseFare: 30, perKm: 12, minimumFare: 50 },
        car: { baseFare: 50, perKm: 15, minimumFare: 90 }
    };

    const fallback = fallbackMap[normalizedType];

    return {
        vehicleType: normalizedType,
        baseFare: Number(ENV[`${envKey}_BASE_FARE`]) || fallback.baseFare,
        perKm: Number(ENV[`${envKey}_PER_KM`]) || fallback.perKm,
        minimumFare: Number(ENV[`${envKey}_MINIMUM_FARE`]) || fallback.minimumFare
    };
};

export const calculateDynamicPeakSignal = ({ rideRequests = 0, availableDrivers = 0, requestVelocity = 0 }) => {
    const safeAvailableDrivers = Math.max(1, Number(availableDrivers) || 0);
    const demandSupplyRatio = round2((Number(rideRequests) || 0) / safeAvailableDrivers);

    const peakRatioThreshold = Number(ENV.PEAK_RATIO_THRESHOLD) || 1.2;
    const peakVelocityThreshold = Number(ENV.PEAK_REQUEST_VELOCITY_THRESHOLD) || 18;

    const isPeak = demandSupplyRatio >= peakRatioThreshold || Number(requestVelocity) >= peakVelocityThreshold;

    let peakReason = 'normal_load';
    if (isPeak && demandSupplyRatio >= peakRatioThreshold && Number(requestVelocity) >= peakVelocityThreshold) {
        peakReason = 'high_demand_and_velocity';
    } else if (isPeak && demandSupplyRatio >= peakRatioThreshold) {
        peakReason = 'high_demand_supply_ratio';
    } else if (isPeak) {
        peakReason = 'high_request_velocity';
    }

    return {
        isPeak,
        peakReason,
        demandSupplyRatio,
        requestVelocity: Number(requestVelocity) || 0,
        thresholds: {
            peakRatioThreshold,
            peakVelocityThreshold
        }
    };
};

export const calculateRideFare = (vehicleType, distanceKm, durationMinutes, surgeMultiplier = 1.0) => {
    const pricing = getVehiclePricing(vehicleType);
    const distanceFare = Number(distanceKm || 0) * pricing.perKm;
    const preSurgeTotal = pricing.baseFare + distanceFare;
    const appliedSurge = clamp(Number(surgeMultiplier) || 1, 1, BASE_SURGE_MAX);

    let totalFare = preSurgeTotal * appliedSurge;
    totalFare = Math.max(totalFare, pricing.minimumFare);

    return {
        baseFare: round2(pricing.baseFare),
        distanceFare: round2(distanceFare),
        timeFare: Math.round(Number(durationMinutes || 0)),
        surgeMultiplier: appliedSurge,
        estimatedFare: Math.round(totalFare)
    };
};

export const calculateSurgeByDemandSupply = (demandSupplyRatio) => {
    const ratio = Number(demandSupplyRatio) || 0;

    if (ratio <= 1.1) {
        return 1.0;
    }

    if (ratio <= 1.3) {
        const linearFactor = (ratio - 1.1) / 0.2;
        return round2(1.1 + (0.1 * linearFactor));
    }

    const progressive = 1.2 + ((ratio - 1.3) * 0.4);
    return round2(clamp(progressive, 1.2, BASE_SURGE_MAX));
};

export const calculatePlatformFee = (vehicleType, driverDailyRideCount = 0) => {
    const normalizedType = normalizeVehicleType(vehicleType);
    const charged = Number(driverDailyRideCount) <= 10;
    const fee = charged ? (PLATFORM_FEE_PER_RIDE[normalizedType] || 0) : 0;

    return {
        platformFee: round2(fee),
        isCharged: charged,
        capApplied: !charged,
        rideCountForDay: Number(driverDailyRideCount) || 0,
        dailyCapRide: 10
    };
};

export const calculateConvenienceFee = (vehicleType, isPeak, demandSupplyRatio = 1) => {
    const normalizedType = normalizeVehicleType(vehicleType);
    const feeBand = CONVENIENCE_FEE[normalizedType]?.[isPeak ? 'peak' : 'nonPeak'];

    if (!feeBand) {
        return {
            convenienceFee: 0,
            feeBand: { min: 0, max: 0 },
            isPeak: Boolean(isPeak)
        };
    }

    const ratioFactor = clamp(((Number(demandSupplyRatio) || 1) - 1) / 1.5, 0, 1);
    const convenienceFee = pickInRange(feeBand.min, feeBand.max, ratioFactor);

    return {
        convenienceFee,
        feeBand,
        isPeak: Boolean(isPeak)
    };
};

export const calculateWaitingCharges = (vehicleType, waitedMinutes = 0) => {
    const normalizedType = normalizeVehicleType(vehicleType);
    const chargeableMinutes = Math.max(0, Number(waitedMinutes) - WAITING_GRACE_MINUTES);
    const waitingRatePerMin = WAITING_RATE_PER_MIN[normalizedType] || 0;

    return {
        waitingRatePerMin,
        graceMinutes: WAITING_GRACE_MINUTES,
        chargeableMinutes,
        waitingCharges: round2(chargeableMinutes * waitingRatePerMin)
    };
};

export const calculateTrafficDelayCompensation = (vehicleType, estimatedDurationMinutes = 0, actualDurationMinutes = 0) => {
    const normalizedType = normalizeVehicleType(vehicleType);
    const noChargeUntil = Number(estimatedDurationMinutes || 0) + TRAFFIC_GRACE_BUFFER_MINUTES;
    const trafficOverageMinutes = Math.max(0, Number(actualDurationMinutes || 0) - noChargeUntil);
    const trafficDelayRatePerMin = TRAFFIC_WAIT_RATE_PER_MIN[normalizedType] || 0;

    return {
        graceBufferMinutes: TRAFFIC_GRACE_BUFFER_MINUTES,
        noChargeUntilMinutes: noChargeUntil,
        trafficOverageMinutes,
        trafficDelayRatePerMin,
        trafficDelayCompensation: round2(trafficOverageMinutes * trafficDelayRatePerMin)
    };
};

export const calculatePickupCompensation = (vehicleType, pickupDistanceKm = 0) => {
    const normalizedType = normalizeVehicleType(vehicleType);
    const extraPickupKm = Math.max(0, Number(pickupDistanceKm) - PICKUP_BASE_RADIUS_KM);
    const compensationPerKm = PICKUP_COMPENSATION_PER_KM[normalizedType] || 0;

    return {
        baseRadiusKm: PICKUP_BASE_RADIUS_KM,
        pickupDistanceKm: round2(pickupDistanceKm),
        extraPickupKm: round2(extraPickupKm),
        compensationPerKm,
        pickupCompensation: round2(extraPickupKm * compensationPerKm)
    };
};

export const calculateCancellationPenalty = (cancellationDistanceMeters) => {
    const applicable = Number(cancellationDistanceMeters) <= 500;

    if (!applicable) {
        return {
            isApplicable: false,
            penalty: 0,
            driverShare: 0,
            platformShare: 0,
            thresholdMeters: 500
        };
    }

    return {
        isApplicable: true,
        penalty: 50,
        driverShare: 40,
        platformShare: 10,
        thresholdMeters: 500
    };
};

export const calculateGoMobilityFare = ({
    vehicleType,
    distanceKm = 0,
    estimatedDurationMinutes = 0,
    actualDurationMinutes = 0,
    waitedMinutes = 0,
    pickupDistanceKm = 0,
    driverDailyRideCount = 0,
    rideRequests = 0,
    availableDrivers = 0,
    requestVelocity = 0
}) => {
    const pricing = getVehiclePricing(vehicleType);
    const peakSignal = calculateDynamicPeakSignal({
        rideRequests,
        availableDrivers,
        requestVelocity
    });

    const surgeMultiplier = calculateSurgeByDemandSupply(peakSignal.demandSupplyRatio);
    const convenience = calculateConvenienceFee(pricing.vehicleType, peakSignal.isPeak, peakSignal.demandSupplyRatio);
    const waiting = calculateWaitingCharges(pricing.vehicleType, waitedMinutes);
    const traffic = calculateTrafficDelayCompensation(pricing.vehicleType, estimatedDurationMinutes, actualDurationMinutes);
    const pickup = calculatePickupCompensation(pricing.vehicleType, pickupDistanceKm);
    const platform = calculatePlatformFee(pricing.vehicleType, driverDailyRideCount);

    const distanceFare = round2(Number(distanceKm || 0) * pricing.perKm);
    const preSurgeSubtotal = round2(pricing.baseFare + distanceFare + waiting.waitingCharges + convenience.convenienceFee);
    const surgedFare = round2(preSurgeSubtotal * surgeMultiplier);
    const finalFare = Math.max(Math.round(surgedFare), Math.round(pricing.minimumFare));

    const driverEarnings = round2(
        finalFare
        - platform.platformFee
        + pickup.pickupCompensation
        + waiting.waitingCharges
        + traffic.trafficDelayCompensation
    );

    return {
        passenger: {
            vehicleType: pricing.vehicleType,
            baseFare: round2(pricing.baseFare),
            perKmRate: round2(pricing.perKm),
            distanceKm: round2(distanceKm),
            distanceFare,
            waitingCharges: waiting.waitingCharges,
            convenienceFee: convenience.convenienceFee,
            surgeMultiplier,
            minimumFare: round2(pricing.minimumFare),
            estimatedFare: finalFare,
            isPeak: peakSignal.isPeak,
            peakReason: peakSignal.peakReason
        },
        driver: {
            grossFare: round2(finalFare),
            platformFee: platform.platformFee,
            platformFeeCharged: platform.isCharged,
            pickupDistanceCompensation: pickup.pickupCompensation,
            waitingEarnings: waiting.waitingCharges,
            trafficDelayCompensation: traffic.trafficDelayCompensation,
            netEarnings: driverEarnings,
            dailyRideCount: platform.rideCountForDay,
            platformFeeCapRide: platform.dailyCapRide
        },
        signals: {
            demandSupplyRatio: peakSignal.demandSupplyRatio,
            requestVelocity: peakSignal.requestVelocity,
            surgeCap: BASE_SURGE_MAX
        },
        meta: {
            convenienceFeeBand: convenience.feeBand,
            waiting,
            traffic,
            pickup,
            platform
        }
    };
};

export const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return Math.round(distance * 10) / 10; // Round to 1 decimal
};

export const calculateDuration = (distanceKm, vehicleType) => {
    let averageSpeed;
    
    switch (vehicleType) {
        case 'bike':
            averageSpeed = 30; // km/h
            break;
        case 'auto':
            averageSpeed = 25; // km/h
            break;
        case 'car':
            averageSpeed = 35; // km/h
            break;
        default:
            averageSpeed = 30;
    }
    
    const durationHours = distanceKm / averageSpeed;
    const durationMinutes = Math.ceil(durationHours * 60);
    
    return durationMinutes;
};

export const generateRideNumber = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `RIDE-${timestamp}${random}`;
};

export const calculateSurgeMultiplier = (nearbyDriversCount, totalRequests) => {
    if (nearbyDriversCount <= 0) return BASE_SURGE_MAX;

    const demandRatio = totalRequests / nearbyDriversCount;
    return calculateSurgeByDemandSupply(demandRatio);
};