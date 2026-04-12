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
    const { fcmToken, title, body, data } = job.data;

    if (!fcmToken) {
        // FCM token nahi hai — silently skip, retry ka koi fayda nahi
        logger.warn(`[NotificationWorker] FCM token missing | job: ${job.id} (${job.name}) — skipping`);
        return { skipped: true, reason: 'no_fcm_token' };
    }

    await sendNotification(fcmToken, title, body, data);
    logger.info(`[NotificationWorker] Sent: ${job.name} | job: ${job.id}`);
    return { sent: true };
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
