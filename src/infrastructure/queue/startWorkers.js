import logger from '../../core/logger/logger.js';

/**
 * Saare BullMQ workers start karo.
 * Server start hone ke baad ek baar call karo.
 *
 * Workers dynamically import hote hain taaki:
 * 1. Circular dependency issues na hon
 * 2. Worker imports sirf tab ho jab server ready ho
 */
export const startWorkers = async () => {
    try {
        await Promise.all([
            import('./workers/notificationWorker.js'),
            import('./workers/rideCompletionWorker.js'),
            import('./workers/paymentWorker.js'),
        ]);
        logger.info('✅ BullMQ workers started: notification, ride-completion, payment');
    } catch (err) {
        // Worker start fail hone pe server band nahi hona chahiye
        // Worst case: queue mein jobs jam jayenge, next restart pe process honge
        logger.error(`❌ BullMQ workers start failed: ${err.message}`);
    }
};
