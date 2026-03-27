import logger from '../../../core/logger/logger.js';
import {
    estimateFare,
    calculateFinalFare,
    getAllVehicleEstimates,
    getCancellationFee,
    getSurgeInfo,
} from '../services/Pricingservice.js';

const handleError = (res, error) => {
    logger.error(`[PricingController] ${error.message}`);
    return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Internal server error',
    });
};

// GET /api/v1/pricing/estimate?vehicle_type=bike&distance_km=5&estimated_minutes=15
export const getFareEstimate = (req, res) => {
    try {
        const { vehicle_type, distance_km, estimated_minutes, ride_requests, available_drivers } = req.query;
        const result = estimateFare({
            vehicleType:       vehicle_type,
            distanceKm:        parseFloat(distance_km),
            estimatedMinutes:  parseFloat(estimated_minutes),
            rideRequests:      parseInt(ride_requests  || 1),
            availableDrivers:  parseInt(available_drivers || 1),
        });
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

// GET /api/v1/pricing/all-estimates?distance_km=5&estimated_minutes=15
export const getAllEstimates = (req, res) => {
    try {
        const { distance_km, estimated_minutes, ride_requests, available_drivers } = req.query;
        const result = getAllVehicleEstimates({
            distanceKm:       parseFloat(distance_km),
            estimatedMinutes: parseFloat(estimated_minutes),
            rideRequests:     parseInt(ride_requests  || 1),
            availableDrivers: parseInt(available_drivers || 1),
        });
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

// POST /api/v1/pricing/final-fare  — called when ride completes
export const getFinalFare = (req, res) => {
    try {
        const {
            vehicle_type, actual_distance_km, estimated_minutes, actual_minutes,
            waiting_minutes, pickup_distance_km, driver_daily_rides,
            ride_requests, available_drivers,
        } = req.body;

        const result = calculateFinalFare({
            vehicleType:       vehicle_type,
            actualDistanceKm:  parseFloat(actual_distance_km),
            estimatedMinutes:  parseFloat(estimated_minutes),
            actualMinutes:     parseFloat(actual_minutes),
            waitingMinutes:    parseFloat(waiting_minutes   || 0),
            pickupDistanceKm:  parseFloat(pickup_distance_km || 0),
            driverDailyRides:  parseInt(driver_daily_rides  || 1),
            rideRequests:      parseInt(ride_requests        || 1),
            availableDrivers:  parseInt(available_drivers    || 1),
        });
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

// POST /api/v1/pricing/cancellation-fee
export const getCancellation = (req, res) => {
    try {
        const result = getCancellationFee({
            driverDistanceMeters: parseFloat(req.body.driver_distance_meters),
        });
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

// GET /api/v1/pricing/surge?ride_requests=20&available_drivers=5
export const getSurge = (req, res) => {
    try {
        const result = getSurgeInfo({
            rideRequests:     parseInt(req.query.ride_requests),
            availableDrivers: parseInt(req.query.available_drivers),
        });
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};