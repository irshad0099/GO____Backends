import * as driverRepo from '../repositories/driver.repository.js';
import * as rideRepo from '../../rides/repositories/ride.repository.js';
import { NotFoundError, ApiError } from '../../../core/errors/ApiError.js';
import logger from '../../../core/logger/logger.js';
import { appConfig } from '../../../config/app.config.js';
import { saveDriverLocation, getDriverLocation } from '../../../core/services/redisService.js';

export const registerDriver = async (userId, driverData) => {
    try {
        // Check if already registered as driver
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

        // Create driver profile
        const driver = await driverRepo.createDriver({
            userId
        });

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

export const addAadharDetail = async (userId, aadhaarData) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);

        if (!driver) {
            throw new NotFoundError('Driver profile');
        }

        const aadhaar = await driverRepo.insertAadhar(driver.id, aadhaarData);
        await driverRepo.updateDriver(driver.id, { is_verified: false });

        return aadhaar;
}   catch (error) {
        
            logger.error('Add Aadhar detail service error:', error);
            throw error;
    }
}


export const addPanDetail = async (userId, panData) => {
        try {
        const driver = await driverRepo.findDriverByUserId(userId);

        if (!driver) {
            throw new NotFoundError('Driver profile');
        }

        const pan = await driverRepo.insertPan(driver.id, panData);
        await driverRepo.updateDriver(driver.id, { is_verified: false });

        return pan;
    } catch (error) {
             logger.error('Add pan detail service error:', error);
        throw error;
        }
};




export const addBankDetail = async (userId, bankData) => {
        try {
    const driver = await driverRepo.findDriverByUserId(userId);

    if (!driver) {
        throw new NotFoundError('Driver profile');
    }

    const bank = await driverRepo.insertBank(driver.id, bankData);
    await driverRepo.updateDriver(driver.id, { is_verified: false });

    return bank;
       } catch (error) {
                logger.error('Add bank detail service error:', error);
        throw error;    
        }
};


export const addLicenseDetail = async (userId, licenseData) => {
    try{
        const driver = await driverRepo.findDriverByUserId(userId);

        if (!driver) {
            throw new NotFoundError('Driver profile');
        }

        const license = await driverRepo.insertLicense(driver.id, licenseData);
        await driverRepo.updateDriver(driver.id, { is_verified: false });

        return license;
} catch (error) {
    logger.error('Add license detail service error:', error);
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


export const verifyDriverDocument = async (userId,{
  driver_id,
  document_type,
  status,
  rejected_reason
}) => {
    try{
  const driver = await driverRepo.findDriverByUserId(userId);

  if (!driver) {
    throw new Error("Driver not found");
  }
  if(driver.id !== parseInt(driver_id)) {
    throw new Error("Unauthorized: Driver ID mismatch");
  }
  const tableMap = {
    aadhaar: "driver_aadhaar",
    pan: "driver_pan",
    bank: "driver_bank",
    license: "driver_license",
    vehicle: "driver_vehicle"
  };

  const tableName = tableMap[document_type];

  if (!tableName) {
    throw new Error("Invalid document type");
  }

  const result = await driverRepo.verifyDriverDocument(
    tableName,
    driver_id,
    status,
    rejected_reason
  );

  if(!result) {
    throw new Error("Document not found or driver not found or update failed");
  }
  // optional: check if all docs verified
  const allDocsVerified = await driverRepo.checkAllDocumentsVerified(driver_id);

  if (allDocsVerified) {
    await driverRepo.markDriverVerified(driver_id);
  }

  return result;
}catch(error){
  logger.error('driver KYC Update service error:', error);
        throw error;
    }
};





export const getDriverDocument = async (userId,driver_id) => {
    try{
  const driver = await driverRepo.findDriverByUserId(userId);

 if (!driver) {
    throw new Error("Driver not found");
  }

    const result = await driverRepo.getDriverDocument(driver_id || driver.id);


  return result;
}catch(error){
  logger.error('driver KYC Update service error:', error);
        throw error;
    }
};

// export const getDriverProfile = async (userId) => {
//     try {
//         const driver = await driverRepo.findDriverByUserId(userId);
        
//         if (!driver) {
//             throw new NotFoundError('Driver profile');
//         }

//         return {
//             id: driver.id,
//             userId: driver.user_id,
//             vehicleType: driver.vehicle_type,
//             vehicleNumber: driver.vehicle_number,
//             vehicleModel: driver.vehicle_model,
//             vehicleColor: driver.vehicle_color,
//             licenseNumber: driver.license_number,
//             licenseExpiry: driver.license_expiry,
//             isVerified: driver.is_verified,
//             isAvailable: driver.is_available,
//             isOnDuty: driver.is_on_duty,
//             currentLocation: driver.current_latitude && driver.current_longitude ? {
//                 latitude: driver.current_latitude,
//                 longitude: driver.current_longitude
//             } : null,
//             totalRides: driver.total_rides,
//             rating: parseFloat(driver.rating).toFixed(1),
//             totalEarnings: driver.total_earnings,
//             verifiedAt: driver.verified_at,
//             createdAt: driver.created_at,
//             updatedAt: driver.updated_at
//         };
//     } catch (error) {
//         logger.error('Get driver profile service error:', error);
//         throw error;
//     }
// };

export const getDriverProfile = async (userId) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);
        if (!driver) throw new NotFoundError('Driver profile');
 
        // ── Redis se live location fetch karo (fast) ──────────────────────────
        let currentLocation = null;
        const redisLocation = await getDriverLocation(driver.id);
        if (redisLocation) {
            currentLocation = { latitude: redisLocation.lat, longitude: redisLocation.lng };
        } else if (driver.current_latitude && driver.current_longitude) {
            currentLocation = { latitude: driver.current_latitude, longitude: driver.current_longitude };
        }
 
        return {
            id:             driver.id,
            userId:         driver.user_id,
            vehicleType:    driver.vehicle_type,
            vehicleNumber:  driver.vehicle_number,
            vehicleModel:   driver.vehicle_model,
            vehicleColor:   driver.vehicle_color,
            licenseNumber:  driver.license_number,
            licenseExpiry:  driver.license_expiry,
            isVerified:     driver.is_verified,
            isAvailable:    driver.is_available,
            isOnDuty:       driver.is_on_duty,
            currentLocation,
            totalRides:     driver.total_rides,
            rating:         parseFloat(driver.rating).toFixed(1),
            totalEarnings:  driver.total_earnings,
            verifiedAt:     driver.verified_at,
            createdAt:      driver.created_at,
            updatedAt:      driver.updated_at
        };
    } catch (error) {
        logger.error('Get driver profile service error:', error);
        throw error;
    }
};

export const updateDriverProfile = async (userId, updates) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);
        
        if (!driver) {
            throw new NotFoundError('Driver profile');
        }

        // Validate allowed updates for unverified drivers
        const allowedUpdates = ['vehicleModel', 'vehicleColor'];
        const filteredUpdates = {};
        
        Object.keys(updates).forEach(key => {
            if (allowedUpdates.includes(key)) {
                filteredUpdates[key] = updates[key];
            }
        });

        if (Object.keys(filteredUpdates).length === 0) {
            return await getDriverProfile(userId);
        }

        const vehicleUpdates = {
            vehicle_model: filteredUpdates.vehicleModel,
            vehicle_color: filteredUpdates.vehicleColor
        };

        const updatedVehicle = await driverRepo.updateVehicleDetail(driver.id, vehicleUpdates);

        if (!updatedVehicle) {
            throw new NotFoundError('Vehicle details');
        }

        return {
            vehicleModel: updatedVehicle.vehicle_model,
            vehicleColor: updatedVehicle.vehicle_color
        };
    } catch (error) {
        logger.error('Update driver profile service error:', error);
        throw error;
    }
};

// export const updateDriverLocation = async (userId, latitude, longitude) => {
//     try {
//         const driver = await driverRepo.findDriverByUserId(userId);
        
//         if (!driver) {
//             throw new NotFoundError('Driver profile');
//         }

//         if (!driver.is_verified) {
//             throw new ApiError(403, 'Driver not verified');
//         }

//         const updatedDriver = await driverRepo.updateDriver(driver.id, {
//             current_latitude: latitude,
//             current_longitude: longitude
//         });

//         return {
//             latitude: updatedDriver.current_latitude,
//             longitude: updatedDriver.current_longitude,
//             updatedAt: updatedDriver.updated_at
//         };
//     } catch (error) {
//         logger.error('Update driver location service error:', error);
//         throw error;
//     }
// };

export const updateDriverLocation = async (userId, latitude, longitude) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);
        if (!driver) throw new NotFoundError('Driver profile');
        if (!driver.is_verified) throw new ApiError(403, 'Driver not verified');
 
        // ── Redis mein location save karo (30 sec expiry — real-time) ─────────
        await saveDriverLocation(driver.id, latitude, longitude);
 
        // ── DB mein bhi update karo (permanent record) ────────────────────────
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


export const toggleAvailability = async (userId, isAvailable) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);
        
        if (!driver) {
            throw new NotFoundError('Driver profile');
        }

        if (!driver.is_verified) {
            throw new ApiError(403, 'Driver not verified');
        }

        // Check if driver is on a ride
        if (isAvailable && driver.is_on_duty) {
            const activeRide = await rideRepo.findActiveRideByDriver(driver.id);
            if (activeRide) {
                throw new ApiError(400, 'Cannot change availability while on a ride');
            }
        }

        const updatedDriver = await driverRepo.updateDriver(driver.id, {
            is_available: isAvailable
        });

        return {
            isAvailable: updatedDriver.is_available,
            updatedAt: updatedDriver.updated_at
        };
    } catch (error) {
        logger.error('Toggle availability service error:', error);
        throw error;
    }
};

export const getDriverRideHistory = async (userId, { page = 1, limit = 10, status }) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);
        
        if (!driver) {
            throw new NotFoundError('Driver profile');
        }

        const offset = (page - 1) * limit;
        
        const rides = await rideRepo.findRidesByDriver(driver.id, {
            status,
            limit,
            offset,
            orderBy: 'requested_at',
            orderDir: 'DESC'
        });

        const total = await rideRepo.countRidesByDriver(driver.id, status);

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
            case 'daily':
                startDate = new Date();
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'weekly':
                startDate = new Date();
                startDate.setDate(startDate.getDate() - 7);
                break;
            case 'monthly':
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

        return {
            totalEarnings: earnings.total,
            ridesCompleted: earnings.rides,
            period,
            startDate,
            endDate,
            breakdown: earnings.breakdown
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