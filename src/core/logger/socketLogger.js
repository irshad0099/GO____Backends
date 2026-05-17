import logger from './logger.js';

let _pool = null;

export function initSocketLogger(pool) {
    _pool = pool;
}

// Safeify karta hai data ko — tokens/passwords hata do, size limit lagao
function sanitize(data) {
    if (!data || typeof data !== 'object') return data;
    const SENSITIVE = ['token', 'password', 'otp', 'secret', 'authorization'];
    const clean = Array.isArray(data) ? [...data] : { ...data };
    for (const key of Object.keys(clean)) {
        if (SENSITIVE.some(s => key.toLowerCase().includes(s))) {
            clean[key] = '[REDACTED]';
        }
    }
    return clean;
}

/**
 * Log socket event (request or response) — har emit/listener ke liye call hota hai
 * @param {string} eventName - Proper event name (e.g., 'driver:location_update', 'ride:eta_update')
 * @param {string} direction - 'in' (client→server) or 'out' (server→client)
 * @param {string} socketId - Socket connection ID
 * @param {string} userId - User ID (UUID)
 * @param {number} driverId - Driver ID (for driver events)
 * @param {number} rideId - Ride ID (if applicable)
 * @param {object} payload - Request or response payload
 * @param {string} status - 'success', 'error', 'pending'
 * @param {string} errorMessage - Error message if status is 'error'
 */
export function logSocketEvent({ eventName, direction, socketId, userId, driverId, rideId, payload, status, errorMessage }) {
    if (!_pool) return;

    const sanitizedPayload = payload ? sanitize(payload) : null;

    // Log to console first
    logger.info(`[socket:${direction}] ${eventName}`, {
        socketId,
        userId,
        driverId,
        rideId,
        status,
        payload: sanitizedPayload,
        error: errorMessage
    });

    // Insert into database
    _pool.query(
        `INSERT INTO socket_logs (event_name, direction, socket_id, user_id, driver_id, ride_id, request_payload, response_payload, status, error_message, created_at)
         VALUES (
             $1, $2, $3, $4, $5, $6,
             CASE WHEN $2 = 'in' THEN $7 ELSE NULL END,
             CASE WHEN $2 = 'out' THEN $7 ELSE NULL END,
             $8, $9, NOW()
         )`,
        [
            eventName,
            direction,
            socketId,
            userId || null,
            driverId || null,
            rideId || null,
            sanitizedPayload ? JSON.stringify(sanitizedPayload) : null,
            status,
            errorMessage || null
        ]
    ).catch(err => logger.error('Socket log insert failed:', { error: err.message, eventName, socketId }));
}

const socketLogger = {
    info(message, meta) { logger.info(message, meta); },
    error(message, meta) { logger.error(message, meta); },
    warn(message, meta) { logger.warn(message, meta); },
    debug(message, meta) { logger.debug(message, meta); },
};

export default socketLogger;
