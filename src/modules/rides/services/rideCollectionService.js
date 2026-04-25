// ─────────────────────────────────────────────────────────────────────────────
//  RIDE COLLECTION SERVICE
//
//  Driver ka one-click "paise mil gaye" button backend.
//
//  Passenger ko 4 options dikhte hain: wallet / upi / cash / corporate.
//  `cash` ke andar driver ke paas do sub-options hote hain (sirf driver-side detail):
//    - cash         → passenger ne actual cash note hath mein diya
//    - personal_upi → passenger ne driver ki personal UPI pe scan kar ke diya
//  Dono economically same hain — platform ke paas paisa nahi aaya, driver ke paas gaya,
//  aur platform_share driver ko deposit karna hoga.
//
//  Cases handled:
//   A. Ride already collected_by_driver → idempotent 200 (driver dobara tap karega).
//   B. Ride online tha (upi/card/upi_qr) + passenger ne abhi tak pay nahi kiya
//      → driver ne direct liya → switch to 'cash' + tag actual sub-method:
//         - pending Razorpay order cancel + QR close
//         - driver wallet credit netEarnings
//         - driver_cash_balance mein platform_share pending add
//         - notify passenger
//   C. Online payment already 'paid' → block (double-collection na ho).
//   D. Corporate ride → block (company billing hai, driver se collect nahi).
//   E. Ride status != 'completed' → block.
// ─────────────────────────────────────────────────────────────────────────────

import { pool } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';
import { ApiError, NotFoundError } from '../../../core/errors/ApiError.js';

import * as rideRepo   from '../repositories/ride.repository.js';
import * as driverRepo from '../../drivers/repositories/driver.repository.js';
import * as cashRepo   from '../../drivers/repositories/cashCollection.repository.js';
import {
    getActivePaymentOrderByRideId,
    updatePaymentOrderStatus,
} from '../../payments/repositories/payment.Repository.js';
import { creditDriverEarnings } from '../../wallet/services/walletService.js';
import { closeDynamicQR } from '../../../infrastructure/external/payment.gateway.js';
import { emitToPassenger, emitToDriver } from '../../../infrastructure/websocket/socket.events.js';
import { addNotificationJob } from '../../../infrastructure/queue/rideQueue.js';

const ALLOWED_METHODS = new Set(['cash', 'personal_upi']);

const safeEmit = (fn, label) => {
    try { fn(); } catch (err) { logger.warn(`[Collect] socket emit failed (${label}): ${err.message}`); }
};

/**
 * Driver confirms money received directly.
 *
 * @param {string} driverUserId - auth user id of driver
 * @param {number} rideId
 * @param {object} body - { method: 'cash' | 'personal_upi' }
 */
export const confirmManualCollection = async (driverUserId, rideId, { method }) => {
    if (!ALLOWED_METHODS.has(method)) {
        throw new ApiError(400, `Invalid collection method: ${method}. Allowed: cash, personal_upi`);
    }

    // ── Ownership + state validation ─────────────────────────────────────────
    const driver = await driverRepo.findDriverByUserId(driverUserId);
    if (!driver) throw new NotFoundError('Driver profile');

    const ride = await rideRepo.findRideById(rideId);
    if (!ride) throw new NotFoundError('Ride');
    if (ride.driver_id !== driver.id) {
        throw new ApiError(403, 'You are not assigned to this ride');
    }
    if (ride.status !== 'completed') {
        throw new ApiError(400, 'Ride is not completed yet');
    }
    if (ride.is_free_ride) {
        throw new ApiError(400, 'Free rides have nothing to collect');
    }
    if (ride.payment_method === 'corporate') {
        throw new ApiError(409, 'Corporate rides are billed directly to the company — no manual collection');
    }

    // ── Idempotency: already collected_by_driver with same method → no-op ────
    if (ride.payment_status === 'collected_by_driver' && ride.collection_confirmed_at) {
        return {
            success: true,
            message: 'Collection already confirmed',
            data: {
                rideId,
                method:      ride.collection_method_actual || ride.payment_method,
                finalFare:   parseFloat(ride.final_fare || ride.actual_fare || 0),
                alreadyConfirmed: true,
            },
        };
    }

    // ── Block if already settled online ──────────────────────────────────────
    if (ride.payment_status === 'paid') {
        throw new ApiError(409, 'Payment already settled online — cannot switch to manual collection');
    }
    if (ride.payment_status === 'refunded') {
        throw new ApiError(409, 'Ride was refunded — cannot collect');
    }

    const finalFare    = parseFloat(ride.final_fare || ride.actual_fare || 0);
    const platformFee  = parseFloat(ride.platform_share || 0);
    // netEarnings derive from fare − platform share (driver stats already applied at completion)
    const netEarnings  = Math.max(0, finalFare - platformFee);

    if (finalFare <= 0) {
        throw new ApiError(400, 'Nothing to collect for this ride');
    }

    // ── Cancel any pending online order + close QR ──────────────────────────
    const pendingOrder = await getActivePaymentOrderByRideId(rideId, 'ride_payment');

    // ── Do the work in a single transaction ──────────────────────────────────
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        if (pendingOrder) {
            await updatePaymentOrderStatus(client, pendingOrder.id, 'failed', {
                failureReason: `Switched to manual collection (${method}) by driver`,
            });
            logger.info(`[Collect] Cancelled pending online order ${pendingOrder.order_number} for ride ${rideId}`);

            // If dynamic QR was active, try closing it
            try {
                await closeDynamicQR(rideId);
            } catch (qrErr) {
                logger.warn(`[Collect] QR close failed (non-critical): ${qrErr.message}`);
            }
        }

        // ── 3. Idempotent insert into cash_collections ─────────────────────────
        const existingCash = await cashRepo.getCashCollectionByRideId(client, rideId);
        if (existingCash) {
            await client.query('COMMIT');
            return {
                success: true,
                message: 'Cash collection already recorded',
                data: {
                    rideId,
                    method: existingCash.collection_method,
                    finalFare,
                    netEarnings,
                    platformShareDue: platformFee,
                    alreadyConfirmed: true,
                },
            };
        }

        await cashRepo.createCashCollection(client, {
            rideId,
            driverId: driver.id,
            passengerId: ride.passenger_id,
            finalFare,
            platformFee,
            netEarnings,
            method,                 // 'cash' | 'personal_upi'
            status: 'confirmed',  // default status
        });

        // ── 4. Update rides row ─────────────────────────────────────────────────
        await client.query(
            `UPDATE rides
                SET payment_status = 'collected_by_driver',
                    collection_method_actual = $1,
                    platform_share = $2,
                    collection_confirmed_at = NOW(),
                    updated_at = NOW()
              WHERE id = $3`,
            [method, platformFee, rideId]
        );

        // ── 5. Credit driver wallet (net earnings) ─────────────────────────────
        // IMPORTANT: Use the same wallet service as online payments for consistency
        await creditDriverEarnings({
            userId: driver.user_id,   // driver users table id
            amount: netEarnings,
            rideId,
            description: `Earnings for ride #${ride.ride_number} (manual collection: ${method})`,
        });

        // ── 6. Update driver cash_balance (platform share due) ─────────────────
        if (platformFee > 0) {
            await driverRepo.incrementDriverCashBalance(client, driver.id, platformFee);
        }

        await client.query('COMMIT');

        // ── 7. Async side effects (non-blocking) ───────────────────────────────
        safeEmit(() => emitToPassenger(ride.passenger_id, 'ride:payment_settled', {
            rideId,
            amount: finalFare,
            method,
            platformFee,
            message: `Driver confirmed ${method} payment received`,
        }), 'passenger');

        safeEmit(() => emitToDriver(driverUserId, 'driver:earnings_credited', {
            rideId,
            netEarnings,
            method,
            walletUpdated: true,
        }), 'driver');

        // Add notification job for receipt email/SMS
        await addNotificationJob('send-collection-receipt', {
            rideId,
            passengerId: ride.passenger_id,
            driverId: driver.id,
            finalFare,
            method,
        });

        logger.info(`[Collect] Manual collection confirmed | Ride: ${rideId} | Driver: ${driver.id} | Method: ${method} | Fare: ₹${finalFare}`);

        return {
            success: true,
            message: 'Cash collection confirmed successfully',
            data: {
                rideId,
                method,
                finalFare,
                netEarnings,
                platformShareDue: platformFee,
                cashBalanceUpdated: platformFee > 0,
            },
        };
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        logger.error(`[Collect] confirmManualCollection error | Ride: ${rideId}:`, error);
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Get collection status for a ride
 * @param {number} userId — user ID (driver or passenger)
 * @param {number} rideId — ride ID
 * @param {string} role — 'driver' | 'passenger'
 */
export const getCollectionStatus = async (userId, rideId, role) => {
    try {
        const ride = await rideRepo.findRideById(rideId);
        if (!ride) {
            throw new NotFoundError('Ride not found');
        }

        // Authorization check
        if (role === 'driver') {
            const driver = await driverRepo.findDriverByUserId(userId);
            if (!driver || ride.driver_id !== driver.id) {
                throw new NotFoundError('You are not assigned to this ride');
            }
        } else if (role === 'passenger') {
            if (ride.passenger_id !== userId) {
                throw new NotFoundError('This is not your ride');
            }
        }

        const isCollectable = ride.status === 'completed' &&
                              ride.payment_method === 'cash' &&
                              ride.payment_status === 'pending';

        return {
            success: true,
            data: {
                rideId: ride.id,
                rideNumber: ride.ride_number,
                status: ride.status,
                paymentStatus: ride.payment_status,
                paymentMethod: ride.payment_method,
                finalFare: parseFloat(ride.final_fare || ride.actual_fare || 0),
                isCollectable,
                collectionConfirmedAt: ride.collection_confirmed_at,
                collectionMethodActual: ride.collection_method_actual,
            },
        };
    } catch (error) {
        logger.error(`[Collection] getCollectionStatus error | Ride: ${rideId}:`, error);
        throw error;
    }
};

/**
 * Cron job: Flag rides with pending cash collection older than 2 hours
 * Called by scheduled job to alert admin for manual review
 */
export const flagStaleCashCollections = async () => {
    try {
        const result = await pool.query(
            `UPDATE rides
             SET payment_status = 'admin_review_required',
                 admin_flag_reason = 'Cash collection not confirmed within 2 hours',
                 updated_at = CURRENT_TIMESTAMP
             WHERE status = 'completed'
               AND payment_method = 'cash'
               AND payment_status = 'pending'
               AND completed_at < CURRENT_TIMESTAMP - INTERVAL '2 hours'
             RETURNING id, ride_number, driver_id`
        );

        if (result.rows.length > 0) {
            logger.warn(`[Collection] Flagged ${result.rows.length} rides for admin review (stale cash collection)`);
        }

        return {
            success: true,
            flaggedCount: result.rows.length,
            rides: result.rows,
        };
    } catch (error) {
        logger.error('[Collection] flagStaleCashCollections error:', error);
        throw error;
    }
};
