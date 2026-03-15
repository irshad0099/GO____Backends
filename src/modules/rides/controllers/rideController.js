import * as rideService from '../services/rideService.js';
import logger from '../../../core/logger/logger.js';

export const requestRide = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const rideData = req.body;
        
        const result = await rideService.requestRide(userId, rideData);

        res.status(201).json({
            success: true,
            message: 'Ride requested successfully',
            data: result
        });
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

        res.status(200).json({
            success: true,
            data: {
                count: drivers.length,
                drivers
            }
        });
    } catch (error) {
        next(error);
    }
};

export const acceptRide = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { rideId } = req.params;
        
        const result = await rideService.acceptRide(userId, rideId);

        res.status(200).json({
            success: true,
            message: 'Ride accepted successfully',
            data: result
        });
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

        res.status(200).json({
            success: true,
            message: 'Ride status updated successfully',
            data: result
        });
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

        res.status(200).json({
            success: true,
            data: ride
        });
    } catch (error) {
        next(error);
    }
};

export const getPassengerRideHistory = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 10, status } = req.query;
        
        const history = await rideService.getPassengerRideHistory(userId, { page, limit, status });

        res.status(200).json({
            success: true,
            data: history
        });
    } catch (error) {
        next(error);
    }
};

export const getDriverRideHistory = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 10, status } = req.query;
        
        const history = await rideService.getDriverRideHistory(userId, { page, limit, status });

        res.status(200).json({
            success: true,
            data: history
        });
    } catch (error) {
        next(error);
    }
};

export const getCurrentRide = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        
        const ride = await rideService.getCurrentRide(userId, userRole);

        res.status(200).json({
            success: true,
            data: ride
        });
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

        res.status(200).json({
            success: true,
            message: 'Ride rated successfully',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

export const calculateFare = async (req, res, next) => {
    try {
        const { vehicleType, distanceKm, durationMinutes, surgeMultiplier } = req.body;
        
        const fare = await rideService.calculateFare({
            vehicleType,
            distanceKm,
            durationMinutes,
            surgeMultiplier
        });

        res.status(200).json({
            success: true,
            data: fare
        });
    } catch (error) {
        next(error);
    }
};