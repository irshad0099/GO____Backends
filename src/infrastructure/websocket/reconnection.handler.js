/**
 * Socket.IO Reconnection & Data Persistence Handler
 *
 * Handles:
 * - Client auto-reconnection on disconnect
 * - Session persistence in Redis
 * - Message queue during disconnection
 * - State recovery on reconnection
 */

import redis from '../../config/redis.config.js';
import logger from '../../core/logger/logger.js';
import { getIO } from '../../config/websocketConfig.js';

// Session key pattern in Redis: session:{userId}:{socketId}
const SESSION_KEY_PREFIX = 'socket_session';
const MESSAGE_QUEUE_PREFIX = 'msg_queue';
const SESSION_TTL = 86400; // 24 hours

/**
 * Store user session in Redis for persistence
 * Survives server restarts
 */
export const storeSessionInRedis = async (socketId, userId, userType, metadata = {}) => {
    try {
        const sessionData = {
            socketId,
            userId,
            userType,
            connectedAt: new Date().toISOString(),
            ...metadata
        };

        const key = `${SESSION_KEY_PREFIX}:${userId}`;

        // Store in Redis with 24-hour TTL
        await redis.setEx(
            key,
            SESSION_TTL,
            JSON.stringify(sessionData)
        );

        logger.info('✅ Session stored in Redis', { userId, socketId, key });
        return sessionData;
    } catch (error) {
        logger.error('❌ Failed to store session', { userId, error: error.message });
        return null;
    }
};

/**
 * Retrieve user session from Redis
 * Check if user was previously connected
 */
export const getSessionFromRedis = async (userId) => {
    try {
        const key = `${SESSION_KEY_PREFIX}:${userId}`;
        const sessionData = await redis.get(key);

        if (sessionData) {
            logger.info('✅ Session retrieved from Redis', { userId });
            return JSON.parse(sessionData);
        }

        return null;
    } catch (error) {
        logger.error('❌ Failed to retrieve session', { userId, error: error.message });
        return null;
    }
};

/**
 * Destroy session from Redis
 */
export const destroySessionFromRedis = async (userId) => {
    try {
        const key = `${SESSION_KEY_PREFIX}:${userId}`;
        await redis.del(key);

        logger.info('✅ Session destroyed', { userId });
    } catch (error) {
        logger.error('❌ Failed to destroy session', { userId, error: error.message });
    }
};

/**
 * Queue a message while user is disconnected
 * Will be delivered when user reconnects
 */
export const queueMessage = async (userId, event, data) => {
    try {
        const queueKey = `${MESSAGE_QUEUE_PREFIX}:${userId}`;

        const message = {
            event,
            data,
            queuedAt: new Date().toISOString()
        };

        // Add to queue (list) with 24-hour TTL
        await redis.rPush(queueKey, JSON.stringify(message));
        await redis.expire(queueKey, SESSION_TTL);

        logger.debug('📨 Message queued', { userId, event });
        return message;
    } catch (error) {
        logger.error('❌ Failed to queue message', { userId, error: error.message });
        return null;
    }
};

/**
 * Get all queued messages for a user
 * Called on reconnection
 */
export const getQueuedMessages = async (userId) => {
    try {
        const queueKey = `${MESSAGE_QUEUE_PREFIX}:${userId}`;

        const messages = await redis.lRange(queueKey, 0, -1);

        if (messages.length > 0) {
            logger.info('📬 Retrieved queued messages', { userId, count: messages.length });
            return messages.map(msg => JSON.parse(msg));
        }

        return [];
    } catch (error) {
        logger.error('❌ Failed to get queued messages', { userId, error: error.message });
        return [];
    }
};

/**
 * Clear message queue after delivery
 */
export const clearMessageQueue = async (userId) => {
    try {
        const queueKey = `${MESSAGE_QUEUE_PREFIX}:${userId}`;
        await redis.del(queueKey);

        logger.debug('🗑️ Message queue cleared', { userId });
    } catch (error) {
        logger.error('❌ Failed to clear queue', { userId, error: error.message });
    }
};

/**
 * Store active ride session
 * Track which rides are in progress for recovery
 */
export const storeActiveRideSession = async (userId, userType, rideId, rideData) => {
    try {
        const key = `active_ride:${userId}`;

        const sessionData = {
            rideId,
            userType,
            userId,
            startedAt: new Date().toISOString(),
            ...rideData
        };

        // Store with 1-hour TTL (rides don't last long)
        await redis.setEx(key, 3600, JSON.stringify(sessionData));

        logger.info('🚗 Active ride session stored', { userId, rideId });
        return sessionData;
    } catch (error) {
        logger.error('❌ Failed to store ride session', { userId, rideId, error: error.message });
        return null;
    }
};

/**
 * Get active ride session
 */
export const getActiveRideSession = async (userId) => {
    try {
        const key = `active_ride:${userId}`;
        const sessionData = await redis.get(key);

        if (sessionData) {
            logger.info('🚗 Active ride session retrieved', { userId });
            return JSON.parse(sessionData);
        }

        return null;
    } catch (error) {
        logger.error('❌ Failed to get ride session', { userId, error: error.message });
        return null;
    }
};

/**
 * Clear active ride session
 */
export const clearActiveRideSession = async (userId) => {
    try {
        const key = `active_ride:${userId}`;
        await redis.del(key);

        logger.debug('🗑️ Ride session cleared', { userId });
    } catch (error) {
        logger.error('❌ Failed to clear ride session', { userId, error: error.message });
    }
};

/**
 * Recover user state on reconnection
 * Returns all relevant data to restore UI state
 */
export const recoverUserState = async (userId) => {
    try {
        logger.info('🔄 Starting user state recovery', { userId });

        // Get session data
        const session = await getSessionFromRedis(userId);

        // Get active ride
        const activeRide = await getActiveRideSession(userId);

        // Get queued messages
        const queuedMessages = await getQueuedMessages(userId);

        const recoveryData = {
            session,
            activeRide,
            queuedMessages,
            recoveredAt: new Date().toISOString()
        };

        logger.info('✅ User state recovered', {
            userId,
            hasSession: !!session,
            hasActiveRide: !!activeRide,
            messageCount: queuedMessages.length
        });

        return recoveryData;
    } catch (error) {
        logger.error('❌ Failed to recover user state', { userId, error: error.message });
        return null;
    }
};

/**
 * Store driver location history
 * For tracking and analytics
 */
export const storeLocationHistory = async (driverId, location, rideId = null) => {
    try {
        const historyKey = `location_history:${driverId}`;

        const locationEntry = {
            location,
            rideId,
            timestamp: new Date().toISOString()
        };

        // Keep last 100 locations, 7-day TTL
        await redis.lPush(historyKey, JSON.stringify(locationEntry));
        await redis.lTrim(historyKey, 0, 99);
        await redis.expire(historyKey, 604800); // 7 days

        logger.debug('📍 Location stored in history', { driverId });
    } catch (error) {
        logger.error('❌ Failed to store location history', { driverId, error: error.message });
    }
};

/**
 * Get driver location history
 */
export const getLocationHistory = async (driverId, limit = 10) => {
    try {
        const historyKey = `location_history:${driverId}`;
        const locations = await redis.lRange(historyKey, 0, limit - 1);

        if (locations.length > 0) {
            return locations.map(loc => JSON.parse(loc));
        }

        return [];
    } catch (error) {
        logger.error('❌ Failed to get location history', { driverId, error: error.message });
        return [];
    }
};

/**
 * Handle socket reconnection event
 * Called when client reconnects
 */
export const handleSocketReconnection = async (socket, userId, userType) => {
    try {
        logger.info('🔌 Socket reconnection started', { socketId: socket.id, userId });

        // Store new session
        await storeSessionInRedis(socket.id, userId, userType);

        // Recover all previous state
        const recoveryData = await recoverUserState(userId);

        // Send recovery data to client
        socket.emit('reconnection:recovery', {
            success: true,
            data: recoveryData,
            message: 'State recovered from previous session'
        });

        // Deliver all queued messages
        if (recoveryData?.queuedMessages && recoveryData.queuedMessages.length > 0) {
            recoveryData.queuedMessages.forEach(msg => {
                socket.emit(msg.event, msg.data);
            });

            // Clear the queue after delivery
            await clearMessageQueue(userId);

            logger.info('📬 Queued messages delivered', {
                userId,
                count: recoveryData.queuedMessages.length
            });
        }

        // If user has an active ride, rejoin the ride room
        if (recoveryData?.activeRide) {
            const rideId = recoveryData.activeRide.rideId;
            socket.join(`ride:${rideId}`);

            logger.info('✅ Rejoined ride room', { userId, rideId });

            // Notify other participants
            const io = getIO();
            io.to(`ride:${rideId}`).emit('ride:participant_reconnected', {
                userId,
                userType,
                rideId,
                timestamp: new Date().toISOString()
            });
        }

        return recoveryData;
    } catch (error) {
        logger.error('❌ Socket reconnection failed', { userId, error: error.message });
        socket.emit('reconnection:error', {
            success: false,
            message: error.message
        });
        return null;
    }
};

export default {
    storeSessionInRedis,
    getSessionFromRedis,
    destroySessionFromRedis,
    queueMessage,
    getQueuedMessages,
    clearMessageQueue,
    storeActiveRideSession,
    getActiveRideSession,
    clearActiveRideSession,
    recoverUserState,
    storeLocationHistory,
    getLocationHistory,
    handleSocketReconnection
};
