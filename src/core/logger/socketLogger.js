import logger from './logger.js';

let _pool = null;

export function initSocketLogger(pool) {
    _pool = pool;
}

function extractMeta(meta) {
    if (!meta || typeof meta !== 'object') return { socket_id: null, user_id: null, ride_id: null, event: null };
    return {
        socket_id: meta.socketId || null,
        user_id: meta.userId ? Number(meta.userId) : null,
        ride_id: meta.rideId ? Number(meta.rideId) : null,
        event: meta.event || null,
    };
}

function dbLog(level, message, meta, direction = null) {
    if (!_pool) return;
    const { socket_id, user_id, ride_id, event } = extractMeta(meta);
    _pool.query(
        `INSERT INTO socket_logs (level, event, direction, message, socket_id, user_id, ride_id, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [level, event, direction, message, socket_id, user_id, ride_id, meta ? JSON.stringify(meta) : null]
    ).catch(() => {});
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
    const str = JSON.stringify(clean);
    // 10KB se bada payload truncate karo
    return str.length > 10240 ? { _truncated: true, preview: str.slice(0, 200) } : clean;
}

/**
 * Har socket event (in/out) ke liye direct DB insert — onAny/onAnyOutgoing se call hota hai.
 */
export function logSocketEvent({ direction, event, socketId, userId, rideId, data }) {
    if (!_pool) return;
    logger.debug(`[socket:${direction}] ${event}`, { socketId, userId, event });
    _pool.query(
        `INSERT INTO socket_logs (level, event, direction, message, socket_id, user_id, ride_id, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
            'event',
            event,
            direction,
            `[${direction}] ${event}`,
            socketId || null,
            userId ? Number(userId) : null,
            rideId ? Number(rideId) : null,
            data !== undefined ? JSON.stringify(sanitize(data)) : null,
        ]
    ).catch(() => {});
}

const socketLogger = {
    info(message, meta) { logger.info(message, meta); dbLog('info', message, meta); },
    error(message, meta) { logger.error(message, meta); dbLog('error', message, meta); },
    warn(message, meta) { logger.warn(message, meta); dbLog('warn', message, meta); },
    debug(message, meta) { logger.debug(message, meta); dbLog('debug', message, meta); },
};

export default socketLogger;
