import { getIO } from '../../config/websocketConfig.js';
import logger from '../../core/logger/socketLogger.js';
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
// export const getUserSockets = (userId) => {
//     const sockets = [];
//     for (const [socketId, user] of connectedSockets.entries()) {
//         if (user.userId === userId) {
//             sockets.push(socketId);
//         }
//     }
//     return sockets;
// };


export const getUserSockets = (userId) => {
    const sockets = [];
    const targetId = String(userId); // ++ String mein convert karo
    for (const [socketId, user] of connectedSockets.entries()) {
        if (String(user.userId) === targetId) { // ++ dono String compare karo
            sockets.push(socketId);
        }
    }
    return sockets;
};

const DRIVER_LOC_HASH  = 'driver:locations';  // Redis Hash — ek field per driver
const DRIVER_LOC_TTL   = 3600;                 // 1 hour inactivity ke baad expire

/**
 * Get all drivers and their locations from Redis Hash
 * Ek blob nahi — individual fields hain, race condition nahi
 */
export const getAvailableDrivers = async () => {
    try {
        const raw = await redis.hgetall(DRIVER_LOC_HASH);
        if (!raw) return [];
        return Object.values(raw).map(v => JSON.parse(v));
    } catch (error) {
        logger.error('❌ Failed to get available drivers', { error: error.message });
        return [];
    }
};

/**
 * Store driver location — individual Redis Hash field per driver
 * Atomic hSet — koi race condition nahi
 */
export const updateDriverLocation = async (driverId, location, isAvailable = true) => {
    try {
        const driverData = {
            driverId,
            location,
            isAvailable,
            updatedAt: new Date().toISOString()
        };
        const isNew = await redis.hset(DRIVER_LOC_HASH, String(driverId), JSON.stringify(driverData));
        // Expire sirf tab set karo jab naya field add hua — har ping pe nahi
        if (isNew) await redis.expire(DRIVER_LOC_HASH, DRIVER_LOC_TTL);
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
