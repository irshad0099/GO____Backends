import { Queue } from 'bullmq';
import { getRedisConnectionOptions } from './queue.config.js';
import logger from '../../core/logger/logger.js';

const connection = getRedisConnectionOptions();

// ── Ride Completion Queue ─────────────────────────────────────────────────────
// Driver stats update + coupon recording — ride complete hone ke baad async
export const rideCompletionQueue = new Queue('ride-completion', {
    connection,
    defaultJobOptions: {
        attempts:         3,
        backoff:          { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail:     { count: 500 },
    },
});

// ── Notification Queue ────────────────────────────────────────────────────────
// FCM push notifications — passenger + driver dono ke liye
export const notificationQueue = new Queue('notifications', {
    connection,
    defaultJobOptions: {
        attempts:         3,
        backoff:          { type: 'exponential', delay: 1000 },
        removeOnComplete: { count: 200 },
        removeOnFail:     { count: 500 },
    },
});

// ── Job Adders ────────────────────────────────────────────────────────────────

/**
 * Ride complete hone pe driver stats + coupon ka async job queue karo.
 * Agar queue fail ho, core HTTP response affect nahi hoga.
 */
export const addRideCompletionJob = async (rideId, data) => {
    try {
        await rideCompletionQueue.add('complete', { rideId, ...data }, { jobId: `ride-complete-${rideId}` });
        logger.info(`[Queue] ride-completion job added | rideId: ${rideId}`);
    } catch (err) {
        // Queue fail hone pe ride stuck nahi hona chahiye — sirf log karo
        logger.error(`[Queue] ride-completion job add failed | rideId: ${rideId} | ${err.message}`);
    }
};

/**
 * FCM notification async bhejo.
 * @param {string} type - job type label (e.g. 'ride-completed', 'driver-arrived')
 * @param {object} data - { fcmToken, title, body, data }
 */
export const addNotificationJob = async (type, data) => {
    try {
        await notificationQueue.add(type, data);
        logger.info(`[Queue] notification job added: ${type}`);
    } catch (err) {
        logger.error(`[Queue] notification job add failed: ${type} | ${err.message}`);
    }
};
