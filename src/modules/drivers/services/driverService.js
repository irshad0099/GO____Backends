import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as driverRepo from '../repositories/driver.repository.js';
import * as rideRepo from '../../rides/repositories/ride.repository.js';
import * as userService from "../../users/services/userService.js"
import * as userRepo from '../../users/repositories/user.repository.js';
import { NotFoundError, ApiError } from '../../../core/errors/ApiError.js';
import logger from '../../../core/logger/logger.js';
import { saveDriverLocation, getDriverLocation } from '../../../core/services/redisService.js';
import { pushPendingRidesToDriver } from '../../rides/services/rideService.js';
import { findCashBalance } from '../repositories/cashCollection.repository.js';
import { ENV } from '../../../config/envConfig.js';

const s3 = new S3Client({
    region: ENV.AWS_REGION,
    credentials: {
        accessKeyId:     ENV.AWS_ACCESS_KEY_ID,
        secretAccessKey: ENV.AWS_SECRET_ACCESS_KEY,
    },
});

const uploadProfilePictureToS3 = async (userId, file) => {
    const ext = file.mimetype.split('/')[1] || 'jpg';
    const key = `drivers/${userId}/profile/${Date.now()}.${ext}`;
    await s3.send(new PutObjectCommand({
        Bucket:      ENV.AWS_BUCKET_NAME,
        Key:         key,
        Body:        file.buffer,
        ContentType: file.mimetype,
    }));
    return `https://${ENV.AWS_BUCKET_NAME}.s3.${ENV.AWS_REGION}.amazonaws.com/${key}`;
};

export const registerDriver = async (userId, driverData) => {
    try {
        const existingDriver = await driverRepo.findDriverByUserId(userId);
        if (existingDriver) {
            return {
                id: existingDriver.id,
                vehicleType: existingDriver.vehicle_type,
                vehicleNumber: existingDriver.vehicle_number,
                vehicleModel: existingDriver.vehicle_model,
                vehicleColor: existingDriver.vehicle_color,
                isVerified: existingDriver.is_verified,
                status: existingDriver.is_verified ? 'verified' : 'pending_verification'
            };
        }

        const driver = await driverRepo.createDriver({ userId });

        return {
            id: driver.id,
            vehicleType: driver.vehicle_type,
            vehicleNumber: driver.vehicle_number,
            vehicleModel: driver.vehicle_model,
            vehicleColor: driver.vehicle_color,
            isVerified: driver.is_verified,
            status: driver.is_verified ? 'verified' : 'pending_verification'
        };
    } catch (error) {
        logger.error('Register driver service error:', error);
        throw error;
    }
};

export const addVehicleDetail = async (userId, vehicleData) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);

        if (!driver) {
            throw new NotFoundError('Driver profile');
        }

        const vehicle = await driverRepo.insertVehicle(driver.id, vehicleData);
        await driverRepo.updateDriver(driver.id, { is_verified: false });

        return vehicle;
    } catch (error) {
        logger.error('Add vehicle detail service error:', error);
        throw error;
    }
};



export const getDriverProfile = async (userId) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);
        if (!driver) throw new NotFoundError('Driver profile');
        
        // ── Redis se live location try karo, fail pe DB fallback ──────────────
        let currentLocation = null;
        try {
            const redisLocation = await getDriverLocation(driver.id);
            if (redisLocation) {
                currentLocation = { latitude: redisLocation.lat, longitude: redisLocation.lng };
            }
        } catch { /* Redis down — DB fallback */ }
        if (!currentLocation && driver.current_latitude && driver.current_longitude) {
            currentLocation = { latitude: driver.current_latitude, longitude: driver.current_longitude };
        }
        
        const userData = await userService.getUserProfile(driver.user_id)
        return {
            id:             driver.id,
            userId:         driver.user_id,
            vehicleType:    driver.vehicle_type,
            vehicleNumber:  driver.vehicle_number,
            vehicleModel:   driver.vehicle_model,
            vehicleColor:   driver.vehicle_color,
            isVerified:     driver.is_verified,
            isAvailable:    driver.is_available,
            isOnDuty:       driver.is_on_duty,
            currentLocation,
            totalRides:     driver.total_rides,
            rating:         parseFloat(driver.rating).toFixed(1),
            totalEarnings:  driver.total_earnings,
            verifiedAt:     driver.verified_at,
            createdAt:      driver.created_at,
            updatedAt:      driver.updated_at,
             phone: userData.phone || "",
            email: userData.email || "",
            fullName: userData.fullName || "",
            profilePicture: userData.profilePicture || "",
            role: userData.role || "",
              isVerified: userData.isVerified || "",
            isActive: userData.isActive || "",
            lastLogin: userData.lastLogin || "",
        };
    } catch (error) {
        logger.error('Get driver profile service error:', error);
        throw error;
    }
};

export const updateDriverProfile = async (userId, updates, file) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);
        if (!driver) throw new NotFoundError('Driver profile');

        // users table — fullName, email, profilePicture
        const userUpdates = {};
        if (updates.fullName       !== undefined) userUpdates.full_name        = updates.fullName;
        if (updates.email          !== undefined) userUpdates.email            = updates.email;
        if (updates.profilePicture !== undefined) userUpdates.profile_picture  = updates.profilePicture;

        // file aayi toh S3 pe upload karke URL save karo
        if (file) {
            userUpdates.profile_picture = await uploadProfilePictureToS3(userId, file);
        }

        // drivers table — city
        const driverUpdates = {};
        if (updates.city !== undefined) driverUpdates.city = updates.city;

        // driver_vehicle table — vehicleModel, vehicleColor
        const vehicleUpdates = {};
        if (updates.vehicleModel !== undefined) vehicleUpdates.vehicle_model = updates.vehicleModel;
        if (updates.vehicleColor !== undefined) vehicleUpdates.vehicle_color = updates.vehicleColor;

        const hasAny =
            Object.keys(userUpdates).length > 0 ||
            Object.keys(driverUpdates).length > 0 ||
            Object.keys(vehicleUpdates).length > 0;

        if (!hasAny) return await getDriverProfile(userId);

        if (Object.keys(userUpdates).length > 0) {
            await userRepo.updateUser(userId, userUpdates);
        }

        if (Object.keys(driverUpdates).length > 0) {
            await driverRepo.updateDriver(driver.id, driverUpdates);
        }

        if (Object.keys(vehicleUpdates).length > 0) {
            await driverRepo.updateVehicleDetail(driver.id, vehicleUpdates);
        }

        return await getDriverProfile(userId);
    } catch (error) {
        logger.error('Update driver profile service error:', error);
        throw error;
    }
};



export const updateDriverLocation = async (userId, latitude, longitude) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);
        if (!driver) throw new NotFoundError('Driver profile');
        if (!driver.is_verified) throw new ApiError(403, 'Driver not verified');

        // ── Redis mein location save karo (2 min expiry — real-time) ──────────
        await saveDriverLocation(driver.id, latitude, longitude).catch(() => {});

        // ── DB mein bhi update karo (permanent record — source of truth) ──────
        const updatedDriver = await driverRepo.updateDriver(driver.id, {
            current_latitude:  latitude,
            current_longitude: longitude
        });

        logger.info(`Driver ${driver.id} location updated: ${latitude}, ${longitude}`);

        return {
            latitude:  updatedDriver.current_latitude,
            longitude: updatedDriver.current_longitude,
            updatedAt: updatedDriver.updated_at,
            cachedInRedis: true
        };
    } catch (error) {
        logger.error('Update driver location service error:', error);
        throw error;
    }
};

export const toggleAvailability = async (userId, isAvailable, latitude, longitude) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);

        if (!driver) {
            throw new NotFoundError('Driver profile');
        }

        if (!driver.is_verified) {
            throw new ApiError(403, 'Driver not verified');
        }

        if (isAvailable && driver.is_on_duty) {
            const activeRide = await rideRepo.findActiveRideByDriver(driver.id);
            if (activeRide) {
                throw new ApiError(400, 'Cannot change availability while on a ride');
            }
        }

        // Cash limit check — online hone se pehle
        if (isAvailable) {
            const cashBalance = await findCashBalance(driver.id);
            if (cashBalance?.is_limit_exceeded) {
                throw new ApiError(403, `Cash limit exceed. First deposit ₹${parseFloat(cashBalance.pending_amount).toFixed(0)}.`);
            }
        }

        const updateData = { is_available: isAvailable };

        // Driver online ho raha hai aur lat/long diya — DB mein location update karo
        if (isAvailable && latitude && longitude) {
            updateData.current_latitude  = latitude;
            updateData.current_longitude = longitude;
            await saveDriverLocation(driver.id, latitude, longitude);
        }

        const updatedDriver = await driverRepo.updateDriver(driver.id, updateData);

        // ── Daily metrics update (online/offline tracking) ──────────────────────
        await driverRepo.updateDailyMetrics(driver.id, isAvailable);

        // Driver online hua — miss hue pending rides push karo (fire & forget)
        if (isAvailable && latitude && longitude && driver.vehicle_type) {
            pushPendingRidesToDriver(driver.id, driver.vehicle_type, latitude, longitude).catch(() => {});
        }

        return {
            isAvailable: updatedDriver.is_available,
            updatedAt:   updatedDriver.updated_at,
            ...(isAvailable && latitude && longitude && {
                location: { latitude: updatedDriver.current_latitude, longitude: updatedDriver.current_longitude }
            })
        };
    } catch (error) {
        logger.error('Toggle availability service error:', error);
        throw error;
    }
};

export const getDriverRideHistory = async (userId, { page = 1, limit = 10, status, period }) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);

        if (!driver) {
            throw new NotFoundError('Driver profile');
        }

        const offset = (page - 1) * limit;

        let dateFrom, dateTo;
        if (period) {
            dateTo = new Date();
            dateFrom = new Date();
            if (period === 'today')         { dateFrom.setHours(0, 0, 0, 0); }
            else if (period === 'week')     { dateFrom.setDate(dateFrom.getDate() - 7); }
            else if (period === 'month')    { dateFrom.setMonth(dateFrom.getMonth() - 1); }
        }

        const rides = await rideRepo.findRidesByDriver(driver.id, {
            status,
            limit,
            offset,
            dateFrom,
            dateTo,
        });

        const total = await rideRepo.countRidesByDriver(driver.id, status, dateFrom, dateTo);

        return {
            rides: rides.map(ride => ({
                id: ride.id,
                rideNumber: ride.ride_number,
                passengerName: ride.passenger_name,
                passengerPhone: ride.passenger_phone,
                vehicleType: ride.vehicle_type,
                pickupAddress: ride.pickup_address,
                dropoffAddress: ride.dropoff_address,
                distanceKm: ride.distance_km,
                durationMinutes: ride.duration_minutes,
                estimatedFare: ride.estimated_fare,
                actualFare: ride.actual_fare,
                status: ride.status,
                paymentStatus: ride.payment_status,
                requestedAt: ride.requested_at,
                startedAt: ride.started_at,
                completedAt: ride.completed_at,
                cancelledAt: ride.cancelled_at,
                cancelledBy: ride.cancelled_by,
                cancellationReason: ride.cancellation_reason
            })),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        };
    } catch (error) {
        logger.error('Get driver ride history service error:', error);
        throw error;
    }
};

export const getDriverEarnings = async (userId, period = 'weekly') => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);

        if (!driver) {
            throw new NotFoundError('Driver profile');
        }

        let startDate;
        const endDate = new Date();

        switch (period) {
            case 'today':
            case 'daily':
                startDate = new Date();
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'weekly':
            case 'week':
                startDate = new Date();
                startDate.setDate(startDate.getDate() - 7);
                break;
            case 'monthly':
            case 'month':
                startDate = new Date();
                startDate.setMonth(startDate.getMonth() - 1);
                break;
            case 'yearly':
                startDate = new Date();
                startDate.setFullYear(startDate.getFullYear() - 1);
                break;
            default:
                startDate = new Date();
                startDate.setDate(startDate.getDate() - 7);
        }

        const earnings = await driverRepo.getDriverEarnings(driver.id, startDate, endDate);

        const daysDiff = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));

        return {
            totalEarnings:     earnings.total,
            ridesCompleted:    earnings.rides,
            totalRides:        earnings.totalRides,
            totalTimeOnline:   earnings.totalTimeOnline,
            platformFeePaid:   earnings.platformFeePaid,
            rideEarnings:      earnings.rideEarnings,
            tipEarnings:       earnings.tipEarnings,
            incentiveEarnings: earnings.incentiveEarnings,
            totalDeductions:   earnings.totalDeductions,
            averagePerRide:    earnings.rides > 0 ? Math.round(earnings.total / earnings.rides) : 0,
            avgRidesPerDay:    Math.round(earnings.rides / daysDiff),
            period,
            startDate,
            endDate,
            breakdown:         earnings.breakdown,
        };
    } catch (error) {
        logger.error('Get driver earnings service error:', error);
        throw error;
    }
};

export const getCurrentRide = async (userId) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);

        if (!driver) {
            throw new NotFoundError('Driver profile');
        }

        const activeRide = await rideRepo.findActiveRideByDriver(driver.id);

        if (!activeRide) {
            return { hasActiveRide: false };
        }

        return {
            hasActiveRide: true,
            ride: {
                id: activeRide.id,
                rideNumber: activeRide.ride_number,
                passengerName: activeRide.passenger_name,
                passengerPhone: activeRide.passenger_phone,
                pickupAddress: activeRide.pickup_address,
                pickupLocation: {
                    latitude: activeRide.pickup_latitude,
                    longitude: activeRide.pickup_longitude
                },
                dropoffAddress: activeRide.dropoff_address,
                dropoffLocation: {
                    latitude: activeRide.dropoff_latitude,
                    longitude: activeRide.dropoff_longitude
                },
                distanceKm: activeRide.distance_km,
                durationMinutes: activeRide.duration_minutes,
                estimatedFare: activeRide.estimated_fare,
                status: activeRide.status,
                requestedAt: activeRide.requested_at,
                driverArrivedAt: activeRide.driver_arrived_at,
                startedAt: activeRide.started_at
            }
        };
    } catch (error) {
        logger.error('Get current ride service error:', error);
        throw error;
    }
};


// ========== NEW SERVICE FUNCTIONS (Scoring & Metrics) ==========

export const getDriverScore = async (userId) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);
        if (!driver) throw new NotFoundError('Driver profile');

        const score = await driverRepo.findDriverScore(driver.id);
        if (!score) {
            return { scoreTotal: 0, tier: 'WATCHLIST', breakdown: {} };
        }

        return {
            scoreTotal: score.score_total,
            tier: score.tier,
            breakdown: {
                rating: score.avg_rating,
                acceptanceRate: score.acceptance_rate,
                completionRate: score.completion_rate,
                ontimeRate: score.ontime_rate,
                cancelRate: score.cancel_rate,
                complaintPenalty: score.complaint_penalty
            }
        };
    } catch (error) {
        logger.error('Get driver score service error:', error);
        throw error;
    }
};

export const getDriverBadge = async (userId) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);
        if (!driver) throw new NotFoundError('Driver profile');

        const score = await driverRepo.findDriverScore(driver.id);
        if (!score) {
            return { tier: 'WATCHLIST', score: 0, rankCity: 0, weeklyPosition: 0, benefitsUnlocked: [] };
        }

        const rankCity = await driverRepo.getDriverCityRank(driver.id, driver.city);
        const weeklyPosition = await driverRepo.getWeeklyPosition(driver.id);
        const benefitsUnlocked = getBenefitsByTier(score.tier);

        return {
            tier: score.tier,
            score: score.score_total,
            rankCity,
            weeklyPosition,
            benefitsUnlocked
        };
    } catch (error) {
        logger.error('Get driver badge service error:', error);
        throw error;
    }
};

function getBenefitsByTier(tier) {
    const benefits = {
        PLATINUM: ['Priority dispatch', '10% commission discount', 'Free insurance', 'Dedicated support'],
        GOLD: ['Priority dispatch', '5% commission discount', 'Free insurance'],
        SILVER: ['Priority dispatch', '2% commission discount'],
        WATCHLIST: ['Standard dispatch']
    };
    return benefits[tier] || benefits.WATCHLIST;
}

export const getDriverDailyMetrics = async (userId, days = 7) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);
        if (!driver) throw new NotFoundError('Driver profile');

        const metrics = await driverRepo.getDriverDailyMetrics(driver.id, days);
        return metrics;
    } catch (error) {
        logger.error('Get driver daily metrics service error:', error);
        throw error;
    }
};
