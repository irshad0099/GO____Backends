import { getIO } from '../../config/websocketConfig.js';
import logger from '../../core/logger/logger.js';
import redis from '../../config/redis.config.js';

/**
 * Socket event handlers for real-time features
 */

// Socket connection store: { socketId -> { userId, userType, phone, ... } }
const connectedSockets = new Map();

/**
 * Register a user's socket connection
 */
export const registerSocketUser = (socket, userId, userType, metadata = {}) => {
    connectedSockets.set(socket.id, {
        userId,
        userType,
        socketId: socket.id,
        ...metadata
    });

    logger.debug('✅ Socket user registered', { socketId: socket.id, userId, userType });
};

/**
 * Unregister socket user on disconnect
 */
export const unregisterSocketUser = (socketId) => {
    const user = connectedSockets.get(socketId);
    if (user) {
        connectedSockets.delete(socketId);
        logger.debug('✅ Socket user unregistered', { socketId, userId: user.userId });
    }
};

/**
 * Get socket user by socket ID
 */
export const getSocketUser = (socketId) => {
    return connectedSockets.get(socketId);
};

/**
 * Get all connected sockets for a user
 */
export const getUserSockets = (userId) => {
    const sockets = [];
    for (const [socketId, user] of connectedSockets.entries()) {
        if (user.userId === userId) {
            sockets.push(socketId);
        }
    }
    return sockets;
};

/**
 * Get all drivers and their locations from Redis
 */
export const getAvailableDrivers = async (radius = 5000) => {
    try {
        const drivers = await redis.get('available_drivers');
        return drivers ? JSON.parse(drivers) : [];
    } catch (error) {
        logger.error('❌ Failed to get available drivers', { error: error.message });
        return [];
    }
};

/**
 * Store driver location and availability
 */
export const updateDriverLocation = async (driverId, location, isAvailable = true) => {
    try {
        const drivers = await getAvailableDrivers();
        const index = drivers.findIndex(d => d.driverId === driverId);

        const driverData = {
            driverId,
            location,
            isAvailable,
            updatedAt: new Date().toISOString()
        };

        if (index >= 0) {
            drivers[index] = driverData;
        } else {
            drivers.push(driverData);
        }

        await redis.setEx('available_drivers', 3600, JSON.stringify(drivers)); // 1 hour TTL
        logger.debug('✅ Driver location updated', { driverId, location });
    } catch (error) {
        logger.error('❌ Failed to update driver location', { driverId, error: error.message });
    }
};

/**
 * Emit to specific user (all their connected sockets)
 */
export const emitToUser = (userId, event, data) => {
    const io = getIO();
    const sockets = getUserSockets(userId);

    sockets.forEach(socketId => {
        io.to(socketId).emit(event, data);
    });

    logger.debug('📤 Event emitted to user', { userId, event, socketCount: sockets.length });
};

/**
 * Emit to driver
 */
export const emitToDriver = (driverId, event, data) => {
    emitToUser(driverId, event, data);
};

/**
 * Emit to passenger
 */
export const emitToPassenger = (passengerId, event, data) => {
    emitToUser(passengerId, event, data);
};

/**
 * Broadcast to all connected sockets
 */
export const broadcastEvent = (event, data) => {
    const io = getIO();
    io.emit(event, data);
    logger.debug('📢 Event broadcasted', { event });
};

/**
 * Emit ride status update
 */
export const emitRideStatusUpdate = (rideId, driverId, passengerId, status, data = {}) => {
    emitToDriver(driverId, 'ride:status_update', {
        rideId,
        status,
        ...data
    });

    emitToPassenger(passengerId, 'ride:status_update', {
        rideId,
        status,
        ...data
    });

    logger.info('📤 Ride status update sent', { rideId, status });
};

/**
 * Emit driver location update (for passenger tracking)
 */
export const emitDriverLocation = (rideId, driverId, passengerId, location) => {
    emitToPassenger(passengerId, 'ride:driver_location_update', {
        rideId,
        driverId,
        location,
        timestamp: new Date().toISOString()
    });

    logger.debug('📍 Driver location update sent', { rideId, driverId });
};

/**
 * Emit new ride request to available drivers
 */
export const emitRideRequest = (rideId, passengerId, pickupLocation, dropoffLocation, estimatedFare) => {
    const io = getIO();

    io.emit('ride:new_request', {
        rideId,
        passengerId,
        pickupLocation,
        dropoffLocation,
        estimatedFare,
        timestamp: new Date().toISOString()
    });

    logger.info('📤 Ride request broadcasted to all drivers', { rideId });
};

/**
 * Emit chat message
 */
export const emitChatMessage = (rideId, senderId, senderType, message) => {
    const io = getIO();

    io.to(`ride:${rideId}`).emit('chat:message', {
        rideId,
        senderId,
        senderType,
        message,
        timestamp: new Date().toISOString()
    });

    logger.debug('💬 Chat message emitted', { rideId, senderId });
};

/**
 * Setup ride event room for driver and passenger
 */
export const setupRideRoom = (socket, rideId, userId, userType) => {
    const roomName = `ride:${rideId}`;
    socket.join(roomName);

    logger.debug('✅ User joined ride room', { roomName, userId, userType });

    return roomName;
};

/**
 * Leave ride room
 */
export const leaveRideRoom = (socket, rideId) => {
    const roomName = `ride:${rideId}`;
    socket.leave(roomName);

    logger.debug('✅ User left ride room', { roomName });
};

/**
 * Get connected users count
 */
export const getConnectedUsersCount = () => {
    return connectedSockets.size;
};

/**
 * Get user status (online/offline)
 */
export const isUserOnline = (userId) => {
    for (const user of connectedSockets.values()) {
        if (user.userId === userId) {
            return true;
        }
    }
    return false;
};

export default {
    registerSocketUser,
    unregisterSocketUser,
    getSocketUser,
    getUserSockets,
    getAvailableDrivers,
    updateDriverLocation,
    emitToUser,
    emitToDriver,
    emitToPassenger,
    broadcastEvent,
    emitRideStatusUpdate,
    emitDriverLocation,
    emitRideRequest,
    emitChatMessage,
    setupRideRoom,
    leaveRideRoom,
    getConnectedUsersCount,
    isUserOnline
};
