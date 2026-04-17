// import * as rideRepo from '../repositories/ride.repository.js';
// import * as driverRepo from '../../drivers/repositories/driver.repository.js';
// import * as walletRepo from '../../wallet/repositories/wallet.repository.js';
// import * as rideCalculator from '../../../core/utils/rideCalculator.js';
// import { getWeatherSignal } from '../../../core/utils/weatherService.js';
// import * as couponService from '../../coupons/services/couponService.js';
// import * as subscriptionService from '../../subscription/services/subscriptionService.js';
// import { ApiError, NotFoundError, ConflictError } from '../../../core/errors/ApiError.js';
// import logger from '../../../core/logger/logger.js';
// import { ENV } from '../../../config/envConfig.js';
// import { db } from '../../../infrastructure/database/postgres.js';

// // ─── Helper: gather REAL demand + weather signals ───────────────────────────
// const gatherDemandSignals = async (vehicleType, latitude, longitude) => {
//     const searchRadius    = Number(ENV.DEFAULT_SEARCH_RADIUS_KM) || 5;
//     const demandWindow    = Number(ENV.DEMAND_WINDOW_MINUTES)    || 10;
//     const velocityWindow  = Number(ENV.VELOCITY_WINDOW_MINUTES)  || 5;

//     // All four queries run in parallel — demand + weather
//     const [rideRequests, requestVelocity, nearbyDrivers, weatherSignal] = await Promise.all([
//         rideRepo.countRecentRideRequests(vehicleType, latitude, longitude, searchRadius, demandWindow),
//         rideRepo.getRequestVelocity(vehicleType, latitude, longitude, searchRadius, velocityWindow),
//         rideRepo.findNearbyDrivers(vehicleType, latitude, longitude, searchRadius),
//         getWeatherSignal(latitude, longitude)
//     ]);

//     const availableDrivers = nearbyDrivers.length;
//     const pickupDistanceKm = availableDrivers > 0
//         ? Number(nearbyDrivers[0].distance || 0)
//         : 0;

//     return { rideRequests, requestVelocity, availableDrivers, nearbyDrivers, pickupDistanceKm, weatherSignal };
// };

// // ═════════════════════════════════════════════════════════════════════════════
// //  REQUEST RIDE — estimated fare with REAL demand signals
// // ═════════════════════════════════════════════════════════════════════════════
// export const requestRide = async (userId, rideData) => {
//     try {
//         const activeRide = await rideRepo.findActiveRideByPassenger(userId);
//         if (activeRide) {
//             throw new ConflictError('You already have an active ride');
//         }

//         // Distance & duration
//         const distanceKm = rideCalculator.calculateDistance(
//             rideData.pickupLatitude, rideData.pickupLongitude,
//             rideData.dropoffLatitude, rideData.dropoffLongitude
//         );
//         const durationMinutes = rideCalculator.calculateDuration(distanceKm, rideData.vehicleType);

//         // Real demand signals from DB
//         const signals = await gatherDemandSignals(
//             rideData.vehicleType,
//             rideData.pickupLatitude,
//             rideData.pickupLongitude
//         );

//         // Closest driver's daily ride count for platform fee cap
//         const selectedDriverId = signals.availableDrivers > 0 ? signals.nearbyDrivers[0].id : null;
//         const driverDailyRideCount = await rideRepo.getDriverDailyRideCount(selectedDriverId);

//         // Calculate estimated fare (dynamic surge + weather, no waiting yet)
//         const goFare = rideCalculator.calculateEstimatedFare({
//             vehicleType:             rideData.vehicleType,
//             distanceKm,
//             estimatedDurationMinutes: durationMinutes,
//             pickupDistanceKm:        signals.pickupDistanceKm,
//             driverDailyRideCount,
//             rideRequests:            signals.rideRequests,
//             availableDrivers:        signals.availableDrivers,
//             requestVelocity:         signals.requestVelocity,
//             weatherSignal:           signals.weatherSignal
//         });

//         const fare = {
//             baseFare:           goFare.passenger.baseFare,
//             distanceFare:       goFare.passenger.distanceFare,
//             timeFare:           durationMinutes,
//             surgeMultiplier:    goFare.passenger.surgeMultiplier,
//             estimatedFare:      goFare.passenger.estimatedFare,
//             // Lock these at request time so final fare stays consistent
//             convenienceFee:     goFare.passenger.convenienceFee ?? 0,
//             isPeak:             goFare.passenger.isPeak ?? false,
//             demandSupplyRatio:  goFare.signals.demandSupplyRatio ?? 1.0
//         };

//         // ── Step 1: Apply subscription benefits (free ride / % discount / surge protection)
//         // Subscription is checked FIRST — it takes priority over coupon
//         let subscriptionResult = null;
//         {
//             // Surge protection: check BEFORE calling applyRideBenefits so we call it only once
//             // with the correct (post-surge-removal) fare
//             let fareForSubscription = fare.estimatedFare;

//             const sub = await subscriptionService.fetchActiveSubscription(userId);
//             if (sub.hasActiveSubscription && sub.data?.benefits?.surgeProtection && fare.surgeMultiplier > 1) {
//                 // Recalculate fare without surge — then apply subscription on this lower fare
//                 const noSurgeFare = rideCalculator.calculateEstimatedFare({
//                     vehicleType:             rideData.vehicleType,
//                     distanceKm,
//                     estimatedDurationMinutes: durationMinutes,
//                     pickupDistanceKm:        signals.pickupDistanceKm,
//                     driverDailyRideCount,
//                     rideRequests:            0,
//                     availableDrivers:        1,
//                     requestVelocity:         0,
//                     weatherSignal:           null
//                 });
//                 fareForSubscription  = noSurgeFare.passenger.estimatedFare;
//                 fare.surgeMultiplier = 1.0;
//                 fare.convenienceFee  = noSurgeFare.passenger.convenienceFee ?? 0;
//                 fare.isPeak          = noSurgeFare.passenger.isPeak ?? false;
//             }

//             // Single call — no double free-ride deduction
//             subscriptionResult = await subscriptionService.applyRideBenefits(userId, fareForSubscription);
//             if (subscriptionResult.hasSubscription) {
//                 fare.estimatedFare = subscriptionResult.finalAmount;
//             }
//         }

//         // ── Step 2: Apply coupon ONLY if not a free ride (no double discount on free rides)
//         let couponResult = null;
//         if (rideData.couponCode && !(subscriptionResult?.isFreeRide)) {
//             couponResult = await couponService.applyCoupon(
//                 userId,
//                 rideData.couponCode,
//                 fare.estimatedFare,
//                 rideData.vehicleType
//             );
//             fare.estimatedFare = couponResult.finalAmount;
//         }

//         const rideNumber = rideCalculator.generateRideNumber();

//         const ride = await rideRepo.createRide({
//             rideNumber,
//             passengerId:        userId,
//             vehicleType:        rideData.vehicleType,
//             pickupLatitude:     rideData.pickupLatitude,
//             pickupLongitude:    rideData.pickupLongitude,
//             pickupAddress:      rideData.pickupAddress,
//             pickupLocationName: rideData.pickupLocationName,
//             dropoffLatitude:    rideData.dropoffLatitude,
//             dropoffLongitude:   rideData.dropoffLongitude,
//             dropoffAddress:     rideData.dropoffAddress,
//             dropoffLocationName: rideData.dropoffLocationName,
//             distanceKm,
//             durationMinutes,
//             baseFare:             fare.baseFare,
//             distanceFare:         fare.distanceFare,
//             timeFare:             fare.timeFare,
//             surgeMultiplier:      fare.surgeMultiplier,
//             estimatedFare:        fare.estimatedFare,
//             convenienceFee:       fare.convenienceFee,
//             isPeak:               fare.isPeak,
//             demandSupplyRatio:    fare.demandSupplyRatio,
//             paymentMethod:        rideData.paymentMethod || 'cash',
//             couponId:             couponResult?.couponId || null,
//             couponDiscount:       couponResult?.discountApplied || 0,
//             subscriptionDiscount: subscriptionResult?.discountAmount || 0,
//             isFreeRide:           subscriptionResult?.isFreeRide || false
//         });

//         logger.info(`Ride requested: ${rideNumber} for user ${userId}`);

//         return {
//             rideId:           ride.id,
//             rideNumber:       ride.ride_number,
//             vehicleType:      ride.vehicle_type,
//             pickupAddress:    ride.pickup_address,
//             dropoffAddress:   ride.dropoff_address,
//             distanceKm:       ride.distance_km,
//             durationMinutes:  ride.duration_minutes,
//             estimatedFare:    ride.estimated_fare,
//             surgeMultiplier:  ride.surge_multiplier,
//             passengerFareBreakdown: goFare.passenger,
//             driverEarningBreakdown: goFare.driver,
//             pricingSignals:         goFare.signals,
//             ...(subscriptionResult?.hasSubscription && {
//                 subscription: {
//                     planName:        subscriptionResult.benefits?.planName,
//                     isFreeRide:      subscriptionResult.isFreeRide,
//                     discountApplied: subscriptionResult.discountAmount,
//                     originalFare:    subscriptionResult.originalAmount,
//                     surgeProtected:  subscriptionResult.benefits?.surgeProtection && fare.surgeMultiplier === 1.0
//                 }
//             }),
//             ...(couponResult && {
//                 coupon: {
//                     code:            couponResult.code,
//                     discountApplied: couponResult.discountApplied,
//                     originalFare:    couponResult.originalAmount,
//                     message:         couponResult.message
//                 }
//             }),
//             status:        ride.status,
//             requestedAt:   ride.requested_at,
//             nearbyDrivers: signals.availableDrivers,
//             message: 'Ride requested successfully. Finding nearby drivers...'
//         };
//     } catch (error) {
//         logger.error('Request ride service error:', error);
//         throw error;
//     }
// };

// // ═════════════════════════════════════════════════════════════════════════════
// //  CALCULATE FARE API — estimate with real demand (no booking)
// //  Same flow as requestRide — pickup/dropoff se distance, demand signals from DB
// // ═════════════════════════════════════════════════════════════════════════════
// export const calculateFare = async (fareData) => {
//     try {
//         const { vehicleType, pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude } = fareData;

//         // Same distance + duration calculation as requestRide
//         const distanceKm = rideCalculator.calculateDistance(
//             pickupLatitude, pickupLongitude,
//             dropoffLatitude, dropoffLongitude
//         );
//         const durationMinutes = rideCalculator.calculateDuration(distanceKm, vehicleType);

//         // Same demand signals from DB as requestRide
//         const signals = await gatherDemandSignals(vehicleType, pickupLatitude, pickupLongitude);

//         const selectedDriverId = signals.availableDrivers > 0 ? signals.nearbyDrivers[0].id : null;
//         const driverDailyRideCount = await rideRepo.getDriverDailyRideCount(selectedDriverId);

//         return rideCalculator.calculateEstimatedFare({
//             vehicleType,
//             distanceKm,
//             estimatedDurationMinutes: durationMinutes,
//             pickupDistanceKm:        signals.pickupDistanceKm,
//             driverDailyRideCount,
//             rideRequests:            signals.rideRequests,
//             availableDrivers:        signals.availableDrivers,
//             requestVelocity:         signals.requestVelocity,
//             weatherSignal:           signals.weatherSignal
//         });
//     } catch (error) {
//         logger.error('Calculate fare service error:', error);
//         throw error;
//     }
// };

// // ═════════════════════════════════════════════════════════════════════════════
// //  FINAL FARE — called internally when ride status → completed
// //  Uses LOCKED surge from request time + ACTUAL waiting & duration
// // ═════════════════════════════════════════════════════════════════════════════
// const calculateCompletionFare = async (ride) => {
//     // Actual waited minutes: driver_arrived_at → started_at
//     let waitedMinutes = 0;
//     if (ride.driver_arrived_at && ride.started_at) {
//         waitedMinutes = (new Date(ride.started_at) - new Date(ride.driver_arrived_at)) / 60000;
//     }

//     // Actual ride duration: started_at → completed_at
//     let actualDurationMinutes = Number(ride.duration_minutes) || 0;
//     if (ride.started_at && ride.completed_at) {
//         actualDurationMinutes = (new Date(ride.completed_at) - new Date(ride.started_at)) / 60000;
//     }

//     // Pickup distance saved at the time driver accepted the ride
//     const pickupDistanceKm = Number(ride.driver_pickup_distance_km) || 0;

//     const driverDailyRideCount = await rideRepo.getDriverDailyRideCount(ride.driver_id);

//     const result = rideCalculator.calculateFinalRideFare({
//         vehicleType:             ride.vehicle_type,
//         distanceKm:              Number(ride.distance_km) || 0,
//         estimatedDurationMinutes: Number(ride.duration_minutes) || 0,
//         actualDurationMinutes,
//         waitedMinutes,
//         surgeMultiplier:         Number(ride.surge_multiplier) || 1,
//         pickupDistanceKm,
//         driverDailyRideCount,
//         lockedConvenienceFee:    ride.convenience_fee != null ? Number(ride.convenience_fee) : null,
//         lockedIsPeak:            ride.is_peak != null ? ride.is_peak : null
//     });

//     return result;
// };

// // ═════════════════════════════════════════════════════════════════════════════
// //  OTHER SERVICE METHODS (unchanged logic)
// // ═════════════════════════════════════════════════════════════════════════════

// export const findNearbyDrivers = async (vehicleType, latitude, longitude) => {
//     try {
//         const drivers = await rideRepo.findNearbyDrivers(
//             vehicleType, latitude, longitude,
//             ENV.DEFAULT_SEARCH_RADIUS_KM || 5
//         );

//         return drivers.map(driver => ({
//             id:            driver.id,
//             name:          driver.full_name,
//             vehicleType:   driver.vehicle_type,
//             vehicleNumber: driver.vehicle_number,
//             vehicleModel:  driver.vehicle_model,
//             vehicleColor:  driver.vehicle_color,
//             rating:        parseFloat(driver.rating || 0).toFixed(1),
//             distance:      parseFloat(driver.distance).toFixed(1),
//             location: {
//                 latitude:  driver.current_latitude,
//                 longitude: driver.current_longitude
//             }
//         }));
//     } catch (error) {
//         logger.error('Find nearby drivers service error:', error);
//         throw error;
//     }
// };

// export const acceptRide = async (driverUserId, rideId) => {
//     try {
//         const driver = await driverRepo.findDriverByUserId(driverUserId);
//         if (!driver) throw new NotFoundError('Driver not found');
//         if (!driver.is_verified) throw new ApiError(403, 'Driver not verified');

//         const activeRide = await rideRepo.findActiveRideByDriver(driver.id);
//         if (activeRide) throw new ConflictError('You already have an active ride');

//         const ride = await rideRepo.findRideById(rideId);
//         if (!ride) throw new NotFoundError('Ride not found');
//         if (ride.status !== 'requested') throw new ConflictError('Ride is no longer available');

//         // Calculate actual distance from driver's current location to ride's pickup point
//         const pickupDistanceKm = (driver.current_latitude && driver.current_longitude)
//             ? rideCalculator.calculateDistance(
//                 driver.current_latitude, driver.current_longitude,
//                 ride.pickup_latitude, ride.pickup_longitude
//               )
//             : 0;

//         const updatedRide = await rideRepo.assignDriverToRide(rideId, driver.id, pickupDistanceKm);
//         if (!updatedRide) throw new ConflictError('Ride is no longer available or you are already on duty');
//         await driverRepo.updateDriver(driver.id, { is_on_duty: true });

//         logger.info(`Driver ${driverUserId} accepted ride ${rideId}`);

//         return {
//             rideId:     updatedRide.id,
//             rideNumber: updatedRide.ride_number,
//             status:     updatedRide.status,
//             message:    'Ride accepted successfully'
//         };
//     } catch (error) {
//         logger.error('Accept ride service error:', error);
//         throw error;
//     }
// };

// export const updateRideStatus = async (driverUserId, rideId, statusData) => {
//     try {
//         const { status, cancellationReason } = statusData;

//         const driver = await driverRepo.findDriverByUserId(driverUserId);
//         if (!driver) throw new NotFoundError('Driver not found');

//         const ride = await rideRepo.findRideById(rideId);
//         if (!ride) throw new NotFoundError('Ride not found');
//         if (ride.driver_id !== driver.id) throw new ApiError(403, 'You are not assigned to this ride');

//         validateStatusTransition(ride.status, status);

//         let additionalFields = {};

//         if (status === 'cancelled') {
//             additionalFields.cancelled_by = 'driver';
//             additionalFields.cancellation_reason = cancellationReason || 'Driver cancelled';
//             await driverRepo.updateDriver(driver.id, { is_on_duty: false });
//         }

//         if (status === 'completed') {
//             // ── FINAL FARE with real actuals ──
//             // We need completed_at for calculation, but it hasn't been set yet.
//             // So we set it now for the calculation.
//             const completedAt = new Date();
//             const rideWithTimestamp = { ...ride, completed_at: completedAt };

//             const finalResult = await calculateCompletionFare(rideWithTimestamp);

//             // Apply stored discounts (subscription + coupon) to final fare too
//             // Discounts are fixed amounts locked at request time
//             let passengerFinalFare = finalResult.passenger.finalFare;

//             if (ride.is_free_ride) {
//                 passengerFinalFare = 0;
//             } else {
//                 const subDiscount    = Number(ride.subscription_discount) || 0;
//                 const couponDiscount = Number(ride.coupon_discount) || 0;
//                 passengerFinalFare   = Math.max(0, passengerFinalFare - subDiscount - couponDiscount);
//             }

//             additionalFields.actual_fare    = passengerFinalFare;
//             additionalFields.final_fare     = passengerFinalFare;
//             additionalFields.payment_status = 'pending';

//             await driverRepo.updateDriver(driver.id, { is_on_duty: false });
//             await driverRepo.updateDriver(driver.id, {
//                 total_rides:    driver.total_rides + 1,
//                 total_earnings: (driver.total_earnings || 0) + finalResult.driver.netEarnings
//             });

//             // Record coupon usage if coupon was applied on this ride
//             if (ride.coupon_id) {
//                 await couponService.recordUsage(
//                     ride.coupon_id,
//                     ride.passenger_id,
//                     rideId,
//                     Number(ride.coupon_discount),
//                     finalResult.passenger.finalFare
//                 );
//             }

//             logger.info(`Ride ${rideId} final fare: ₹${passengerFinalFare} (estimated: ₹${ride.estimated_fare})`);
//         }

//         const updatedRide = await rideRepo.updateRideStatus(rideId, status, additionalFields);

//         logger.info(`Ride ${rideId} status updated to ${status}`);

//         return {
//             rideId:     updatedRide.id,
//             rideNumber: updatedRide.ride_number,
//             status:     updatedRide.status,
//             ...(status === 'completed' && {
//                 estimatedFare:        ride.estimated_fare,
//                 finalFare:            additionalFields.final_fare,
//                 subscriptionDiscount: Number(ride.subscription_discount) || 0,
//                 couponDiscount:       Number(ride.coupon_discount) || 0,
//                 isFreeRide:           ride.is_free_ride || false
//             }),
//             message: `Ride status updated to ${status}`
//         };
//     } catch (error) {
//         logger.error('Update ride status service error:', error);
//         throw error;
//     }
// };

// export const getRideDetails = async (userId, rideId, userRole) => {
//     try {
//         const ride = await rideRepo.findRideById(rideId);
//         if (!ride) throw new NotFoundError('Ride not found');

//         if (userRole === 'passenger' && ride.passenger_id !== userId) {
//             throw new ApiError(403, 'You do not have access to this ride');
//         }

//         if (userRole === 'driver') {
//             const driver = await driverRepo.findDriverByUserId(userId);
//             if (!driver || ride.driver_id !== driver.id) {
//                 throw new ApiError(403, 'You do not have access to this ride');
//             }
//         }

//         return formatRideResponse(ride);
//     } catch (error) {
//         logger.error('Get ride details service error:', error);
//         throw error;
//     }
// };

// export const getPassengerRideHistory = async (userId, { page = 1, limit = 10, status }) => {
//     try {
//         const offset = (page - 1) * limit;
//         const rides = await rideRepo.findRidesByPassenger(userId, { limit, offset, status });
//         const total = await rideRepo.countRidesByPassenger(userId, status);

//         return {
//             rides: rides.map(formatRideListResponse),
//             pagination: {
//                 page:  parseInt(page),
//                 limit: parseInt(limit),
//                 total,
//                 pages: Math.ceil(total / limit)
//             }
//         };
//     } catch (error) {
//         logger.error('Get passenger ride history service error:', error);
//         throw error;
//     }
// };

// export const getDriverRideHistory = async (driverUserId, { page = 1, limit = 10, status }) => {
//     try {
//         const driver = await driverRepo.findDriverByUserId(driverUserId);
//         if (!driver) throw new NotFoundError('Driver not found');

//         const offset = (page - 1) * limit;
//         const rides = await rideRepo.findRidesByDriver(driver.id, { limit, offset, status });
//         const total = await rideRepo.countRidesByDriver(driver.id, status);

//         return {
//             rides: rides.map(formatRideListResponse),
//             pagination: {
//                 page:  parseInt(page),
//                 limit: parseInt(limit),
//                 total,
//                 pages: Math.ceil(total / limit)
//             }
//         };
//     } catch (error) {
//         logger.error('Get driver ride history service error:', error);
//         throw error;
//     }
// };

// export const getCurrentRide = async (userId, userRole) => {
//     try {
//         let ride;
//         if (userRole === 'passenger') {
//             ride = await rideRepo.findActiveRideByPassenger(userId);
//         } else {
//             const driver = await driverRepo.findDriverByUserId(userId);
//             if (!driver) throw new NotFoundError('Driver not found');
//             ride = await rideRepo.findActiveRideByDriver(driver.id);
//         }

//         if (!ride) return { hasActiveRide: false };

//         return { hasActiveRide: true, ride: formatRideResponse(ride) };
//     } catch (error) {
//         logger.error('Get current ride service error:', error);
//         throw error;
//     }
// };

// export const rateRide = async (userId, rideId, rating, review) => {
//     try {
//         const ride = await rideRepo.findRideById(rideId);
//         if (!ride) throw new NotFoundError('Ride not found');
//         if (ride.passenger_id !== userId) throw new ApiError(403, 'You are not authorized to rate this ride');
//         if (ride.status !== 'completed') throw new ApiError(400, 'Can only rate completed rides');
//         if (ride.rating) throw new ApiError(400, 'Ride already rated');

//         await rideRepo.rateRide(rideId, rating, review);

//         if (ride.driver_id) {
//             await updateDriverRating(ride.driver_id);
//         }

//         return { success: true, message: 'Ride rated successfully' };
//     } catch (error) {
//         logger.error('Rate ride service error:', error);
//         throw error;
//     }
// };

// // ─── Internal Helpers ───────────────────────────────────────────────────────

// const validateStatusTransition = (currentStatus, newStatus) => {
//     const validTransitions = {
//         'requested':       ['driver_assigned', 'cancelled'],
//         'driver_assigned': ['driver_arrived', 'cancelled'],
//         'driver_arrived':  ['in_progress', 'cancelled'],
//         'in_progress':     ['completed'],
//         'completed':       [],
//         'cancelled':       []
//     };

//     if (!validTransitions[currentStatus]?.includes(newStatus)) {
//         throw new ApiError(400, `Cannot transition from ${currentStatus} to ${newStatus}`);
//     }
// };

// const updateDriverRating = async (driverId) => {
//     try {
//         await db.query(
//             `UPDATE drivers
//              SET rating = (
//                  SELECT AVG(rating) FROM rides WHERE driver_id = $1 AND rating IS NOT NULL
//              )
//              WHERE id = $1`,
//             [driverId]
//         );
//     } catch (error) {
//         logger.error('Update driver rating error:', error);
//     }
// };

// const formatRideResponse = (ride) => ({
//     id:              ride.id,
//     rideNumber:      ride.ride_number,
//     vehicleType:     ride.vehicle_type,
//     pickupAddress:   ride.pickup_address,
//     pickupLocation:  { latitude: ride.pickup_latitude, longitude: ride.pickup_longitude },
//     dropoffAddress:  ride.dropoff_address,
//     dropoffLocation: { latitude: ride.dropoff_latitude, longitude: ride.dropoff_longitude },
//     distanceKm:      ride.distance_km,
//     durationMinutes: ride.duration_minutes,
//     estimatedFare:   ride.estimated_fare,
//     actualFare:      ride.actual_fare,
//     finalFare:       ride.final_fare,
//     status:          ride.status,
//     paymentStatus:   ride.payment_status,
//     paymentMethod:   ride.payment_method,
//     requestedAt:     ride.requested_at,
//     driverAssignedAt: ride.driver_assigned_at,
//     startedAt:       ride.started_at,
//     completedAt:     ride.completed_at,
//     cancelledAt:     ride.cancelled_at,
//     cancelledBy:     ride.cancelled_by,
//     cancellationReason: ride.cancellation_reason,
//     passenger: ride.passenger_name ? {
//         name:  ride.passenger_name,
//         phone: ride.passenger_phone
//     } : null,
//     driver: ride.driver_name ? {
//         name:          ride.driver_name,
//         phone:         ride.driver_phone,
//         vehicleType:   ride.vehicle_type,
//         vehicleNumber: ride.vehicle_number,
//         vehicleModel:  ride.vehicle_model,
//         vehicleColor:  ride.vehicle_color
//     } : null,
//     driverLocation: ride.driver_current_latitude ? {
//         latitude:  ride.driver_current_latitude,
//         longitude: ride.driver_current_longitude
//     } : null,
//     rating: ride.rating,
//     review: ride.review
// });

// const formatRideListResponse = (ride) => ({
//     id:            ride.id,
//     rideNumber:    ride.ride_number,
//     vehicleType:   ride.vehicle_type,
//     pickupAddress: ride.pickup_address,
//     dropoffAddress: ride.dropoff_address,
//     distanceKm:    ride.distance_km,
//     estimatedFare: ride.estimated_fare,
//     actualFare:    ride.actual_fare,
//     finalFare:     ride.final_fare,
//     status:        ride.status,
//     paymentStatus: ride.payment_status,
//     requestedAt:   ride.requested_at,
//     completedAt:   ride.completed_at,
//     passengerName: ride.passenger_name,
//     driverName:    ride.driver_name
// });




import * as rideRepo from '../repositories/ride.repository.js';
import * as driverRepo from '../../drivers/repositories/driver.repository.js';
import * as walletRepo from '../../wallet/repositories/wallet.repository.js';
import * as rideOtpService from './rideOtpService.js';
import * as rideCalculator from '../../../core/utils/rideCalculator.js';
import { getWeatherSignal } from '../../../core/utils/weatherService.js';
import * as couponService from '../../coupons/services/couponService.js';
import * as subscriptionService from '../../subscription/services/subscriptionService.js';
import { ApiError, NotFoundError, ConflictError } from '../../../core/errors/ApiError.js';
import logger from '../../../core/logger/logger.js';
import { ENV } from '../../../config/envConfig.js';
import { db } from '../../../infrastructure/database/postgres.js';
import { getDistanceAndDuration } from '../../../core/services/googleMapsService.js';

import { 
    getCachedNearbyDrivers, 
    setCachedNearbyDrivers,
    getCachedSurge,        // ++ ADD
    setCachedSurge,        // ++ ADD
} from '../../../core/services/redisService.js';
import {
    emitRideRequest,
    emitRideStatusUpdate,
    emitToPassenger,
    emitToDriver
} from '../../../infrastructure/websocket/socket.events.js';
import {
    sendAssignmentToPassenger,
    sendAssignmentToDriver,
    notifyDriverArrival
} from '../../../infrastructure/websocket/assignment.handler.js';
import { addRideCompletionJob, addNotificationJob } from '../../../infrastructure/queue/rideQueue.js';

const safeEmit = (fn, label) => {
    try { fn(); } catch (err) { logger.warn(`Socket emit failed (${label}): ${err.message}`); }
};

// ─── Helper: gather REAL demand + weather signals ───────────────────────────
// const gatherDemandSignals = async (vehicleType, latitude, longitude) => {
//     const searchRadius    = Number(ENV.DEFAULT_SEARCH_RADIUS_KM) || 5;
//     const demandWindow    = Number(ENV.DEMAND_WINDOW_MINUTES)    || 10;
//     const velocityWindow  = Number(ENV.VELOCITY_WINDOW_MINUTES)  || 5;

//     const [rideRequests, requestVelocity, nearbyDrivers, weatherSignal] = await Promise.all([
//         rideRepo.countRecentRideRequests(vehicleType, latitude, longitude, searchRadius, demandWindow),
//         rideRepo.getRequestVelocity(vehicleType, latitude, longitude, searchRadius, velocityWindow),
//         rideRepo.findNearbyDrivers(vehicleType, latitude, longitude, searchRadius),
//         getWeatherSignal(latitude, longitude)
//     ]);

//     const availableDrivers = nearbyDrivers.length;
//     const pickupDistanceKm = availableDrivers > 0
//         ? Number(nearbyDrivers[0].distance || 0)
//         : 0;

//     return { rideRequests, requestVelocity, availableDrivers, nearbyDrivers, pickupDistanceKm, weatherSignal };
// };


const gatherDemandSignals = async (vehicleType, latitude, longitude) => {
    const searchRadius    = Number(ENV.DEFAULT_SEARCH_RADIUS_KM) || 5;
    const demandWindow    = Number(ENV.DEMAND_WINDOW_MINUTES)    || 10;
    const velocityWindow  = Number(ENV.VELOCITY_WINDOW_MINUTES)  || 5;

    const [rideRequests, requestVelocity, nearbyDrivers, weatherSignal] = await Promise.all([
        rideRepo.countRecentRideRequests(vehicleType, latitude, longitude, searchRadius, demandWindow),
        rideRepo.getRequestVelocity(vehicleType, latitude, longitude, searchRadius, velocityWindow),
        // ++ Yeh line change ki — Redis cache se fetch karo
        (async () => {
            const cached = await getCachedNearbyDrivers(vehicleType, latitude, longitude);
            if (cached) return cached;
            const drivers = await rideRepo.findNearbyDrivers(vehicleType, latitude, longitude, searchRadius);
            await setCachedNearbyDrivers(vehicleType, latitude, longitude, drivers);
            return drivers;
        })(),
        getWeatherSignal(latitude, longitude)
    ]);

    const availableDrivers = nearbyDrivers.length;
    const pickupDistanceKm = availableDrivers > 0
        ? Number(nearbyDrivers[0].distance || 0)
        : 0;

    return { rideRequests, requestVelocity, availableDrivers, nearbyDrivers, pickupDistanceKm, weatherSignal };
};

// ═════════════════════════════════════════════════════════════════════════════
//  REQUEST RIDE
// ═════════════════════════════════════════════════════════════════════════════
export const requestRide = async (userId, rideData) => {
    try {
        const activeRide = await rideRepo.findActiveRideByPassenger(userId);
        if (activeRide) {
            throw new ConflictError('You already have an active ride');
        }

        // const distanceKm = rideCalculator.calculateDistance(
        //     rideData.pickupLatitude, rideData.pickupLongitude,
        //     rideData.dropoffLatitude, rideData.dropoffLongitude
        // );
        // const durationMinutes = rideCalculator.calculateDuration(distanceKm, rideData.vehicleType);

        const mapsResult = await getDistanceAndDuration(
    rideData.pickupLatitude, rideData.pickupLongitude,
    rideData.dropoffLatitude, rideData.dropoffLongitude
);
const distanceKm = mapsResult.distanceKm;
const durationMinutes = mapsResult.durationMinutes;

        const signals = await gatherDemandSignals(
            rideData.vehicleType,
            rideData.pickupLatitude,
            rideData.pickupLongitude
        );

        const selectedDriverId = signals.availableDrivers > 0 ? signals.nearbyDrivers[0].id : null;
        const driverDailyRideCount = await rideRepo.getDriverDailyRideCount(selectedDriverId);

        const goFare = rideCalculator.calculateEstimatedFare({
            vehicleType:              rideData.vehicleType,
            distanceKm,
            estimatedDurationMinutes: durationMinutes,
            pickupDistanceKm:         signals.pickupDistanceKm,
            driverDailyRideCount,
            rideRequests:             signals.rideRequests,
            availableDrivers:         signals.availableDrivers,
            requestVelocity:          signals.requestVelocity,
            weatherSignal:            signals.weatherSignal
        });

        const fare = {
            baseFare:          goFare.passenger.baseFare,
            distanceFare:      goFare.passenger.distanceFare,
            timeFare:          durationMinutes,
            surgeMultiplier:   goFare.passenger.surgeMultiplier,
            estimatedFare:     goFare.passenger.estimatedFare,
            convenienceFee:    goFare.passenger.convenienceFee ?? 0,
            isPeak:            goFare.passenger.isPeak ?? false,
            demandSupplyRatio: goFare.signals.demandSupplyRatio ?? 1.0
        };

        // ── Step 1: Subscription benefits
        let subscriptionResult = null;
        {
            let fareForSubscription = fare.estimatedFare;

            const sub = await subscriptionService.fetchActiveSubscription(userId);
            if (sub.hasActiveSubscription && sub.data?.benefits?.surgeProtection && fare.surgeMultiplier > 1) {
                const noSurgeFare = rideCalculator.calculateEstimatedFare({
                    vehicleType:              rideData.vehicleType,
                    distanceKm,
                    estimatedDurationMinutes: durationMinutes,
                    pickupDistanceKm:         signals.pickupDistanceKm,
                    driverDailyRideCount,
                    rideRequests:             0,
                    availableDrivers:         1,
                    requestVelocity:          0,
                    weatherSignal:            null
                });
                fareForSubscription  = noSurgeFare.passenger.estimatedFare;
                fare.surgeMultiplier = 1.0;
                fare.convenienceFee  = noSurgeFare.passenger.convenienceFee ?? 0;
                fare.isPeak          = noSurgeFare.passenger.isPeak ?? false;
            }

            subscriptionResult = await subscriptionService.applyRideBenefits(userId, fareForSubscription);
            if (subscriptionResult.hasSubscription) {
                fare.estimatedFare = subscriptionResult.finalAmount;
            }
        }

        // ── Step 2: Coupon
        let couponResult = null;
        if (rideData.couponCode && !(subscriptionResult?.isFreeRide)) {
            couponResult = await couponService.applyCoupon(
                userId,
                rideData.couponCode,
                fare.estimatedFare,
                rideData.vehicleType
            );
            fare.estimatedFare = couponResult.finalAmount;
        }

        const rideNumber = rideCalculator.generateRideNumber();

        const ride = await rideRepo.createRide({
            rideNumber,
            passengerId:         userId,
            vehicleType:         rideData.vehicleType,
            pickupLatitude:      rideData.pickupLatitude,
            pickupLongitude:     rideData.pickupLongitude,
            pickupAddress:       rideData.pickupAddress,
            pickupLocationName:  rideData.pickupLocationName,
            dropoffLatitude:     rideData.dropoffLatitude,
            dropoffLongitude:    rideData.dropoffLongitude,
            dropoffAddress:      rideData.dropoffAddress,
            dropoffLocationName: rideData.dropoffLocationName,
            distanceKm,
            durationMinutes,
            baseFare:             fare.baseFare,
            distanceFare:         fare.distanceFare,
            timeFare:             fare.timeFare,
            surgeMultiplier:      fare.surgeMultiplier,
            estimatedFare:        fare.estimatedFare,
            convenienceFee:       fare.convenienceFee,
            isPeak:               fare.isPeak,
            demandSupplyRatio:    fare.demandSupplyRatio,
            paymentMethod:        rideData.paymentMethod || 'cash',
            couponId:             couponResult?.couponId || null,
            couponDiscount:       couponResult?.discountApplied || 0,
            subscriptionDiscount: subscriptionResult?.discountAmount || 0,
            isFreeRide:           subscriptionResult?.isFreeRide || false
        });

        // ── FCM 1: Nearby drivers ko ride request notification (queued) ──────
        // 100 FCM calls sync mein HTTP request block karte the — ab queue mein
        if (signals.nearbyDrivers.length > 0) {
            const notifyDrivers = signals.nearbyDrivers.slice(0, 100).filter(d => d.fcm_token);
            await Promise.allSettled(
                notifyDrivers.map(d => addNotificationJob('new-ride-request', {
                    fcmToken: d.fcm_token,
                    title:    'New Ride Request!',
                    body:     `Pickup: ${rideData.pickupLocationName || rideData.pickupAddress} — Rs.${fare.estimatedFare}`,
                    data: {
                        type:          'new_ride_request',
                        rideId:        String(ride.id),
                        rideNumber:    ride.ride_number,
                        estimatedFare: String(fare.estimatedFare),
                        pickupAddress: rideData.pickupAddress,
                        vehicleType:   rideData.vehicleType,
                    },
                }))
            );
        }

        // ── SOCKET: broadcast new ride request to nearby drivers ──────────────
        if (signals.nearbyDrivers.length > 0) {
            const pickupLocation = {
                latitude:  rideData.pickupLatitude,
                longitude: rideData.pickupLongitude,
                address:   rideData.pickupAddress
            };
            const dropoffLocation = {
                latitude:  rideData.dropoffLatitude,
                longitude: rideData.dropoffLongitude,
                address:   rideData.dropoffAddress
            };
            signals.nearbyDrivers.slice(0, 100).forEach(d => {
                safeEmit(() => emitToDriver(d.user_id || d.id, 'ride:new_request', {
                    rideId:           ride.id,
                    rideNumber:       ride.ride_number,
                    pickupLocation,
                    dropoffLocation,
                    estimatedFare:    fare.estimatedFare,
                    distanceKm,
                    durationMinutes,
                    vehicleType:      rideData.vehicleType,
                    timestamp:        new Date().toISOString()
                }), 'ride:new_request');
            });
        }

        logger.info(`Ride requested: ${rideNumber} for user ${userId}`);

        return {
            rideId:           ride.id,
            rideNumber:       ride.ride_number,
            vehicleType:      ride.vehicle_type,
            pickupAddress:    ride.pickup_address,
            dropoffAddress:   ride.dropoff_address,
            distanceKm:       ride.distance_km,
            durationMinutes:  ride.duration_minutes,
            estimatedFare:    ride.estimated_fare,
            surgeMultiplier:  ride.surge_multiplier,
            passengerFareBreakdown: goFare.passenger,
            driverEarningBreakdown: goFare.driver,
            pricingSignals:         goFare.signals,
            ...(subscriptionResult?.hasSubscription && {
                subscription: {
                    planName:       subscriptionResult.benefits?.planName,
                    isFreeRide:     subscriptionResult.isFreeRide,
                    discountApplied: subscriptionResult.discountAmount,
                    originalFare:   subscriptionResult.originalAmount,
                    surgeProtected: subscriptionResult.benefits?.surgeProtection && fare.surgeMultiplier === 1.0
                }
            }),
            ...(couponResult && {
                coupon: {
                    code:            couponResult.code,
                    discountApplied: couponResult.discountApplied,
                    originalFare:    couponResult.originalAmount,
                    message:         couponResult.message
                }
            }),
            status:        ride.status,
            requestedAt:   ride.requested_at,
            nearbyDrivers: signals.availableDrivers,
            message: 'Ride requested successfully. Finding nearby drivers...'
        };
    } catch (error) {
        logger.error('Request ride service error:', error);
        throw error;
    }
};

// ═════════════════════════════════════════════════════════════════════════════
//  CALCULATE FARE API
// ═════════════════════════════════════════════════════════════════════════════
export const calculateFare = async (fareData) => {
    try {
        const { vehicleType, pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude } = fareData;

        // const distanceKm = rideCalculator.calculateDistance(
        //     pickupLatitude, pickupLongitude,
        //     dropoffLatitude, dropoffLongitude
        // );
        // const durationMinutes = rideCalculator.calculateDuration(distanceKm, vehicleType);
        const mapsResult = await getDistanceAndDuration(
    pickupLatitude, pickupLongitude,
    dropoffLatitude, dropoffLongitude
);
const distanceKm = mapsResult.distanceKm;
const durationMinutes = mapsResult.durationMinutes;
        const signals         = await gatherDemandSignals(vehicleType, pickupLatitude, pickupLongitude);
        const selectedDriverId = signals.availableDrivers > 0 ? signals.nearbyDrivers[0].id : null;
        const driverDailyRideCount = await rideRepo.getDriverDailyRideCount(selectedDriverId);

        return rideCalculator.calculateEstimatedFare({
            vehicleType,
            distanceKm,
            estimatedDurationMinutes: durationMinutes,
            pickupDistanceKm:         signals.pickupDistanceKm,
            driverDailyRideCount,
            rideRequests:             signals.rideRequests,
            availableDrivers:         signals.availableDrivers,
            requestVelocity:          signals.requestVelocity,
            weatherSignal:            signals.weatherSignal
        });
    } catch (error) {
        logger.error('Calculate fare service error:', error);
        throw error;
    }
};

// ═════════════════════════════════════════════════════════════════════════════
//  FINAL FARE CALCULATION
// ═════════════════════════════════════════════════════════════════════════════
const calculateCompletionFare = async (ride) => {
    let waitedMinutes = 0;
    if (ride.driver_arrived_at && ride.started_at) {
        waitedMinutes = (new Date(ride.started_at) - new Date(ride.driver_arrived_at)) / 60000;
    }

    let actualDurationMinutes = Number(ride.duration_minutes) || 0;
    if (ride.started_at && ride.completed_at) {
        actualDurationMinutes = (new Date(ride.completed_at) - new Date(ride.started_at)) / 60000;
    }

    const pickupDistanceKm     = Number(ride.driver_pickup_distance_km) || 0;
    const driverDailyRideCount = await rideRepo.getDriverDailyRideCount(ride.driver_id);

    return rideCalculator.calculateFinalRideFare({
        vehicleType:              ride.vehicle_type,
        distanceKm:               Number(ride.distance_km) || 0,
        estimatedDurationMinutes: Number(ride.duration_minutes) || 0,
        actualDurationMinutes,
        waitedMinutes,
        surgeMultiplier:          Number(ride.surge_multiplier) || 1,
        pickupDistanceKm,
        driverDailyRideCount,
        lockedConvenienceFee:     ride.convenience_fee != null ? Number(ride.convenience_fee) : null,
        lockedIsPeak:             ride.is_peak != null ? ride.is_peak : null
    });
};

// ═════════════════════════════════════════════════════════════════════════════
//  FIND NEARBY DRIVERS
// ═════════════════════════════════════════════════════════════════════════════
// export const findNearbyDrivers = async (vehicleType, latitude, longitude) => {
//     try {
//         const drivers = await rideRepo.findNearbyDrivers(
//             vehicleType, latitude, longitude,
//             ENV.DEFAULT_SEARCH_RADIUS_KM || 5
//         );

//         return drivers.map(driver => ({
//             id:            driver.id,
//             name:          driver.full_name,
//             vehicleType:   driver.vehicle_type,
//             vehicleNumber: driver.vehicle_number,
//             vehicleModel:  driver.vehicle_model,
//             vehicleColor:  driver.vehicle_color,
//             rating:        parseFloat(driver.rating || 0).toFixed(1),
//             distance:      parseFloat(driver.distance).toFixed(1),
//             location: {
//                 latitude:  driver.current_latitude,
//                 longitude: driver.current_longitude
//             }
//         }));
//     } catch (error) {
//         logger.error('Find nearby drivers service error:', error);
//         throw error;
//     }
// };



export const findNearbyDrivers = async (vehicleType, latitude, longitude) => {
    try {
        // ── Step 1: Redis cache check ─────────────────────────────────────────
        const cached = await getCachedNearbyDrivers(vehicleType, latitude, longitude);
        if (cached !== null) {
            logger.debug(`✅ Nearby drivers cache HIT | ${vehicleType} | ${cached.length} drivers`);
            return cached;
        }

        // ── Step 2: Cache miss — DB se fetch ──────────────────────────────────
        logger.debug(`🚗 Nearby drivers cache MISS — fetching from DB`);
        const drivers = await rideRepo.findNearbyDrivers(
            vehicleType, latitude, longitude,
            ENV.DEFAULT_SEARCH_RADIUS_KM || 5
        );

        const formatted = drivers.map(driver => ({
            id:            driver.id,
            name:          driver.full_name,
            vehicleType:   driver.vehicle_type,
            vehicleNumber: driver.vehicle_number,
            vehicleModel:  driver.vehicle_model,
            vehicleColor:  driver.vehicle_color,
            rating:        parseFloat(driver.rating || 0).toFixed(1),
            distance:      parseFloat(driver.distance).toFixed(1),
            location: {
                latitude:  driver.current_latitude,
                longitude: driver.current_longitude
            }
        }));

        // ── Step 3: Redis mein cache karo (10 sec TTL) ────────────────────────
        await setCachedNearbyDrivers(vehicleType, latitude, longitude, formatted);

        return formatted;
    } catch (error) {
        logger.error('Find nearby drivers service error:', error);
        throw error;
    }
};

// ═════════════════════════════════════════════════════════════════════════════
//  ACCEPT RIDE
// ═════════════════════════════════════════════════════════════════════════════
export const acceptRide = async (driverUserId, rideId) => {
    try {
        const driver = await driverRepo.findDriverByUserId(driverUserId);
        if (!driver) throw new NotFoundError('Driver not found');
        if (!driver.is_verified) throw new ApiError(403, 'Driver not verified');

        const activeRide = await rideRepo.findActiveRideByDriver(driver.id);
        if (activeRide) throw new ConflictError('You already have an active ride');

        const ride = await rideRepo.findRideById(rideId);
        if (!ride) throw new NotFoundError('Ride not found');
        if (ride.status !== 'requested') throw new ConflictError('Ride is no longer available');

        const pickupDistanceKm = (driver.current_latitude && driver.current_longitude)
            ? rideCalculator.calculateDistance(
                driver.current_latitude, driver.current_longitude,
                ride.pickup_latitude, ride.pickup_longitude
              )
            : 0;

        const updatedRide = await rideRepo.assignDriverToRide(rideId, driver.id, pickupDistanceKm);
        if (!updatedRide) throw new ConflictError('Ride is no longer available or you are already on duty');
        await driverRepo.updateDriver(driver.id, { is_on_duty: true });

        // ── FCM 2: Passenger ko notify — driver ne ride accept ki (queued) ───
        if (ride.passenger_fcm_token) {
            await addNotificationJob('ride-accepted', {
                fcmToken: ride.passenger_fcm_token,
                title:    'Driver Found!',
                body:     `${driver.full_name} is on the way — ${Math.ceil(pickupDistanceKm * 3)} mins away`,
                data: {
                    type:          'ride_accepted',
                    rideId:        String(rideId),
                    driverName:    driver.full_name,
                    driverPhone:   String(driver.phone_number || ''),
                    vehicleNumber: String(driver.vehicle_number || ''),
                    vehicleModel:  String(driver.vehicle_model || ''),
                    vehicleColor:  String(driver.vehicle_color || ''),
                    eta:           String(Math.ceil(pickupDistanceKm * 3)),
                },
            });
        }

        // ── SOCKET: notify passenger of driver assignment ─────────────────────
        const etaMinutes = Math.ceil(pickupDistanceKm * 3);
        const assignmentData = {
            rideId,
            driverId:              driver.id,
            driverName:            driver.full_name,
            driverPhone:           driver.phone_number,
            driverRating:          driver.rating || 0,
            vehicleNumber:         driver.vehicle_number,
            vehicleType:           driver.vehicle_type,
            vehicleColor:          driver.vehicle_color,
            vehicleModel:          driver.vehicle_model,
            estimatedArrivalTime:  etaMinutes,
            assignedAt:            new Date().toISOString()
        };
        safeEmit(() => sendAssignmentToPassenger(ride.passenger_id, assignmentData), 'ride:driver_assigned');

        // ── SOCKET: confirm assignment to driver ──────────────────────────────
        safeEmit(() => sendAssignmentToDriver(driver.user_id || driverUserId, {
            id:                rideId,
            rideNumber:        updatedRide.ride_number,
            passengerName:     ride.passenger_name,
            passengerPhone:    ride.passenger_phone,
            pickupLocation:    {
                latitude:  ride.pickup_latitude,
                longitude: ride.pickup_longitude,
                address:   ride.pickup_address
            },
            dropoffLocation:   {
                latitude:  ride.dropoff_latitude,
                longitude: ride.dropoff_longitude,
                address:   ride.dropoff_address
            },
            estimatedFare:     ride.estimated_fare,
            estimatedDistance: ride.distance_km,
            estimatedDuration: ride.duration_minutes
        }), 'ride:assignment_confirmed');

        logger.info(`Driver ${driverUserId} accepted ride ${rideId}`);

        return {
            rideId:     updatedRide.id,
            rideNumber: updatedRide.ride_number,
            status:     updatedRide.status,
            message:    'Ride accepted successfully'
        };
    } catch (error) {
        logger.error('Accept ride service error:', error);
        throw error;
    }
};

// ═════════════════════════════════════════════════════════════════════════════
//  UPDATE RIDE STATUS
// ═════════════════════════════════════════════════════════════════════════════
export const updateRideStatus = async (driverUserId, rideId, statusData) => {
    try {
        const { status, cancellationReason } = statusData;

        const driver = await driverRepo.findDriverByUserId(driverUserId);
        if (!driver) throw new NotFoundError('Driver not found');

        const ride = await rideRepo.findRideById(rideId);
        if (!ride) throw new NotFoundError('Ride not found');
        if (ride.driver_id !== driver.id) throw new ApiError(403, 'You are not assigned to this ride');

        validateStatusTransition(ride.status, status);

        let additionalFields = {};

        // ── FCM 3a: Ride cancelled (queued) ──────────────────────────────────
        if (status === 'cancelled') {
            additionalFields.cancelled_by        = 'driver';
            additionalFields.cancellation_reason = cancellationReason || 'Driver cancelled';
            await driverRepo.updateDriver(driver.id, { is_on_duty: false });

            if (ride.passenger_fcm_token) {
                await addNotificationJob('ride-cancelled', {
                    fcmToken: ride.passenger_fcm_token,
                    title:    'Ride Cancelled',
                    body:     'Your driver cancelled the ride. Please book again.',
                    data: {
                        type:   'ride_cancelled',
                        rideId: String(rideId),
                        reason: cancellationReason || 'Driver cancelled',
                    },
                });
            }
        }

        // ── FCM 3b: Driver arrived (queued) ──────────────────────────────────
        if (status === 'driver_arrived') {
            if (ride.passenger_fcm_token) {
                await addNotificationJob('driver-arrived', {
                    fcmToken: ride.passenger_fcm_token,
                    title:    'Driver Arrived!',
                    body:     `${driver.full_name} is waiting at your pickup point`,
                    data: {
                        type:   'driver_arrived',
                        rideId: String(rideId),
                    },
                });
            }
        }

        // ── FCM 3c: Ride started (queued) ────────────────────────────────────
        if (status === 'in_progress') {
            if (ride.passenger_fcm_token) {
                await addNotificationJob('ride-started', {
                    fcmToken: ride.passenger_fcm_token,
                    title:    'Ride Started!',
                    body:     `Your ride to ${ride.dropoff_location_name || ride.dropoff_address} has begun`,
                    data: {
                        type:   'ride_started',
                        rideId: String(rideId),
                    },
                });
            }
        }

        // ── Ride completed — critical path + async jobs ───────────────────────
        if (status === 'completed') {
            const completedAt       = new Date();
            const rideWithTimestamp = { ...ride, completed_at: completedAt };
            const finalResult       = await calculateCompletionFare(rideWithTimestamp);

            let passengerFinalFare = finalResult.passenger.finalFare;
            if (ride.is_free_ride) {
                passengerFinalFare = 0;
            } else {
                const subDiscount    = Number(ride.subscription_discount) || 0;
                const couponDiscount = Number(ride.coupon_discount)        || 0;
                passengerFinalFare   = Math.max(0, passengerFinalFare - subDiscount - couponDiscount);
            }

            additionalFields.actual_fare    = passengerFinalFare;
            additionalFields.final_fare     = passengerFinalFare;
            additionalFields.payment_status = 'pending';

            // SYNC: driver ko immediately off-duty karo — naya ride accept kar sake
            await driverRepo.updateDriver(driver.id, { is_on_duty: false });

            // ASYNC: driver stats (total_rides, total_earnings) + coupon recording
            await addRideCompletionJob(rideId, {
                driverId:            driver.id,
                driverTotalRides:    driver.total_rides,
                driverTotalEarnings: driver.total_earnings,
                netEarnings:         finalResult.driver.netEarnings,
                couponId:            ride.coupon_id || null,
                passengerId:         ride.passenger_id,
                couponDiscount:      Number(ride.coupon_discount) || 0,
                finalFare:           finalResult.passenger.finalFare,
            });

            // ASYNC: FCM — passenger ko complete notification
            if (ride.passenger_fcm_token) {
                await addNotificationJob('ride-completed-passenger', {
                    fcmToken: ride.passenger_fcm_token,
                    title:    'Ride Completed!',
                    body:     ride.is_free_ride
                        ? 'Your free ride is complete! Rate your experience.'
                        : `Total fare: Rs.${passengerFinalFare}. Rate your experience!`,
                    data: {
                        type:       'ride_completed',
                        rideId:     String(rideId),
                        finalFare:  String(passengerFinalFare),
                        isFreeRide: String(ride.is_free_ride || false),
                    },
                });
            }

            // ASYNC: FCM — driver ko earnings notification
            if (ride.driver_fcm_token) {
                await addNotificationJob('ride-earnings-driver', {
                    fcmToken: ride.driver_fcm_token,
                    title:    'Ride Earnings',
                    body:     `Ride complete! You earned Rs.${finalResult.driver.netEarnings.toFixed(0)}`,
                    data: {
                        type:        'ride_earnings',
                        rideId:      String(rideId),
                        netEarnings: String(finalResult.driver.netEarnings),
                    },
                });
            }

            logger.info(`Ride ${rideId} final fare: Rs.${passengerFinalFare} (estimated: Rs.${ride.estimated_fare})`);
        }

        const updatedRide = await rideRepo.updateRideStatus(rideId, status, additionalFields);
        logger.info(`Ride ${rideId} status updated to ${status}`);

        // ── SOCKET: broadcast status change to ride room ──────────────────────
        safeEmit(() => emitRideStatusUpdate(rideId, driver.id, ride.passenger_id, status, {
            rideNumber:         updatedRide.ride_number,
            cancellationReason: additionalFields.cancellation_reason || null,
            ...(status === 'completed' && {
                finalFare:            additionalFields.final_fare,
                subscriptionDiscount: Number(ride.subscription_discount) || 0,
                couponDiscount:       Number(ride.coupon_discount) || 0,
                isFreeRide:           ride.is_free_ride || false
            })
        }), `ride:status_changed:${status}`);

        if (status === 'driver_arrived') {
            safeEmit(() => notifyDriverArrival(rideId, ride.passenger_id, driver.id, {
                latitude:  driver.current_latitude,
                longitude: driver.current_longitude
            }), 'ride:driver_arrived');
        }

        return {
            rideId:     updatedRide.id,
            rideNumber: updatedRide.ride_number,
            status:     updatedRide.status,
            ...(status === 'completed' && {
                estimatedFare:        ride.estimated_fare,
                finalFare:            additionalFields.final_fare,
                subscriptionDiscount: Number(ride.subscription_discount) || 0,
                couponDiscount:       Number(ride.coupon_discount)        || 0,
                isFreeRide:           ride.is_free_ride || false
            }),
            message: `Ride status updated to ${status}`
        };
    } catch (error) {
        logger.error('Update ride status service error:', error);
        throw error;
    }
};

// ═════════════════════════════════════════════════════════════════════════════
//  GET RIDE DETAILS
// ═════════════════════════════════════════════════════════════════════════════
export const getRideDetails = async (userId, rideId, userRole) => {
    try {
        const ride = await rideRepo.findRideById(rideId);
        if (!ride) throw new NotFoundError('Ride not found');

        if (userRole === 'passenger' && ride.passenger_id !== userId) {
            throw new ApiError(403, 'You do not have access to this ride');
        }
        if (userRole === 'driver') {
            const driver = await driverRepo.findDriverByUserId(userId);
            if (!driver || ride.driver_id !== driver.id) {
                throw new ApiError(403, 'You do not have access to this ride');
            }
        }

        return formatRideResponse(ride);
    } catch (error) {
        logger.error('Get ride details service error:', error);
        throw error;
    }
};

// ═════════════════════════════════════════════════════════════════════════════
//  RIDE HISTORY
// ═════════════════════════════════════════════════════════════════════════════
export const getPassengerRideHistory = async (userId, { page = 1, limit = 10, status }) => {
    try {
        const offset = (page - 1) * limit;
        const rides  = await rideRepo.findRidesByPassenger(userId, { limit, offset, status });
        const total  = await rideRepo.countRidesByPassenger(userId, status);

        return {
            rides: rides.map(formatRideListResponse),
            pagination: {
                page:  parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        };
    } catch (error) {
        logger.error('Get passenger ride history service error:', error);
        throw error;
    }
};

export const getDriverRideHistory = async (driverUserId, { page = 1, limit = 10, status }) => {
    try {
        const driver = await driverRepo.findDriverByUserId(driverUserId);
        if (!driver) throw new NotFoundError('Driver not found');

        const offset = (page - 1) * limit;
        const rides  = await rideRepo.findRidesByDriver(driver.id, { limit, offset, status });
        const total  = await rideRepo.countRidesByDriver(driver.id, status);

        return {
            rides: rides.map(formatRideListResponse),
            pagination: {
                page:  parseInt(page),
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

// ═════════════════════════════════════════════════════════════════════════════
//  GET CURRENT RIDE
// ═════════════════════════════════════════════════════════════════════════════
export const getCurrentRide = async (userId, userRole) => {
    try {
        let ride;
        if (userRole === 'passenger') {
            ride = await rideRepo.findActiveRideByPassenger(userId);
        } else {
            const driver = await driverRepo.findDriverByUserId(userId);
            if (!driver) throw new NotFoundError('Driver not found');
            ride = await rideRepo.findActiveRideByDriver(driver.id);
        }

        if (!ride) return { hasActiveRide: false };
        return { hasActiveRide: true, ride: formatRideResponse(ride) };
    } catch (error) {
        logger.error('Get current ride service error:', error);
        throw error;
    }
};

// ═════════════════════════════════════════════════════════════════════════════
//  RATE RIDE
// ═════════════════════════════════════════════════════════════════════════════
export const rateRide = async (userId, rideId, rating, review) => {
    try {
        const ride = await rideRepo.findRideById(rideId);
        if (!ride) throw new NotFoundError('Ride not found');
        if (ride.passenger_id !== userId) throw new ApiError(403, 'You are not authorized to rate this ride');
        if (ride.status !== 'completed') throw new ApiError(400, 'Can only rate completed rides');
        if (ride.rating) throw new ApiError(400, 'Ride already rated');

        await rideRepo.rateRide(rideId, rating, review);
        if (ride.driver_id) await updateDriverRating(ride.driver_id);

        // ── FCM 4: Driver ko rating notification ──────────────────────────────
        if (ride.driver_fcm_token) {
            const stars = '⭐'.repeat(Math.min(Math.round(rating), 5));
            await sendNotification(
                ride.driver_fcm_token,
                'New Rating Received!',
                `${stars} You got ${rating} stars${review ? ` — "${review}"` : ''}`,
                {
                    type:   'new_rating',
                    rideId: String(rideId),
                    rating: String(rating),
                }
            );
        }

        return { success: true, message: 'Ride rated successfully' };
    } catch (error) {
        logger.error('Rate ride service error:', error);
        throw error;
    }
};

// ─── Internal Helpers ────────────────────────────────────────────────────────
const validateStatusTransition = (currentStatus, newStatus) => {
    const validTransitions = {
        'requested':       ['driver_assigned', 'cancelled'],
        'driver_assigned': ['driver_arrived', 'cancelled'],
        'driver_arrived':  ['in_progress', 'cancelled'],
        'in_progress':     ['completed'],
        'completed':       [],
        'cancelled':       []
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
        throw new ApiError(400, `Cannot transition from ${currentStatus} to ${newStatus}`);
    }
};

const updateDriverRating = async (driverId) => {
    try {
        await db.query(
            `UPDATE drivers
             SET rating = (
                 SELECT AVG(rating) FROM rides
                 WHERE driver_id = $1 AND rating IS NOT NULL
             )
             WHERE id = $1`,
            [driverId]
        );
    } catch (error) {
        logger.error('Update driver rating error:', error);
    }
};

const formatRideResponse = (ride) => ({
    id:              ride.id,
    rideNumber:      ride.ride_number,
    vehicleType:     ride.vehicle_type,
    pickupAddress:   ride.pickup_address,
    pickupLocation:  { latitude: ride.pickup_latitude,  longitude: ride.pickup_longitude  },
    dropoffAddress:  ride.dropoff_address,
    dropoffLocation: { latitude: ride.dropoff_latitude, longitude: ride.dropoff_longitude },
    distanceKm:      ride.distance_km,
    durationMinutes: ride.duration_minutes,
    estimatedFare:   ride.estimated_fare,
    actualFare:      ride.actual_fare,
    finalFare:       ride.final_fare,
    status:          ride.status,
    paymentStatus:   ride.payment_status,
    paymentMethod:   ride.payment_method,
    requestedAt:     ride.requested_at,
    driverAssignedAt:    ride.driver_assigned_at,
    startedAt:           ride.started_at,
    completedAt:         ride.completed_at,
    cancelledAt:         ride.cancelled_at,
    cancelledBy:         ride.cancelled_by,
    cancellationReason:  ride.cancellation_reason,
    passenger: ride.passenger_name ? {
        name:  ride.passenger_name,
        phone: ride.passenger_phone
    } : null,
    driver: ride.driver_name ? {
        name:          ride.driver_name,
        phone:         ride.driver_phone,
        vehicleType:   ride.vehicle_type,
        vehicleNumber: ride.vehicle_number,
        vehicleModel:  ride.vehicle_model,
        vehicleColor:  ride.vehicle_color
    } : null,
    driverLocation: ride.driver_current_latitude ? {
        latitude:  ride.driver_current_latitude,
        longitude: ride.driver_current_longitude
    } : null,
    rating: ride.rating,
    review: ride.review
});

const formatRideListResponse = (ride) => ({
    id:             ride.id,
    rideNumber:     ride.ride_number,
    vehicleType:    ride.vehicle_type,
    pickupAddress:  ride.pickup_address,
    dropoffAddress: ride.dropoff_address,
    distanceKm:     ride.distance_km,
    estimatedFare:  ride.estimated_fare,
    actualFare:     ride.actual_fare,
    finalFare:      ride.final_fare,
    status:         ride.status,
    paymentStatus:  ride.payment_status,
    requestedAt:    ride.requested_at,
    completedAt:    ride.completed_at,
    passengerName:  ride.passenger_name,
    driverName:     ride.driver_name
});