import logger from './logger.js';

let _pool = null;

export function initAppLogger(pool) {
    _pool = pool;
}

/**
 * Log application event to database
 * @param {string} logType - 'api', 'socket', 'auth', 'database', 'business'
 * @param {string} level - 'info', 'error', 'warn', 'debug'
 * @param {string} message - Log message
 * @param {object} options - Additional details
 */
export function logEvent({
    logType,
    level,
    message,
    module,
    eventName,
    userId,
    driverId,
    rideId,
    status,
    metadata,
    errorMessage,
    stackTrace
}) {
    // Log to console first
    logger[level](message, { logType, eventName, userId, driverId, rideId });

    // Log to database if pool available
    if (!_pool) return;

    _pool.query(
        `INSERT INTO app_logs (level, log_type, message, module, event_name, user_id, driver_id, ride_id, status, metadata, error_message, stack_trace, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`,
        [
            level,
            logType,
            message,
            module || null,
            eventName || null,
            userId || null,
            driverId || null,
            rideId || null,
            status || null,
            metadata ? JSON.stringify(metadata) : null,
            errorMessage || null,
            stackTrace || null
        ]
    ).catch(err => {
        console.error('[APP_LOG_ERROR]', err.message);
    });
}

export default { logEvent, initAppLogger };
