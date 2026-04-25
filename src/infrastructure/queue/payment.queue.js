import { Queue } from 'bullmq';
import { getRedisConnectionOptions } from './queue.config.js';
import logger from '../../core/logger/logger.js';

const connection = getRedisConnectionOptions();

// ── Payment Post-Action Queue ─────────────────────────────────────────────────
// Razorpay webhook confirm hone ke baad — wallet recharge, subscription activate etc.
// 5 attempts: payment related actions critical hain, zyada retry chahiye
export const paymentQueue = new Queue('payment-actions', {
    connection,
    defaultJobOptions: {
        attempts:         5,
        backoff:          { type: 'exponential', delay: 3000 },
        removeOnComplete: { count: 200 },
        removeOnFail:     { count: 1000 },
    },
});

/**
 * Payment confirm hone ke baad post-action async queue karo.
 * e.g., wallet recharge, subscription activation
 * @param {object} order - payment order object from DB
 */
export const addPaymentPostActionJob = async (order) => {
    try {
        // Idempotency key: same order ki duplicate processing rok
        await paymentQueue.add('post-payment', { order }, {
            jobId: `payment-${order.order_number}`,
        });
        logger.info(`[Queue] payment post-action job added | order: ${order.order_number}`);
    } catch (err) {
        logger.error(`[Queue] payment post-action job add failed | order: ${order.order_number} | ${err.message}`);
    }
};
