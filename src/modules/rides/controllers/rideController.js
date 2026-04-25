import * as rideService from '../services/rideService.js';
import logger from '../../../core/logger/logger.js';
import { sendResponse, sendError } from '../../../core/utils/response.js';

export const requestRide = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const rideData = req.body;

        const result = await rideService.requestRide(userId, rideData);

        sendResponse(res, 201, 'Ride requested successfully', result);
    } catch (error) {
        next(error);
    }
};

export const findNearbyDrivers = async (req, res, next) => {
    try {
        const { vehicleType, latitude, longitude } = req.query;

        const drivers = await rideService.findNearbyDrivers(
            vehicleType,
            parseFloat(latitude),
            parseFloat(longitude)
        );

        sendResponse(res, 200, '', { count: drivers.length, drivers });
    } catch (error) {
        next(error);
    }
};

export const acceptRide = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { rideId } = req.params;

        const result = await rideService.acceptRide(userId, rideId);

        sendResponse(res, 200, 'Ride accepted successfully', result);
    } catch (error) {
        next(error);
    }
};

export const updateRideStatus = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { rideId } = req.params;
        const statusData = req.body;

        const result = await rideService.updateRideStatus(userId, rideId, statusData);

        sendResponse(res, 200, 'Ride status updated successfully', result);
    } catch (error) {
        next(error);
    }
};

export const getRideDetails = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { rideId } = req.params;
        const userRole = req.user.role;

        const ride = await rideService.getRideDetails(userId, rideId, userRole);

        sendResponse(res, 200, '', ride);
    } catch (error) {
        next(error);
    }
};

export const getPassengerRideHistory = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 10, status } = req.query;

        const history = await rideService.getPassengerRideHistory(userId, { page, limit, status });

        sendResponse(res, 200, '', history);
    } catch (error) {
        next(error);
    }
};

export const getDriverRideHistory = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 10, status } = req.query;

        const history = await rideService.getDriverRideHistory(userId, { page, limit, status });

        sendResponse(res, 200, '', history);
    } catch (error) {
        next(error);
    }
};

export const getCurrentRide = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;

        const ride = await rideService.getCurrentRide(userId, userRole);

        sendResponse(res, 200, '', ride);
    } catch (error) {
        next(error);
    }
};

export const rateRide = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { rideId } = req.params;
        const { rating, review } = req.body;

        const result = await rideService.rateRide(userId, rideId, rating, review);

        sendResponse(res, 200, 'Ride rated successfully', result);
    } catch (error) {
        next(error);
    }
};

export const calculateFare = async (req, res, next) => {
    try {
        const { vehicleType, pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude } = req.body;

        if (!vehicleType || !pickupLatitude || !pickupLongitude || !dropoffLatitude || !dropoffLongitude) {
            return sendError(res, 400, 'vehicleType, pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude are required');
        }

        const fare = await rideService.calculateFare({
            vehicleType,
            pickupLatitude: parseFloat(pickupLatitude),
            pickupLongitude: parseFloat(pickupLongitude),
            dropoffLatitude: parseFloat(dropoffLatitude),
            dropoffLongitude: parseFloat(dropoffLongitude)
        });

        sendResponse(res, 200, '', fare);
    } catch (error) {
        next(error);
    }
};
