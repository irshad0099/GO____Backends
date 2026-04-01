import * as destRepo from '../repositories/destinationMode.repository.js';
import * as driverRepo from '../repositories/driver.repository.js';
import { NotFoundError, ApiError } from '../../../core/errors/ApiError.js';
import logger from '../../../core/logger/logger.js';

const MAX_DAILY_USES = 2;
const MODE_DURATION_HOURS = 2;

// ─── Get current destination mode ───────────────────────────────────────────
export const getDestinationMode = async (userId) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);
        if (!driver) throw new NotFoundError('Driver profile');

        const active = await destRepo.findActive(driver.id);

        if (!active) {
            return { isActive: false };
        }

        return {
            isActive: true,
            destination: {
                latitude: parseFloat(active.dest_latitude),
                longitude: parseFloat(active.dest_longitude),
                address: active.dest_address
            },
            radiusKm: parseFloat(active.radius_km),
            expiresAt: active.expires_at
        };
    } catch (error) {
        logger.error('Get destination mode service error:', error);
        throw error;
    }
};

// ─── Set destination mode ───────────────────────────────────────────────────
export const setDestinationMode = async (userId, data) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);
        if (!driver) throw new NotFoundError('Driver profile');

        if (!driver.is_verified) {
            throw new ApiError(403, 'Driver not verified');
        }

        // Check daily usage limit
        const usageCount = await destRepo.getDailyUsageCount(driver.id);
        if (usageCount >= MAX_DAILY_USES) {
            throw new ApiError(400, `Maximum ${MAX_DAILY_USES} destination mode uses per day allowed`);
        }

        // Deactivate existing if any
        const existing = await destRepo.findActive(driver.id);
        if (existing) {
            await destRepo.deactivate(driver.id, 'manual');
        }

        // Set expiry (2 hours from now)
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + MODE_DURATION_HOURS);

        const result = await destRepo.insertDestinationMode({
            driver_id: driver.id,
            dest_latitude: data.latitude,
            dest_longitude: data.longitude,
            dest_address: data.address,
            radius_km: data.radius_km || 3.0,
            expires_at: expiresAt
        });

        return {
            isActive: true,
            destination: {
                latitude: parseFloat(result.dest_latitude),
                longitude: parseFloat(result.dest_longitude),
                address: result.dest_address
            },
            radiusKm: parseFloat(result.radius_km),
            expiresAt: result.expires_at,
            dailyUsesLeft: MAX_DAILY_USES - usageCount - 1
        };
    } catch (error) {
        logger.error('Set destination mode service error:', error);
        throw error;
    }
};

// ─── Turn off destination mode ──────────────────────────────────────────────
export const removeDestinationMode = async (userId) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);
        if (!driver) throw new NotFoundError('Driver profile');

        const result = await destRepo.deactivate(driver.id, 'manual');
        if (!result) {
            return { isActive: false, message: 'No active destination mode found' };
        }

        return { isActive: false, message: 'Destination mode deactivated' };
    } catch (error) {
        logger.error('Remove destination mode service error:', error);
        throw error;
    }
};
