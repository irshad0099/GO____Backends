import logger from '../../../core/logger/logger.js';
import {
    calculateEstimatedFare,
    calculateFinalRideFare,
    calculateCancellationPenalty,
    calculateSurgeByDemandSupply,
    detectPeak,
} from '../../../core/utils/rideCalculator.js';
import {
    getVehicleConfig,
    getPricingConfig,
} from '../services/pricingConfigLoader.js';

// ─────────────────────────────────────────────────────────────────────────────
//  FARE ESTIMATE — called when user requests ride
// ─────────────────────────────────────────────────────────────────────────────
export const estimateFare = ({
    vehicleType,
    distanceKm,
    estimatedMinutes,
    rideRequests     = 1,
    availableDrivers = 1,
    rideTime         = new Date(),
}) => {
    const v = getVehicleConfig(vehicleType);
    if (!v) {
        const err = new Error(`Unknown vehicle type: ${vehicleType}`);
        err.statusCode = 400;
        throw err;
    }

    const result = calculateEstimatedFare({
        vehicleType,
        distanceKm,
        estimatedDurationMinutes: estimatedMinutes,
        rideRequests,
        availableDrivers,
    });

    logger.info(
        `[Pricing] Estimate | Vehicle: ${vehicleType} | Dist: ${distanceKm}km | ` +
        `Surge: ${result.passenger.surgeMultiplier}x | Peak: ${result.passenger.isPeak} | ` +
        `Fare: ₹${result.passenger.passengerTotal}`
    );

    return {
        success: true,
        data: {
            vehicleType,
            vehicleLabel:    v.displayName,
            isPeak:          result.passenger.isPeak,
            breakdown: {
                baseFare:        result.passenger.baseFare,
                distanceFare:    result.passenger.distanceFare,
                convenienceFee:  result.passenger.convenienceFee,
                surgeMultiplier: result.passenger.surgeMultiplier,
            },
            finalFare:    result.passenger.passengerTotal,
            minimumFare:  result.passenger.minimumFare,
            currency:     'INR',
        },
    };
};

// ─────────────────────────────────────────────────────────────────────────────
//  FINAL FARE — called when ride completes
// ─────────────────────────────────────────────────────────────────────────────
export const calculateFinalFare = ({
    vehicleType,
    actualDistanceKm,
    estimatedMinutes,
    actualMinutes,
    waitingMinutes       = 0,
    pickupDistanceKm     = 0,
    driverDailyRides     = 1,
    rideRequests         = 1,
    availableDrivers     = 1,
}) => {
    const v = getVehicleConfig(vehicleType);
    if (!v) {
        const err = new Error(`Unknown vehicle type: ${vehicleType}`);
        err.statusCode = 400;
        throw err;
    }

    const result = calculateFinalRideFare({
        vehicleType,
        distanceKm:               actualDistanceKm,
        estimatedDurationMinutes: estimatedMinutes,
        actualDurationMinutes:    actualMinutes,
        waitingMinutes,
        pickupDistanceKm,
        driverDailyRideCount:     driverDailyRides,
        rideRequests,
        availableDrivers,
    });

    logger.info(
        `[Pricing] Final | Vehicle: ${vehicleType} | Dist: ${actualDistanceKm}km | ` +
        `Rider: ₹${result.passenger.passengerTotal} | Driver: ₹${result.driver.netEarnings} | ` +
        `Surge: ${result.passenger.surgeMultiplier}x`
    );

    return {
        success: true,
        data: {
            vehicleType,
            vehicleLabel: v.displayName,
            isPeak:       result.passenger.isPeak,
            riderFare: {
                baseFare:        result.passenger.baseFare,
                distanceFare:    result.passenger.distanceFare,
                waitingCharges:  result.passenger.waitingCharges,
                convenienceFee:  result.passenger.convenienceFee,
                surgeMultiplier: result.passenger.surgeMultiplier,
                totalFare:       result.passenger.passengerTotal,
                currency:        'INR',
            },
            driverEarnings: {
                rideAmount:          result.driver.grossFare,
                platformFeeDeducted: result.driver.platformFee,
                pickupCompensation:  result.driver.pickupDistanceCompensation,
                trafficCompensation: result.driver.trafficDelayCompensation,
                totalEarnings:       result.driver.netEarnings,
            },
            platformRevenue: {
                convenienceFee: result.passenger.convenienceFee,
                platformFee:    result.driver.platformFee,
                totalRevenue:   result.passenger.convenienceFee + result.driver.platformFee,
            },
        },
    };
};

// ─────────────────────────────────────────────────────────────────────────────
//  ALL VEHICLE ESTIMATES — like Ola home screen
// ─────────────────────────────────────────────────────────────────────────────
export const getAllVehicleEstimates = ({
    distanceKm,
    estimatedMinutes,
    rideRequests     = 1,
    availableDrivers = 1,
    rideTime         = new Date(),
}) => {
    const vehicleTypes = Object.keys(getPricingConfig().vehicles);

    const estimates = vehicleTypes.map((type) =>
        estimateFare({ vehicleType: type, distanceKm, estimatedMinutes, rideRequests, availableDrivers, rideTime }).data
    );

    const peakSignal = detectPeak({ rideRequests, availableDrivers });

    return {
        success: true,
        data: {
            estimates,
            distanceKm,
            estimatedMinutes,
            isPeak: peakSignal.isPeak,
        },
    };
};

// ─────────────────────────────────────────────────────────────────────────────
//  CANCELLATION FEE
// ─────────────────────────────────────────────────────────────────────────────
export const getCancellationFee = ({ driverDistanceMeters }) => {
    const result = calculateCancellationPenalty(driverDistanceMeters);

    return {
        success: true,
        data: {
            driverDistanceMeters,
            penaltyApplied: result.isApplicable,
            penalty:        result.penalty,
            driverShare:    result.driverShare,
            platformShare:  result.platformShare,
            reason: result.isApplicable
                ? `Driver was within ${result.thresholdMeters}m of pickup`
                : 'No penalty — driver was not close to pickup point',
        },
    };
};

// ─────────────────────────────────────────────────────────────────────────────
//  SURGE INFO — for frontend display
// ─────────────────────────────────────────────────────────────────────────────
export const getSurgeInfo = ({ rideRequests, availableDrivers }) => {
    const ratio      = availableDrivers > 0 ? rideRequests / availableDrivers : 99;
    const multiplier = calculateSurgeByDemandSupply(ratio);
    const surgeCap   = Number(getPricingConfig().settings?.surge_max_multiplier) || 1.75;

    return {
        success: true,
        data: {
            surgeActive:       multiplier > 1.0,
            surgeMultiplier:   multiplier,
            demandSupplyRatio: Math.round(ratio * 100) / 100,
            rideRequests,
            availableDrivers,
            message: multiplier >= surgeCap
                ? 'High demand — surge pricing active'
                : multiplier > 1.0
                    ? 'Moderate demand — slight surge active'
                    : 'Normal pricing',
        },
    };
};
