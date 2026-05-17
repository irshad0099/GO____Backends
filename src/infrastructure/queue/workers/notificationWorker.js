import { Worker } from 'bullmq';
import { getRedisConnectionOptions } from '../queue.config.js';
import { sendNotification } from '../../../core/services/firebaseService.js';
import logger from '../../../core/logger/logger.js';

const connection = getRedisConnectionOptions();

/**
 * Notification Worker — FCM push notifications async bhejta hai.
 *
 * Expected job.data shape:
 * {
 *   fcmToken: string,
 *   title:    string,
 *   body:     string,
 *   data:     object   // FCM data payload
 * }
 *
 * concurrency: 10 — ek saath 10 notifications process kar sakta hai
 */
const notificationWorker = new Worker('notifications', async (job) => {
    try {
        const { fcmToken, title, body, data } = job.data;

        // ── Validation ─────────────────────────────────────────────────────────
        if (!fcmToken) {
            logger.warn(`[NotificationWorker] FCM token missing | job: ${job.id} (${job.name}) — skipping`);
            return { skipped: true, reason: 'no_fcm_token' };
        }

        if (!title || !body) {
            logger.warn(`[NotificationWorker] Title/Body missing | job: ${job.id} (${job.name}) — skipping`);
            return { skipped: true, reason: 'missing_content' };
        }

        // ── Send notification ──────────────────────────────────────────────────
        await sendNotification(fcmToken, title, body, data);
        logger.info(`[NotificationWorker] ✅ Sent: ${job.name} | jobId: ${job.id} | type: ${data?.type || 'unknown'}`);
        return { sent: true, jobName: job.name, type: data?.type };
    } catch (error) {
        logger.error(`[NotificationWorker] ❌ Job failed | jobId: ${job.id} | name: ${job.name} | error: ${error.message}`);
        throw error; // BullMQ will retry based on job config
    }
}, {
    connection,
    concurrency: 10,
});

notificationWorker.on('failed', (job, err) => {
    logger.error(`[NotificationWorker] Job ${job?.id} (${job?.name}) failed after ${job?.attemptsMade} attempts: ${err.message}`);
});

notificationWorker.on('error', (err) => {
    logger.error(`[NotificationWorker] Worker error: ${err.message}`);
});

export default notificationWorker;
