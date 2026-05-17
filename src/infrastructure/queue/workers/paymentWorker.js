import { Worker } from 'bullmq';
import { getRedisConnectionOptions } from '../queue.config.js';
import { rechargeWallet } from '../../../modules/wallet/services/walletService.js';
import { creditDriverEarnings } from '../../../modules/drivers/services/earningsService.js';
import { pool } from '../../database/postgres.js';
import logger from '../../../core/logger/logger.js';

const connection = getRedisConnectionOptions();

/**
 * Payment Post-Action Worker — Razorpay webhook confirm hone ke baad ka kaam.
 *
 * Handles:
 *  - wallet_recharge: user wallet mein amount credit karo
 *  - ride_payment: driver earnings, company earnings, transactions credit karo
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

    if (order.purpose === 'ride_payment' && order.ride_id) {
        const rideRow = await pool.query(
            `SELECT r.driver_id, r.duration_minutes, r.final_fare, r.platform_share, r.payment_method,
                    d.user_id AS driver_user_id
             FROM rides r
             JOIN drivers d ON d.id = r.driver_id
             WHERE r.id = $1`,
            [order.ride_id]
        );

        const ride = rideRow.rows[0];
        if (!ride) {
            logger.warn(`[PaymentWorker] Ride not found | ride_id: ${order.ride_id} | order: ${order.order_number}`);
        } else {
            const finalFare    = parseFloat(ride.final_fare  || order.amount);
            const platformFee  = parseFloat(ride.platform_share || 0);
            const netEarnings  = parseFloat((finalFare - platformFee).toFixed(2));

            await creditDriverEarnings({
                driverUserId:    ride.driver_user_id,
                rideId:          order.ride_id,
                netEarnings,
                platformFee,
                paymentMethod:   order.payment_method,
                durationMinutes: ride.duration_minutes || 0,
            });

            logger.info(`[PaymentWorker] Driver earnings credited ₹${netEarnings} | ride: ${order.ride_id} | order: ${order.order_number}`);
        }
    }

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
