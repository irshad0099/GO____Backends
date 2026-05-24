import jwt from 'jsonwebtoken';
import { getIO } from '../../config/websocketConfig.js';
import { ENV } from '../../config/envConfig.js';
import redis from '../../config/redis.config.js';
import logger, { logSocketEvent } from '../../core/logger/socketLogger.js';
import {
    registerSocketUser,
    unregisterSocketUser,
    setupRideRoom,
    leaveRideRoom,
    updateDriverLocation,
    getSocketUser,
    emitToPassenger,
    emitToDriver
} from './socket.events.js';
import { calculateDistance, calculateDuration } from '../../core/utils/rideCalculator.js';
import { findRideById, findActiveRideByDriver } from '../../modules/rides/repositories/ride.repository.js';
import { pushPendingRidesToDriver } from '../../modules/rides/services/rideService.js';
import * as driverRepo from '../../modules/drivers/repositories/driver.repository.js';
import {
    storeSessionInRedis,
    getSessionFromRedis,
    queueMessage,
    handleSocketReconnection,
    storeActiveRideSession,
    getActiveRideSession
} from './reconnection.handler.js';
import { addTrackingPoint, getActualDistance, startRideTracking } from './rideTracking.js';
import { pool } from '../../infrastructure/database/postgres.js';
import { formatRideResponse } from '../../modules/rides/services/rideService.js';
import { getDriverLocation } from '../../core/services/redisService.js';
import TrackingService from '../../modules/tracking/services/trackingService.js';

// Debounce map — driver ke last location ka timer track karo
const idleLocationDbTimers = new Map();
const latestIdleLocations = new Map(); // Store latest location for throttle
const IDLE_LOCATION_DB_DELAY = 30_000; // 30 sec baad DB update

// Helper: get user session from in-memory map OR Redis (for reconnection recovery)
const getOrRecoverSocketUser = async (socketId, userId) => {
    let user = getSocketUser(socketId);
    if (user) return user;

    // Fallback: check Redis for previous session
    try {
        const session = await getSessionFromRedis(userId);
        if (session) {
            logger.info('📍 Recovered session from Redis for missing socket', { socketId, userId });
            return session;
        }
    } catch (err) {
        logger.warn('Failed to recover session from Redis', { userId, error: err.message });
    }

    return null;
};

/**
 * Setup all socket event handlers
 */
export const setupSocketHandlers = () => {
    const io = getIO();

    // Har connection pe JWT verify karo — bina token ke connection reject
    io.use((socket, next) => {
        // Accept token from auth object (standard client) OR query (Postman/testing)
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        
        if (!token) {
            return next(new Error('Authentication token required'));
        }
        try {
            const decoded = jwt.verify(token, ENV.JWT_SECRET);
            socket.data.userId   = decoded.userId;
            socket.data.userType = decoded.role;
            next();
        } catch {
            next(new Error('Invalid or expired token'));
        }
    });

    io.on('connection', (socket) => {
        logger.info('🔌 New socket connection', { socketId: socket.id });

        // Har incoming event (client → server) automatically log karo
        socket.onAny((event, ...args) => {
            const user = getSocketUser(socket.id);
            logSocketEvent({
                eventName: event,
                direction: 'in',
                socketId: socket.id,
                userId: user?.userId,
                driverId: user?.driverId,
                rideId: args[0]?.rideId,
                payload: args[0],
                status: 'received'
            });
        });

        // Har outgoing emit (server → client) automatically log karo
        socket.onAnyOutgoing((event, ...args) => {
            const user = getSocketUser(socket.id);
            logSocketEvent({
                eventName: event,
                direction: 'out',
                socketId: socket.id,
                userId: user?.userId,
                driverId: user?.driverId,
                rideId: args[0]?.rideId,
                payload: args[0],
                status: 'sent'
            });
        });

        // ==================== AUTHENTICATION EVENTS ====================

        /**
         * User authentication via socket
         * Client emits: socket.emit('auth:login', { userId, userType, phone })
         */
        socket.on('auth:login', async (data) => {
            try {
                const { phone } = data || {};
                // Token middleware se verified values use karo — client ki values trust mat karo
                const userId   = socket.data.userId;
                const userType = socket.data.userType;

                if (!userId || !userType) {
                    socket.emit('auth:error', { message: 'Authentication failed' });
                    return;
                }

                registerSocketUser(socket, userId, userType, { phone });

                // Store session in Redis for persistence
                await storeSessionInRedis(socket.id, userId, userType, { phone });

                socket.emit('auth:success', {
                    socketId: socket.id,
                    userId,
                    userType,
                    message: 'Authenticated successfully'
                });

                // Driver socket connect pe — agar online ho aur active ride na ho toh pending rides push karo (2 sec delay)
                if (userType === 'driver') {
                    setTimeout(async () => {
                        try {
                            const driver = await driverRepo.findDriverByUserId(userId);
                            if (!driver) return;

                            // Online hai aur active ride nahi hai toh pending rides push karo
                            if (driver.is_available && driver.current_latitude && driver.current_longitude) {
                                const activeRide = await findActiveRideByDriver(driver.id);
                                if (!activeRide && driver.vehicle_type) {
                                    await pushPendingRidesToDriver(userId, driver.vehicle_type, driver.current_latitude, driver.current_longitude);
                                }
                            }
                        } catch (err) {
                            logger.warn(`[Socket Connect] Failed to push pending rides for ${userId}:`, err.message);
                        }
                    }, 2000);
                }

                logger.info('✅ User authenticated via socket', { socketId: socket.id, userId, userType });
            } catch (error) {
                logger.error('❌ Auth error', { socketId: socket.id, error: error.message });
                socket.emit('auth:error', { message: error.message });
            }
        });

        /**
         * Handle reconnection after server restart or network loss
         * Client emits: socket.emit('auth:reconnect', { userId, userType })
         */
        socket.on('auth:reconnect', async (_data) => {
            try {
                // Token middleware se verified values use karo
                const userId   = socket.data.userId;
                const userType = socket.data.userType;

                if (!userId || !userType) {
                    socket.emit('auth:error', { message: 'Authentication failed' });
                    return;
                }

                registerSocketUser(socket, userId, userType);

                // Recover previous state from Redis
                const recoveryData = await handleSocketReconnection(socket, userId, userType);

                // Driver socket reconnect pe — agar online ho aur active ride na ho toh pending rides push karo (2 sec delay)
                if (userType === 'driver') {
                    setTimeout(async () => {
                        try {
                            const driver = await driverRepo.findDriverByUserId(userId);
                            if (!driver) return;

                            // Online hai aur active ride nahi hai toh pending rides push karo
                            if (driver.is_available && driver.current_latitude && driver.current_longitude) {
                                const activeRide = await findActiveRideByDriver(driver.id);
                                if (!activeRide && driver.vehicle_type) {
                                    await pushPendingRidesToDriver(userId, driver.vehicle_type, driver.current_latitude, driver.current_longitude);
                                }
                            }
                        } catch (err) {
                            logger.warn(`[Socket Reconnect] Failed to push pending rides for ${userId}:`, err.message);
                        }
                    }, 2000);
                }

                logger.info('✅ User reconnected', {
                    socketId: socket.id,
                    userId,
                    recoveredData: !!recoveryData
                });
            } catch (error) {
                logger.error('❌ Reconnection error', { socketId: socket.id, error: error.message });
                socket.emit('auth:error', { message: error.message });
            }
        });

        /**
         * User logout
         */
        socket.on('auth:logout', () => {
            unregisterSocketUser(socket.id);
            socket.emit('auth:logout_success', { message: 'Logged out' });
            logger.info('👋 User logged out', { socketId: socket.id });
        });

        // ==================== DRIVER EVENTS ====================

        /**
         * Driver location update
         * Client emits: socket.emit('driver:location_update', { latitude, longitude })
         */
        /**
         * Driver sends location update during active ride
         * Client emits: socket.emit('driver:location_update', { latitude, longitude, rideId })
         * rideId MUST be sent so we only send to that specific ride's passenger
         */
        // socket.on('driver:location_update', async (data) => {
        //     try {
        //         const user = getSocketUser(socket.id);
        //         if (!user || user.userType !== 'driver') {
        //             socket.emit('error', { message: 'Unauthorized' });
        //             return;
        //         }

        //         const { latitude, longitude, rideId, accuracy, speed } = data;

        //         if (!rideId) {
        //             socket.emit('error', { message: 'rideId required for location update' });
        //             return;
        //         }

        //         const location = { latitude, longitude };

        //         // Save to Redis
        //         await updateDriverLocation(user.userId, location, true);

        //         // ONLY send to that specific ride room (driver + passenger joined via ride:join)
        //         io.to(`ride:${rideId}`).emit('driver:map_ping', {
        //             rideId,
        //             driverId: user.userId,
        //             location,
        //             accuracy: accuracy || null,
        //             speed: speed || 0,
        //             timestamp: new Date().toISOString()
        //         });

        //         // ETA calculate karo aur passenger ko bhejo
        //         try {
        //             const ride = await findRideById(rideId);
        //             if (ride) {
        //                 let targetLat, targetLng, etaType;

        //                 if (['driver_assigned', 'driver_arrived'].includes(ride.status)) {
        //                     // Driver pickup pe aa raha hai
        //                     targetLat = ride.pickup_latitude;
        //                     targetLng = ride.pickup_longitude;
        //                     etaType   = 'pickup';
        //                 } else if (ride.status === 'in_progress') {
        //                     // Ride chal rahi hai — dropoff tak ETA
        //                     targetLat = ride.dropoff_latitude;
        //                     targetLng = ride.dropoff_longitude;
        //                     etaType   = 'dropoff';
        //                 }

        //                 if (targetLat && targetLng) {
        //                     const distKm     = calculateDistance(latitude, longitude, targetLat, targetLng);
        //                     const etaMinutes = calculateDuration(distKm, ride.vehicle_type);

        //                     io.to(`ride:${rideId}`).emit('ride:eta_update', {
        //                         rideId,
        //                         etaMinutes,
        //                         distanceKm: distKm,
        //                         etaType,   // 'pickup' ya 'dropoff'
        //                         message: etaType === 'pickup'
        //                             ? `Driver arriving in ${etaMinutes} min`
        //                             : `Reaching destination in ${etaMinutes} min`,
        //                         timestamp: new Date().toISOString()
        //                     });
        //                 }
        //             }
        //         } catch (etaErr) {
        //             logger.warn('ETA calculation failed:', etaErr.message);
        //         }

        //         // Actual distance track karo — sirf in_progress rides ke liye
        //         try {
        //             const rideForTracking = await findRideById(rideId);
        //             if (rideForTracking?.status === 'in_progress') {
        //                 await addTrackingPoint(rideId, latitude, longitude);
        //             }
        //         } catch (trackErr) {
        //             logger.warn('Distance tracking failed:', trackErr.message);
        //         }

        //         logger.debug('📍 Location ping sent to ride room', {
        //             driverId: user.userId,
        //             rideId,
        //             location
        //         });
        //     } catch (error) {
        //         logger.error('❌ Driver location update error', {
        //             socketId: socket.id,
        //             error: error.message
        //         });
        //         socket.emit('error', { message: error.message });
        //     }
        // });

socket.on('driver:location_update', async (data) => {
    try {
        const userId = socket.data.userId;
        let user = getSocketUser(socket.id);

        // Fallback: recover from Redis if in-memory session missing (e.g., after server restart)
        if (!user) {
            user = await getOrRecoverSocketUser(socket.id, userId);
            if (user) {
                registerSocketUser(socket, user.userId, user.userType);
            }
        }

        if (!user || user.userType !== 'driver') {
            socket.emit('error', { message: 'Unauthorized' });
            return;
        }

        const { latitude, longitude, rideId, accuracy, speed } = data;
        if (!rideId) {
            socket.emit('error', { message: 'rideId required' });
            return;
        }

        const location = { latitude, longitude };

        // Save to Redis
        await updateDriverLocation(user.userId, location, true);

        // Map ping — passenger ko location bhejo
        io.to(`ride:${rideId}`).emit('driver:map_ping', {
            rideId,
            driverId: user.userId,
            location,
            accuracy: accuracy || null,
            speed:    speed || 0,
            timestamp: new Date().toISOString()
        });

        // ── Tracking: Save location & broadcast to tracking viewers ─────────
        try {
            const trackingService = new TrackingService();
            await trackingService.recordLocation(rideId, latitude, longitude, accuracy);

            // Broadcast to all tracking viewers (public link)
            const ride = await findRideById(rideId);
            if (ride?.tracking_token) {
                io.to(`tracking:${ride.tracking_token}`).emit('tracking:location-updated', {
                    rideId,
                    latitude,
                    longitude,
                    accuracy: accuracy || null,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (trackingError) {
            logger.warn('Tracking save failed:', trackingError.message);
        }

        // ── Ride fetch — Redis cache (30s) se, warna DB ─────────────────
        let ride = null;
        const rideCacheKey = `ride:active:${rideId}`;
        try {
            const cached = await redis.get(rideCacheKey);
            if (cached) {
                ride = JSON.parse(cached);
            } else {
                ride = await findRideById(rideId);
                if (ride) await redis.setex(rideCacheKey, 30, JSON.stringify(ride));
            }
        } catch {
            ride = await findRideById(rideId);
        }
        if (!ride) return;

        // ── ETA Calculate ─────────────────────────────────────────────────
        try {
            let targetLat, targetLng, etaType;

            if (['driver_assigned', 'driver_arrived'].includes(ride.status)) {
                targetLat = ride.pickup_latitude;
                targetLng = ride.pickup_longitude;
                etaType   = 'pickup';
            } else if (ride.status === 'in_progress') {
                targetLat = ride.dropoff_latitude;
                targetLng = ride.dropoff_longitude;
                etaType   = 'dropoff';
            }

            console.log(`\n[ETA-REALTIME] START`);
            console.log(`  Ride ID: ${rideId}`);
            console.log(`  Ride Status: ${ride.status}`);
            console.log(`  ETA Type: ${etaType}`);
            console.log(`  Target Coords: (${targetLat}, ${targetLng})`);
            console.log(`  Driver Coords: (${latitude}, ${longitude})`);
            console.log(`  Vehicle Type: ${ride.vehicle_type}`);

            if (targetLat && targetLng) {
                const distKm     = calculateDistance(latitude, longitude, targetLat, targetLng);
                console.log(`  Distance Calculated: ${distKm} km`);

                const etaMinutes = calculateDuration(distKm, ride.vehicle_type);
                console.log(`  ETA Minutes: ${etaMinutes} min`);
                console.log(`[ETA-REALTIME] END - Sending: ${etaMinutes} min for ${etaType}\n`);

                io.to(`ride:${rideId}`).emit('ride:eta_update', {
                    rideId,
                    etaMinutes,
                    distanceKm: distKm,
                    etaType,
                    message: etaType === 'pickup'
                        ? `Driver arriving in ${etaMinutes} min`
                        : `Reaching destination in ${etaMinutes} min`,
                    timestamp: new Date().toISOString()
                });
            } else {
                console.log(`[ETA-REALTIME] MISSING COORDS - targetLat: ${targetLat}, targetLng: ${targetLng}\n`);
            }
        } catch (etaErr) {
            console.error('[ETA ERROR]:', etaErr);
            logger.warn('ETA calculation failed:', etaErr.message);
        }

        // ── Distance Tracking + Dynamic Fare ─────────────────────────────
       if (ride.status === 'in_progress') {
    try {
        // Tracking shuru nahi hua toh start karo
        const existingData = await redis.hgetall(`ride:tracking:${rideId}`);
        if (!existingData || !existingData.lastLat) {
            await startRideTracking(rideId, latitude, longitude);
        }
        
        await addTrackingPoint(rideId, latitude, longitude);

                // ── Dynamic Fare Update ───────────────────────────────────
                const trackingData = await getActualDistance(rideId);
                if (trackingData !== null) {
                    // Driven distance se current fare calculate karo
                    const drivenKm      = trackingData;
                    const perKmRate     = Number(ride.distance_fare) / Number(ride.distance_km);
                    const currentFare   = Number(ride.base_fare)
                                       + (drivenKm * perKmRate)
                                       + Number(ride.convenience_fee || 0);

                    // Waiting charges — speed 0 ya null hone pe
                    const isWaiting       = !speed || speed < 2;
                    const waitingPerMin   = 1.5; // Rs per minute
                    const waitingCharges  = 0;   // Future: track waiting time

                    io.to(`ride:${rideId}`).emit('ride:fare_update', {
                        rideId,
                        drivenKm:       Math.round(drivenKm * 100) / 100,
                        currentFare:    Math.round(currentFare * 100) / 100,
                        baseFare:       ride.base_fare,
                        distanceFare:   Math.round(drivenKm * perKmRate * 100) / 100,
                        convenienceFee: ride.convenience_fee || 0,
                        waitingCharges,
                        isWaiting,
                        timestamp:      new Date().toISOString()
                    });
                }
            } catch (trackErr) {
                logger.warn('Distance tracking failed:', trackErr.message);
            }
        }

        logger.debug('📍 Location ping sent', { driverId: user.userId, rideId, location });

    } catch (error) {
        logger.error('❌ Driver location update error', { socketId: socket.id, error: error.message });
        socket.emit('error', { message: error.message });
    }
});


        /**
         * Driver availability toggle
         * Client emits: socket.emit('driver:availability_toggle', { isAvailable: true })
         */
        socket.on('driver:availability_toggle', async (data) => {
            try {
                const userId = socket.data.userId;
                let user = getSocketUser(socket.id);

                if (!user) {
                    user = await getOrRecoverSocketUser(socket.id, userId);
                    if (user) {
                        registerSocketUser(socket, user.userId, user.userType);
                    }
                }

                if (!user || user.userType !== 'driver') {
                    socket.emit('error', { message: 'Unauthorized' });
                    return;
                }

                const { isAvailable } = data;

                // Sirf driver ko acknowledge karo — sabko broadcast nahi
                socket.emit('driver:availability_changed', {
                    driverId: user.userId,
                    isAvailable,
                    timestamp: new Date().toISOString()
                });

                logger.info('🟢 Driver availability toggled', {
                    driverId: user.userId,
                    isAvailable
                });
            } catch (error) {
                logger.error('❌ Driver availability toggle error', {
                    socketId: socket.id,
                    error: error.message
                });
            }
        });

        /**
         * Driver idle location update (online, no active ride)
         * Client emits: socket.emit('driver:idle_location', { latitude, longitude })
         * Redis: turant update — DB: 30 sec throttle (not debounce)
         */
        socket.on('driver:idle_location', async (data) => {
            try {
                const user = getSocketUser(socket.id);
                if (!user || user.userType !== 'driver') return;

                const { latitude, longitude } = data;
                if (!latitude || !longitude) return;

                // Redis — turant update
                await updateDriverLocation(user.userId, { latitude, longitude }, true);

                // Latest location save karo taki timer wahi use kare
                latestIdleLocations.set(user.userId, { latitude, longitude });

                // DB — 30 sec throttle: agar timer nahi hai tabhi naya start karo
                if (!idleLocationDbTimers.has(user.userId)) {
                    const timer = setTimeout(async () => {
                        try {
                            const latestLoc = latestIdleLocations.get(user.userId);
                            if (latestLoc) {
                                await pool.query(
                                    `UPDATE drivers SET current_latitude = $1, current_longitude = $2, updated_at = NOW() WHERE user_id = $3`,
                                    [latestLoc.latitude, latestLoc.longitude, user.userId]
                                );
                                logger.debug('📍 Driver idle location flushed to DB', { driverId: user.userId, ...latestLoc });
                            }
                        } catch (e) {
                            logger.error('❌ Idle location DB flush failed', { driverId: user.userId, error: e.message });
                        } finally {
                            idleLocationDbTimers.delete(user.userId);
                            latestIdleLocations.delete(user.userId);
                        }
                    }, IDLE_LOCATION_DB_DELAY);

                    idleLocationDbTimers.set(user.userId, timer);
                }
            } catch (error) {
                logger.error('❌ Driver idle location error', { socketId: socket.id, error: error.message });
            }
        });

        /**
         * Driver accepts ride request
         * Client emits: socket.emit('ride:accept', { rideId })
         */
        socket.on('ride:accept', async (data) => {
            try {
                const userId = socket.data.userId;
                let user = getSocketUser(socket.id);

                if (!user) {
                    user = await getOrRecoverSocketUser(socket.id, userId);
                    if (user) {
                        registerSocketUser(socket, user.userId, user.userType);
                    }
                }

                if (!user || user.userType !== 'driver') {
                    socket.emit('error', { message: 'Unauthorized' });
                    return;
                }

                const { rideId } = data;

                // Ride se passenger_id nikalo, phir directly emit karo
                const ride = await findRideById(rideId);
                const rideDetails = await formatRideResponse(ride)
                if (ride && ride.passenger_id) {
                    emitToPassenger(ride.passenger_id, 'ride:accepted', rideDetails);

                    // ── ETA Calculate on accept (first ETA to passenger) ──────────
                    try {
                        console.log(`\n[ETA-ACCEPT] START - Ride ${rideId}`);
                        const driver = await driverRepo.findDriverByUserId(user.userId);

                        console.log(`  Driver Found: ${!!driver}`);
                        if (driver) {
                            console.log(`  Driver Coords: (${driver.current_latitude}, ${driver.current_longitude})`);
                            console.log(`  Pickup Coords: (${ride.pickup_latitude}, ${ride.pickup_longitude})`);
                        }

                        if (driver && driver.current_latitude && driver.current_longitude && ride.pickup_latitude && ride.pickup_longitude) {
                            const distKm = calculateDistance(
                                driver.current_latitude, driver.current_longitude,
                                ride.pickup_latitude, ride.pickup_longitude
                            );
                            console.log(`  Distance Calculated: ${distKm} km`);

                            const etaMinutes = calculateDuration(distKm, ride.vehicle_type);
                            console.log(`  Vehicle Type: ${ride.vehicle_type}`);
                            console.log(`  ETA Minutes: ${etaMinutes} min`);
                            console.log(`[ETA-ACCEPT] END - Sending ${etaMinutes} min to passenger\n`);

                            emitToPassenger(ride.passenger_id, 'ride:eta_update', {
                                rideId,
                                etaMinutes,
                                distanceKm: distKm,
                                etaType: 'pickup',
                                message: `Driver arriving in ${etaMinutes} min`,
                                timestamp: new Date().toISOString()
                            });
                        } else {
                            console.log(`[ETA-ACCEPT] MISSING DATA - Driver: ${!!driver}, Coords valid: ${driver && driver.current_latitude && driver.current_longitude}, Pickup: ${ride.pickup_latitude && ride.pickup_longitude}\n`);
                        }
                    } catch (etaErr) {
                        console.log(`[ETA-ACCEPT] ERROR: ${etaErr.message}\n`);
                    }
                }

                // Driver ko bhi acknowledge karo
                socket.emit('ride:accepted', {
                    rideId,
                    driverId: user.userId,
                    timestamp: new Date().toISOString()
                });

                logger.info('✅ Ride accepted by driver', { rideId, driverId: user.userId });
            } catch (error) {
                logger.error('❌ Ride accept error', { socketId: socket.id, error: error.message });
            }
        });

        /**
         * Driver rejects ride request
         * Client emits: socket.emit('ride:reject', { rideId, reason })
         */
        socket.on('ride:reject', async (data) => {
            try {
                const userId = socket.data.userId;
                let user = getSocketUser(socket.id);

                if (!user) {
                    user = await getOrRecoverSocketUser(socket.id, userId);
                    if (user) {
                        registerSocketUser(socket, user.userId, user.userType);
                    }
                }

                if (!user || user.userType !== 'driver') {
                    socket.emit('error', { message: 'Unauthorized' });
                    return;
                }

                const { rideId, reason } = data;

                // Ride se passenger_id nikalo, phir directly emit karo
                const ride = await findRideById(rideId);
                if (ride && ride.passenger_id) {
                    emitToPassenger(ride.passenger_id, 'ride:rejected', {
                        rideId,
                        driverId: user.userId,
                        reason,
                        timestamp: new Date().toISOString()
                    });
                }

                logger.info('❌ Ride rejected by driver', { rideId, driverId: user.userId, reason });
            } catch (error) {
                logger.error('❌ Ride reject error', { socketId: socket.id, error: error.message });
            }
        });

        // ==================== RIDE EVENTS ====================

        /**
         * Join ride room (for real-time updates during active ride)
         * Client emits: socket.emit('ride:join', { rideId, rideData })
         */
        socket.on('ride:join', async (data) => {
            try {
                const user = getSocketUser(socket.id);
                if (!user) {
                    socket.emit('error', { message: 'Unauthorized' });
                    return;
                }

                const { rideId, rideData = {} } = data;

                // ── Ownership check — sirf passenger ya assigned driver join kar sakta hai ──
                const ride = await findRideById(rideId);
                if (!ride) {
                    socket.emit('error', { message: 'Ride not found' });
                    return;
                }

                if (user.userType === 'passenger') {
                    if (ride.passenger_id !== user.userId) {
                        socket.emit('error', { message: 'Unauthorized: not your ride' });
                        logger.warn('🚫 Unauthorized ride:join attempt (passenger)', {
                            userId: user.userId, rideId, ridePassengerId: ride.passenger_id
                        });
                        return;
                    }
                } else if (user.userType === 'driver') {
                    const driver = await driverRepo.findDriverByUserId(user.userId);
                    if (!driver || ride.driver_id !== driver.id) {
                        socket.emit('error', { message: 'Unauthorized: not your ride' });
                        logger.warn('🚫 Unauthorized ride:join attempt (driver)', {
                            userId: user.userId, rideId, rideDriverId: ride.driver_id, driverId: driver?.id
                        });
                        return;
                    }
                } else {
                    socket.emit('error', { message: 'Unauthorized' });
                    return;
                }

                setupRideRoom(socket, rideId, user.userId, user.userType);

                // Store active ride session in Redis
                await storeActiveRideSession(user.userId, user.userType, rideId, rideData);

                socket.emit('ride:joined', { rideId, message: 'Joined ride room' });

                logger.info('✅ User joined ride room', {
                    rideId,
                    userId: user.userId,
                    userType: user.userType
                });
            } catch (error) {
                logger.error('❌ Ride join error', { socketId: socket.id, error: error.message });
            }
        });

        /**
         * Leave ride room
         * Client emits: socket.emit('ride:leave', { rideId })
         */
        socket.on('ride:leave', (data) => {
            try {
                const { rideId } = data;
                leaveRideRoom(socket, rideId);

                socket.emit('ride:left', { rideId, message: 'Left ride room' });

                logger.info('✅ User left ride room', { rideId, socketId: socket.id });
            } catch (error) {
                logger.error('❌ Ride leave error', { socketId: socket.id, error: error.message });
            }
        });

        /**
         * Send ride update (driver can update ride status)
         * Client emits: socket.emit('ride:update', { rideId, status })
         */
        socket.on('ride:update', (data) => {
            try {
                const user = getSocketUser(socket.id);
                if (!user) {
                    socket.emit('error', { message: 'Unauthorized' });
                    return;
                }

                const { rideId, status } = data;

                io.to(`ride:${rideId}`).emit('ride:status_changed', {
                    rideId,
                    status,
                    updatedBy: user.userId,
                    userType: user.userType,
                    timestamp: new Date().toISOString()
                });

                logger.info('📤 Ride status update sent', { rideId, status, userId: user.userId });
            } catch (error) {
                logger.error('❌ Ride update error', { socketId: socket.id, error: error.message });
            }
        });

        // ==================== CHAT EVENTS ====================

        /**
         * Send chat message
         * Client emits: socket.emit('chat:send', { rideId, message })
         */
        socket.on('chat:send', (data) => {
            try {
                const user = getSocketUser(socket.id);
                if (!user) {
                    socket.emit('error', { message: 'Unauthorized' });
                    return;
                }

                const { rideId, message } = data;

                io.to(`ride:${rideId}`).emit('chat:new_message', {
                    rideId,
                    senderId: user.userId,
                    senderType: user.userType,
                    message,
                    timestamp: new Date().toISOString()
                });

                logger.debug('💬 Chat message sent', { rideId, senderId: user.userId });
            } catch (error) {
                logger.error('❌ Chat send error', { socketId: socket.id, error: error.message });
            }
        });

        /**
         * User is typing indicator
         * Client emits: socket.emit('chat:typing', { rideId })
         */
        socket.on('chat:typing', (data) => {
            try {
                const user = getSocketUser(socket.id);
                if (!user) return;

                const { rideId } = data;

                io.to(`ride:${rideId}`).emit('chat:user_typing', {
                    rideId,
                    userId: user.userId,
                    userType: user.userType
                });
            } catch (error) {
                logger.error('❌ Chat typing error', { socketId: socket.id, error: error.message });
            }
        });

        // ==================== DISCONNECT ====================

        socket.on('disconnect', () => {
            const user = getSocketUser(socket.id);
            unregisterSocketUser(socket.id);

            logger.info('🔌 Socket disconnected', {
                socketId: socket.id,
                userId: user?.userId
            });
        });

        socket.on('error', (error) => {
            logger.error('❌ Socket error', { socketId: socket.id, error });
        });
    });
};

export default {
    setupSocketHandlers
};
