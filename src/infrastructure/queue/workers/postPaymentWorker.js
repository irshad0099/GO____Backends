import { pool } from '../../database/postgres.js';
import logger from '../../../core/logger/logger.js';
import { creditDriverEarnings } from '../../../modules/drivers/services/earningsService.js';

// ─────────────────────────────────────────────────────────────────────────────
//  Post-Payment Worker
//  Processes online payment confirmations (card/UPI) and:
//  1. Updates ride.payment_status to 'paid'
//  2. Credits driver earnings
//  3. Emits socket events to passenger and driver
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Process a successful online payment
 * Called after Razorpay/Stripe webhook confirms payment
 * @param {Object} data — { rideId, paymentOrderId, passengerUserId, driverUserId, amount }
 */
export const processOnlinePaymentSuccess = async (data) => {
    const { rideId, paymentOrderId, passengerUserId, driverUserId, amount } = data;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Idempotency check — already processed?
        const existing = await client.query(
            `SELECT payment_status FROM rides WHERE id = $1`,
            [rideId]
        );

        if (!existing.rows[0]) {
            throw new Error(`Ride ${rideId} not found`);
        }

        if (existing.rows[0].payment_status === 'paid') {
            await client.query('ROLLBACK');
            logger.info(`[PostPayment] Ride ${rideId} already marked as paid — skipping`);
            return { success: true, alreadyProcessed: true };
        }

        if (existing.rows[0].payment_status === 'collected_by_driver') {
            await client.query('ROLLBACK');
            logger.warn(`[PostPayment] Ride ${rideId} was cash-collected — cannot mark as online paid`);
            throw new Error('Ride was already paid via cash collection');
        }

        // 2. Get ride details for commission calculation
        const rideResult = await client.query(
            `SELECT final_fare, actual_fare, commission_rate, driver_id, passenger_id
             FROM rides WHERE id = $1`,
            [rideId]
        );
        const ride = rideResult.rows[0];

        // 3. Calculate splits
        const finalFare = parseFloat(ride.final_fare || ride.actual_fare || amount);
        const commissionRate = parseFloat(ride.commission_rate || process.env.DEFAULT_COMMISSION_RATE || 0.20);
        const platformFee = Math.round(finalFare * commissionRate * 100) / 100;
        const netEarnings = Math.round((finalFare - platformFee) * 100) / 100;

        // 4. Update ride payment status
        await client.query(
            `UPDATE rides
             SET payment_status = 'paid',
                 payment_order_id = $1,
                 platform_share = $2,
                 payment_completed_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [paymentOrderId, platformFee, rideId]
        );

        // 5. Credit driver earnings
        const driverCreditResult = await creditDriverEarnings({
            driverUserId: driverUserId || ride.driver_id,
            rideId,
            netEarnings,
            platformFee,
            paymentMethod: 'online', // card/upi combined as 'online'
        });

        await client.query('COMMIT');

        logger.info(
            `[PostPayment] Online payment processed | Ride: ${rideId} | Fare: ₹${finalFare} | Net: ₹${netEarnings}`
        );

        return {
            success: true,
            rideId,
            paymentStatus: 'paid',
            driverEarnings: {
                netEarnings,
                platformFee,
                walletBalance: driverCreditResult.data?.walletBalance,
            },
            alreadyProcessed: false,
        };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`[PostPayment] processOnlinePaymentSuccess error | Ride: ${rideId}:`, error);
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Process corporate billing ride
 * Called when a corporate ride completes
 * Driver is credited immediately, platform assumes collection risk
 * @param {Object} data — { rideId, driverUserId, amount }
 */
export const processCorporateBilling = async (data) => {
    const { rideId, driverUserId, amount } = data;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Idempotency check
        const existing = await client.query(
            `SELECT payment_status FROM rides WHERE id = $1`,
            [rideId]
        );

        if (existing.rows[0]?.payment_status === 'billed_corporate') {
            await client.query('ROLLBACK');
            return { success: true, alreadyProcessed: true };
        }

        // Calculate splits
        const commissionRate = parseFloat(process.env.DEFAULT_COMMISSION_RATE || 0.20);
        const platformFee = Math.round(amount * commissionRate * 100) / 100;
        const netEarnings = Math.round((amount - platformFee) * 100) / 100;

        // Update ride status
        await client.query(
            `UPDATE rides
             SET payment_status = 'billed_corporate',
                 platform_share = $1,
                 billing_type = 'corporate',
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [platformFee, rideId]
        );

        // Credit driver immediately (platform assumes risk)
        const driverCreditResult = await creditDriverEarnings({
            driverUserId,
            rideId,
            netEarnings,
            platformFee,
            paymentMethod: 'corporate',
        });

        await client.query('COMMIT');

        logger.info(`[PostPayment] Corporate billing processed | Ride: ${rideId} | Net: ₹${netEarnings}`);

        return {
            success: true,
            rideId,
            paymentStatus: 'billed_corporate',
            driverEarnings: {
                netEarnings,
                platformFee,
                walletBalance: driverCreditResult.data?.walletBalance,
            },
        };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`[PostPayment] processCorporateBilling error | Ride: ${rideId}:`, error);
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Queue processor wrapper for Bull/BullMQ integration
 * This function can be registered as a job processor
 */
export const postPaymentProcessor = async (job) => {
    const { type, data } = job;

    try {
        switch (type) {
            case 'online_payment_success':
                return await processOnlinePaymentSuccess(data);
            case 'corporate_billing':
                return await processCorporateBilling(data);
            default:
                throw new Error(`Unknown post-payment job type: ${type}`);
        }
    } catch (error) {
        logger.error(`[PostPayment] Job failed | Type: ${type}:`, error);
        throw error; // Re-throw for BullMQ retry
    }
};
