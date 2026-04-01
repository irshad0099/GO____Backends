import * as rejectionRepo from '../repositories/rideRejection.repository.js';
import * as driverRepo from '../repositories/driver.repository.js';
import { NotFoundError, ApiError } from '../../../core/errors/ApiError.js';
import logger from '../../../core/logger/logger.js';

// ─── Reject a ride ──────────────────────────────────────────────────────────
export const rejectRide = async (userId, rideId, reasonCode, reasonText) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);
        if (!driver) throw new NotFoundError('Driver profile');

        const rejection = await rejectionRepo.insertRejection({
            ride_id: rideId,
            driver_id: driver.id,
            reason_code: reasonCode,
            reason_text: reasonText,
            is_auto_reject: false
        });

        return {
            rejectionId: rejection.id,
            rideId: rejection.ride_id,
            reasonCode: rejection.reason_code,
            message: 'Ride rejected successfully'
        };
    } catch (error) {
        logger.error('Reject ride service error:', error);
        throw error;
    }
};

// ─── My rejection history ───────────────────────────────────────────────────
export const getRejectionHistory = async (userId, { limit = 20, offset = 0 }) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);
        if (!driver) throw new NotFoundError('Driver profile');

        const rejections = await rejectionRepo.findRejectionsByDriver(driver.id, { limit, offset });

        return rejections.map(r => ({
            id: r.id,
            rideNumber: r.ride_number,
            pickupAddress: r.pickup_address,
            dropoffAddress: r.dropoff_address,
            vehicleType: r.vehicle_type,
            reasonCode: r.reason_code,
            reasonText: r.reason_text,
            isAutoReject: r.is_auto_reject,
            rejectedAt: r.rejected_at
        }));
    } catch (error) {
        logger.error('Get rejection history service error:', error);
        throw error;
    }
};

// ─── Acceptance stats ───────────────────────────────────────────────────────
export const getAcceptanceStats = async (userId, days = 7) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);
        if (!driver) throw new NotFoundError('Driver profile');

        return await rejectionRepo.getAcceptanceStats(driver.id, days);
    } catch (error) {
        logger.error('Get acceptance stats service error:', error);
        throw error;
    }
};
