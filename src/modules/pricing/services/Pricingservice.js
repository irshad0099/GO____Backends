import { appConfig } from '../../../config/app.config.js';
import logger from '../../../core/logger/logger.js';
import {
    isPeakHour,
    getConvenienceFee,
    calculateSurgeMultiplier,
    calculateWaitingCharges,
    calculateTrafficCompensation,
    calculatePickupCompensation,
    calculatePlatformFee,
    getCancellationPenalty,
} from '../../pricing/utils/pricingutils.js';

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN FARE ESTIMATE
//  Called when user requests ride — returns price estimate before booking
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} params
 * @param {string} params.vehicleType       - 'bike' | 'auto' | 'cab'
 * @param {number} params.distanceKm        - estimated route distance
 * @param {number} params.estimatedMinutes  - estimated trip duration
 * @param {number} params.rideRequests      - current demand (for surge)
 * @param {number} params.availableDrivers  - current supply (for surge)
 * @param {Date}   [params.rideTime]        - defaults to now
 */
export const estimateFare = ({
    vehicleType,
    distanceKm,
    estimatedMinutes,
    rideRequests      = 1,
    availableDrivers  = 1,
    rideTime          = new Date(),
}) => {
    const vehicle = appConfig.vehicleTypes[vehicleType];
    if (!vehicle) {
        const err = new Error(`Unknown vehicle type: ${vehicleType}`);
        err.statusCode = 400;
        throw err;
    }

    const peak           = isPeakHour(rideTime);
    const surgeMulti     = calculateSurgeMultiplier(rideRequests, availableDrivers);
    const convFee        = getConvenienceFee(vehicleType, peak);

    // Section 9 Formula:
    // Final Fare = (Base Fare + Distance × PerKm + WaitingCharges + ConvFee) × Surge
    const baseFare       = vehicle.baseFare;
    const distanceFare   = parseFloat((distanceKm * vehicle.perKm).toFixed(2));
    const timeFare       = parseFloat((estimatedMinutes * vehicle.perMinute).toFixed(2));

    const fareBeforeSurge = baseFare + distanceFare + timeFare + convFee;
    let   finalFare       = parseFloat((fareBeforeSurge * surgeMulti).toFixed(2));

    // Apply minimum fare
    finalFare = Math.max(finalFare, vehicle.minimumFare);

    logger.info(
        `[Pricing] Estimate | Vehicle: ${vehicleType} | Dist: ${distanceKm}km | ` +
        `Surge: ${surgeMulti}x | Peak: ${peak} | Fare: ₹${finalFare}`
    );

    return {
        success: true,
        data: {
            vehicleType,
            vehicleLabel:     vehicle.label,
            isPeak:           peak,
            breakdown: {
                baseFare,
                distanceFare,
                timeFare,
                convenienceFee:  convFee,
                fareBeforeSurge: parseFloat(fareBeforeSurge.toFixed(2)),
                surgeMultiplier: surgeMulti,
            },
            finalFare,
            minimumFare:      vehicle.minimumFare,
            currency:         'INR',
        },
    };
};

// ─────────────────────────────────────────────────────────────────────────────
//  FINAL FARE CALCULATION
//  Called when ride COMPLETES — uses actual distance, time, waiting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} params
 * @param {string} params.vehicleType
 * @param {number} params.actualDistanceKm
 * @param {number} params.estimatedMinutes    - for traffic grace calc
 * @param {number} params.actualMinutes       - real trip duration
 * @param {number} params.waitingMinutes      - how long driver waited at pickup
 * @param {number} params.pickupDistanceKm    - driver's pickup travel distance
 * @param {number} params.driverDailyRides    - driver's rides today (for platform fee)
 * @param {number} params.rideRequests        - for surge at booking time
 * @param {number} params.availableDrivers
 * @param {Date}   [params.rideTime]
 */
export const calculateFinalFare = ({
    vehicleType,
    actualDistanceKm,
    estimatedMinutes,
    actualMinutes,
    waitingMinutes        = 0,
    pickupDistanceKm      = 0,
    driverDailyRides      = 1,
    rideRequests          = 1,
    availableDrivers      = 1,
    rideTime              = new Date(),
}) => {
    const vehicle = appConfig.vehicleTypes[vehicleType];
    if (!vehicle) {
        const err = new Error(`Unknown vehicle type: ${vehicleType}`);
        err.statusCode = 400;
        throw err;
    }

    const peak           = isPeakHour(rideTime);
    const surgeMulti     = calculateSurgeMultiplier(rideRequests, availableDrivers);
    const convFee        = getConvenienceFee(vehicleType, peak);

    // Core fare components
    const baseFare       = vehicle.baseFare;
    const distanceFare   = parseFloat((actualDistanceKm * vehicle.perKm).toFixed(2));
    const timeFare       = parseFloat((actualMinutes * vehicle.perMinute).toFixed(2));

    // Section 5: Waiting charges (free for first 3 min)
    const waitCharge     = calculateWaitingCharges(vehicleType, waitingMinutes);

    // Section 6: Traffic delay compensation to driver
    const trafficComp    = calculateTrafficCompensation(vehicleType, estimatedMinutes, actualMinutes);

    // Section 9 Formula
    const fareBeforeSurge = baseFare + distanceFare + timeFare + waitCharge + convFee;
    let   riderFare       = parseFloat((fareBeforeSurge * surgeMulti).toFixed(2));
    riderFare             = Math.max(riderFare, vehicle.minimumFare);

    // ── Driver earnings breakdown ───────────────────────────────────────────
    // Section 1: Platform fee deducted from driver
    const platformFee    = calculatePlatformFee(vehicleType, driverDailyRides);

    // Section 7: Extra pickup compensation (added to driver, not billed to rider)
    const pickupComp     = calculatePickupCompensation(vehicleType, pickupDistanceKm);

    // Section 9:
    // Driver Earnings = Final Fare − Platform Fee + Pickup Distance Comp + Waiting Charges
    const driverEarnings = parseFloat(
        (riderFare - platformFee + pickupComp + trafficComp).toFixed(2)
    );

    logger.info(
        `[Pricing] Final | Vehicle: ${vehicleType} | Dist: ${actualDistanceKm}km | ` +
        `Rider: ₹${riderFare} | Driver: ₹${driverEarnings} | Surge: ${surgeMulti}x`
    );

    return {
        success: true,
        data: {
            vehicleType,
            vehicleLabel:     vehicle.label,
            isPeak:           peak,

            // What rider pays
            riderFare: {
                baseFare,
                distanceFare,
                timeFare,
                waitingCharges:    waitCharge,
                convenienceFee:    convFee,
                fareBeforeSurge:   parseFloat(fareBeforeSurge.toFixed(2)),
                surgeMultiplier:   surgeMulti,
                totalFare:         riderFare,
                currency:          'INR',
            },

            // What driver earns
            driverEarnings: {
                rideAmount:            riderFare,
                platformFeeDeducted:   platformFee,
                pickupCompensation:    pickupComp,
                trafficCompensation:   trafficComp,
                totalEarnings:         driverEarnings,
            },

            // Platform revenue
            platformRevenue: {
                convenienceFee:   convFee,
                platformFee,
                totalRevenue:     parseFloat((convFee + platformFee).toFixed(2)),
            },
        },
    };
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET ALL VEHICLE ESTIMATES
//  Returns fare estimate for all 3 vehicle types at once (like Ola home screen)
// ─────────────────────────────────────────────────────────────────────────────

export const getAllVehicleEstimates = ({
    distanceKm,
    estimatedMinutes,
    rideRequests     = 1,
    availableDrivers = 1,
    rideTime         = new Date(),
}) => {
    const vehicleTypes = Object.keys(appConfig.vehicleTypes);

    const estimates = vehicleTypes.map((type) =>
        estimateFare({ vehicleType: type, distanceKm, estimatedMinutes, rideRequests, availableDrivers, rideTime }).data
    );

    return {
        success: true,
        data: {
            estimates,
            distanceKm,
            estimatedMinutes,
            isPeak: isPeakHour(rideTime),
        },
    };
};

// ─────────────────────────────────────────────────────────────────────────────
//  CANCELLATION FEE
//  Section 4: ₹50 penalty if driver within 500m
// ─────────────────────────────────────────────────────────────────────────────

export const getCancellationFee = ({ driverDistanceMeters }) => {
    const result = getCancellationPenalty(driverDistanceMeters);

    return {
        success: true,
        data: {
            driverDistanceMeters,
            penaltyApplied:   result.penalty > 0,
            penalty:          result.penalty,
            driverShare:      result.driverShare,
            platformShare:    result.platformShare,
            reason:           result.penalty > 0
                ? `Driver was within ${appConfig.cancellation.proximityPenaltyMeters}m of pickup`
                : 'No penalty — driver was not close to pickup point',
        },
    };
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET CURRENT SURGE INFO (for frontend display)
// ─────────────────────────────────────────────────────────────────────────────

export const getSurgeInfo = ({ rideRequests, availableDrivers }) => {
    const multiplier = calculateSurgeMultiplier(rideRequests, availableDrivers);
    const ratio      = availableDrivers > 0 ? rideRequests / availableDrivers : 99;

    return {
        success: true,
        data: {
            surgeActive:      multiplier > 1.0,
            surgeMultiplier:  multiplier,
            demandSupplyRatio: parseFloat(ratio.toFixed(2)),
            rideRequests,
            availableDrivers,
            message: multiplier >= appConfig.surge.maxCap
                ? 'High demand — surge pricing active'
                : multiplier > 1.0
                    ? 'Moderate demand — slight surge active'
                    : 'Normal pricing',
        },
    };
};