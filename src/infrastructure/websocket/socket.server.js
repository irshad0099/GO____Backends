import { getIO } from '../../config/websocketConfig.js';
import logger from '../../core/logger/logger.js';
import {
    registerSocketUser,
    unregisterSocketUser,
    setupRideRoom,
    leaveRideRoom,
    updateDriverLocation,
    getSocketUser
} from './socket.events.js';
import { calculateDistance, calculateDuration } from '../../core/utils/rideCalculator.js';
import { findRideById } from '../../modules/rides/repositories/ride.repository.js';
import {
    storeSessionInRedis,
    queueMessage,
    handleSocketReconnection,
    storeActiveRideSession,
    getActiveRideSession
} from './reconnection.handler.js';
import { addTrackingPoint } from './rideTracking.js';

/**
 * Setup all socket event handlers
 */
export const setupSocketHandlers = () => {
    const io = getIO();

    io.on('connection', (socket) => {
        logger.info('🔌 New socket connection', { socketId: socket.id });

        // ==================== AUTHENTICATION EVENTS ====================

        /**
         * User authentication via socket
         * Client emits: socket.emit('auth:login', { userId, userType, phone })
         */
        socket.on('auth:login', async (data) => {
            try {
                const { userId, userType, phone } = data;

                if (!userId || !userType) {
                    socket.emit('auth:error', { message: 'Missing userId or userType' });
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
        socket.on('auth:reconnect', async (data) => {
            try {
                const { userId, userType } = data;

                if (!userId || !userType) {
                    socket.emit('auth:error', { message: 'Missing userId or userType' });
                    return;
                }

                registerSocketUser(socket, userId, userType);

                // Recover previous state from Redis
                const recoveryData = await handleSocketReconnection(socket, userId, userType);

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
        socket.on('driver:location_update', async (data) => {
            try {
                const user = getSocketUser(socket.id);
                if (!user || user.userType !== 'driver') {
                    socket.emit('error', { message: 'Unauthorized' });
                    return;
                }

                const { latitude, longitude, rideId, accuracy, speed } = data;

                if (!rideId) {
                    socket.emit('error', { message: 'rideId required for location update' });
                    return;
                }

                const location = { latitude, longitude };

                // Save to Redis
                await updateDriverLocation(user.userId, location, true);

                // ONLY send to that specific ride room (driver + passenger joined via ride:join)
                io.to(`ride:${rideId}`).emit('driver:map_ping', {
                    rideId,
                    driverId: user.userId,
                    location,
                    accuracy: accuracy || null,
                    speed: speed || 0,
                    timestamp: new Date().toISOString()
                });

                // ETA calculate karo aur passenger ko bhejo
                try {
                    const ride = await findRideById(rideId);
                    if (ride) {
                        let targetLat, targetLng, etaType;

                        if (['driver_assigned', 'driver_arrived'].includes(ride.status)) {
                            // Driver pickup pe aa raha hai
                            targetLat = ride.pickup_latitude;
                            targetLng = ride.pickup_longitude;
                            etaType   = 'pickup';
                        } else if (ride.status === 'in_progress') {
                            // Ride chal rahi hai — dropoff tak ETA
                            targetLat = ride.dropoff_latitude;
                            targetLng = ride.dropoff_longitude;
                            etaType   = 'dropoff';
                        }

                        if (targetLat && targetLng) {
                            const distKm     = calculateDistance(latitude, longitude, targetLat, targetLng);
                            const etaMinutes = calculateDuration(distKm, ride.vehicle_type);

                            io.to(`ride:${rideId}`).emit('ride:eta_update', {
                                rideId,
                                etaMinutes,
                                distanceKm: distKm,
                                etaType,   // 'pickup' ya 'dropoff'
                                message: etaType === 'pickup'
                                    ? `Driver arriving in ${etaMinutes} min`
                                    : `Reaching destination in ${etaMinutes} min`,
                                timestamp: new Date().toISOString()
                            });
                        }
                    }
                } catch (etaErr) {
                    logger.warn('ETA calculation failed:', etaErr.message);
                }

                // Actual distance track karo — sirf in_progress rides ke liye
                try {
                    const rideForTracking = await findRideById(rideId);
                    if (rideForTracking?.status === 'in_progress') {
                        await addTrackingPoint(rideId, latitude, longitude);
                    }
                } catch (trackErr) {
                    logger.warn('Distance tracking failed:', trackErr.message);
                }

                logger.debug('📍 Location ping sent to ride room', {
                    driverId: user.userId,
                    rideId,
                    location
                });
            } catch (error) {
                logger.error('❌ Driver location update error', {
                    socketId: socket.id,
                    error: error.message
                });
                socket.emit('error', { message: error.message });
            }
        });

        /**
         * Driver availability toggle
         * Client emits: socket.emit('driver:availability_toggle', { isAvailable: true })
         */
        socket.on('driver:availability_toggle', async (data) => {
            try {
                const user = getSocketUser(socket.id);
                if (!user || user.userType !== 'driver') {
                    socket.emit('error', { message: 'Unauthorized' });
                    return;
                }

                const { isAvailable } = data;

                io.emit('driver:availability_changed', {
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
         * Driver accepts ride request
         * Client emits: socket.emit('ride:accept', { rideId })
         */
        socket.on('ride:accept', (data) => {
            try {
                const user = getSocketUser(socket.id);
                if (!user || user.userType !== 'driver') {
                    socket.emit('error', { message: 'Unauthorized' });
                    return;
                }

                const { rideId } = data;

                // Notify all (ride will be removed from other drivers' lists by backend)
                io.emit('ride:accepted', {
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
        socket.on('ride:reject', (data) => {
            try {
                const user = getSocketUser(socket.id);
                if (!user || user.userType !== 'driver') {
                    socket.emit('error', { message: 'Unauthorized' });
                    return;
                }

                const { rideId, reason } = data;

                io.emit('ride:rejected', {
                    rideId,
                    driverId: user.userId,
                    reason,
                    timestamp: new Date().toISOString()
                });

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
