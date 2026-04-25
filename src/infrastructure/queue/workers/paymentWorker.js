import { Worker } from 'bullmq';
import { getRedisConnectionOptions } from '../queue.config.js';
import { rechargeWallet } from '../../../modules/wallet/services/walletService.js';
import logger from '../../../core/logger/logger.js';

const connection = getRedisConnectionOptions();

/**
 * Payment Post-Action Worker — Razorpay webhook confirm hone ke baad ka kaam.
 *
 * Handles:
 *  - wallet_recharge: user wallet mein amount credit karo
 *  - (future) subscription: activate karo
 *  - (future) tip: driver ko credit karo
 *
 * Expected job.data shape:
 * {
 *   order: {
 *     id, order_number, user_id, amount,
 *     purpose, payment_method, payment_gateway,
 *     gateway_payment_id, ...
 *   }
 * }
 *
 * jobId = `payment-${order_number}` — duplicate processing automatically rukta hai
 */
const paymentWorker = new Worker('payment-actions', async (job) => {
    const { order } = job.data;

    logger.info(`[PaymentWorker] Processing | order: ${order.order_number} | purpose: ${order.purpose} | job: ${job.id}`);

    if (order.purpose === 'wallet_recharge') {
        await rechargeWallet(order.user_id, {
            amount:                  parseFloat(order.amount),
            payment_method:          order.payment_method,
            payment_gateway:         order.payment_gateway,
            gateway_transaction_id:  order.gateway_payment_id,
            description:             'Wallet recharge via payment gateway',
        });
        logger.info(`[PaymentWorker] Wallet recharged ₹${order.amount} | user: ${order.user_id} | order: ${order.order_number}`);
    }
    // Aur purposes add karo jab subscription, tip etc. implement hoon

    logger.info(`[PaymentWorker] Done | order: ${order.order_number}`);
    return { success: true };
}, {
    connection,
    concurrency: 5,
    // Payment jobs mein rate limit — zyada concurrent calls Razorpay ko confuse na kare
    limiter: {
        max:      10,
        duration: 1000,
    },
});

paymentWorker.on('failed', (job, err) => {
    logger.error(`[PaymentWorker] Job ${job?.id} failed after ${job?.attemptsMade} attempts | order: ${job?.data?.order?.order_number} | ${err.message}`);
});

paymentWorker.on('error', (err) => {
    logger.error(`[PaymentWorker] Worker error: ${err.message}`);
});

export default paymentWorker;
