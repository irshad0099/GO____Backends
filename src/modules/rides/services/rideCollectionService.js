<<<<<<< HEAD
import { pool } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';
import { NotFoundError } from '../../../core/errors/ApiError.js';
import * as rideRepo from '../repositories/ride.repository.js';
import * as driverRepo from '../../drivers/repositories/driver.repository.js';
import { creditDriverEarnings } from '../../drivers/services/earningsService.js';
import { updatePaymentOrderStatus, getActivePaymentOrderByRideId } from '../../payments/repositories/payment.Repository.js';

// ─────────────────────────────────────────────────────────────────────────────
//  Cash Collection Service — Driver confirms cash/personal UPI collection
//  Called when driver taps "Paise mil gaye" / "Collected" in app
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Confirm cash collection by driver
 * @param {number} driverUserId — driver user ID (from JWT)
 * @param {number} rideId — ride ID
 * @param {Object} data — { collection_method: 'cash' | 'personal_upi' }
 */
export const confirmCashCollection = async (driverUserId, rideId, {
    collection_method = 'cash'
}) => {
=======
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
>>>>>>> 14c146dabe2491c7238ceb55d507474f5b956c15
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

<<<<<<< HEAD
        // 1. Fetch ride with validation
        const ride = await rideRepo.findRideById(rideId);
        if (!ride) {
            throw new NotFoundError('Ride not found');
        }

        // Verify driver is assigned to this ride
        const driver = await driverRepo.findDriverByUserId(driverUserId);
        if (!driver || ride.driver_id !== driver.id) {
            throw new NotFoundError('You are not assigned to this ride');
        }

        // Only completed rides can have cash collected
        if (ride.status !== 'completed') {
            const err = new Error('Ride must be completed before collection');
            err.statusCode = 400;
            throw err;
        }

        // Check if already collected or paid
        if (ride.payment_status === 'collected_by_driver') {
            await client.query('ROLLBACK');
            return {
                success: true,
                message: 'Collection already confirmed',
                alreadyConfirmed: true,
            };
        }

        if (ride.payment_status === 'paid') {
            const err = new Error('Ride is already paid via online method');
            err.statusCode = 400;
            throw err;
        }

        // 2. Calculate splits
        const finalFare = parseFloat(ride.final_fare || ride.actual_fare || 0);
        const commissionRate = parseFloat(ride.commission_rate || process.env.DEFAULT_COMMISSION_RATE || 0.20);
        const platformFee = Math.round(finalFare * commissionRate * 100) / 100;
        const netEarnings = Math.round((finalFare - platformFee) * 100) / 100;

        // 3. Cancel any pending online payment order for this ride
        const activeOrder = await getActivePaymentOrderByRideId(rideId, 'ride_payment');
        if (activeOrder) {
            await updatePaymentOrderStatus(client, activeOrder.id, 'cancelled', {
                failureReason: 'Cancelled due to cash collection',
            });
            logger.info(`[Collection] Cancelled online order ${activeOrder.order_number} for ride ${rideId}`);
        }

        // 4. Update ride payment status
        const updatedRide = await client.query(
            `UPDATE rides
             SET payment_status = 'collected_by_driver',
                 collection_method_actual = $1,
                 platform_share = $2,
                 collection_confirmed_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING *`,
            [collection_method, platformFee, rideId]
        );

        // 5. Credit driver earnings (this handles wallet credit + cash_balance update)
        const earningsResult = await creditDriverEarnings({
            driverUserId,
            rideId,
            netEarnings,
            platformFee,
            paymentMethod: 'cash',
            collectionMethodActual: collection_method,
        });

        await client.query('COMMIT');

        logger.info(
            `[Collection] Cash confirmed | Driver: ${driver.id} | Ride: ${rideId} | Fare: ₹${finalFare} | Net: ₹${netEarnings}`
        );

        return {
            success: true,
            message: 'Cash collection confirmed successfully',
            data: {
                ride: {
                    id: updatedRide.rows[0].id,
                    rideNumber: updatedRide.rows[0].ride_number,
                    paymentStatus: updatedRide.rows[0].payment_status,
                    collectionMethodActual: updatedRide.rows[0].collection_method_actual,
                    collectionConfirmedAt: updatedRide.rows[0].collection_confirmed_at,
                },
                earnings: {
                    finalFare,
                    platformFee,
                    netEarnings,
                    commissionRate,
                },
                driverWallet: earningsResult.data?.walletBalance,
                alreadyConfirmed: false,
            },
        };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`[Collection] confirmCashCollection error | Driver: ${driverUserId} | Ride: ${rideId}:`, error);
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
=======
        if (pendingOrder) {
            await updatePaymentOrderStatus(client, pendingOrder.id, 'failed', {
                failureReason: `Switched to manual collection (${method}) by driver`,
            });
            logger.info(`[Collect] cancelled online order ${pendingOrder.order_number} | ride: ${rideId}`);
        }

        // Ride record: passenger ko 'cash' hi dikha (public method), driver-side
        // detail collection_method_actual pe audit hota hai (cash | personal_upi)
        await client.query(
            `UPDATE rides
             SET payment_method             = 'cash',
                 payment_status             = 'collected_by_driver',
                 collection_method_actual   = $1,
                 collection_confirmed_at    = NOW(),
                 platform_share             = $3,
                 updated_at                 = NOW()
             WHERE id = $2`,
            [method, rideId, platformFee],
        );

        // Driver cash balance — platform_share owed (driver ko deposit karna hoga)
        await cashRepo.initCashBalance(driver.id);
        if (platformFee > 0) {
            await cashRepo.addToPending(client, driver.id, platformFee, finalFare);
        }

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        logger.error(`[Collect] txn failed | ride: ${rideId} | ${err.message}`);
        throw err;
    } finally {
        client.release();
    }

    // ── Close QR (network call, outside txn) ─────────────────────────────────
    if (pendingOrder?.payment_method === 'upi_qr' && pendingOrder.gateway_order_id) {
        await closeDynamicQR(pendingOrder.gateway_order_id);
    }

    // ── Driver wallet credit (netEarnings) — idempotent by ride_id + debit type
    // payForRide (wallet payment) pehle se ride_id debit check karta hai; hamara
    // creditDriverEarnings also idempotent-safe because worker path pehle hi
    // NAHI chala tha (online method tha). But double-firing defense:
    try {
        await creditDriverEarnings(driverUserId, {
            ride_id:     rideId,
            amount:      netEarnings,
            description: `Ride earnings #${rideId} (manual collect: ${method})`,
        });
    } catch (err) {
        // If wallet credit fails after DB txn, log loudly — admin will reconcile.
        // Not throwing because ride is already marked collected — re-trying would
        // just emit duplicate events. Driver dashboard will show netEarnings.
        logger.error(`[Collect] driver credit failed (post-commit) | ride: ${rideId} | ${err.message}`);
    }

    // ── Notifications ────────────────────────────────────────────────────────
    safeEmit(() => emitToPassenger(ride.passenger_id, 'ride:payment_settled', {
        rideId,
        amount:        finalFare,
        paymentMethod: method,
        settledAt:     new Date(),
        viaDriver:     true,
    }), 'passenger:settled');

    safeEmit(() => emitToDriver(driverUserId, 'ride:collection_confirmed', {
        rideId,
        amount:         finalFare,
        netEarnings,
        platformShareDue: platformFee,
        method,
    }), 'driver:confirmed');

    if (ride.passenger_fcm_token) {
        await addNotificationJob('ride-collected-manual', {
            fcmToken: ride.passenger_fcm_token,
            title:    'Payment Received',
            body:     `Your driver confirmed ₹${finalFare} received`,
            data: {
                type:   'ride_collected_manual',
                rideId: String(rideId),
                method,
            },
        });
    }

    logger.info(`[Collect] confirmed | ride: ${rideId} | method: ${method} | fare: ₹${finalFare} | platformDue: ₹${platformFee}`);

    return {
        success: true,
        message: `₹${finalFare} collection confirmed`,
        data: {
            rideId,
            method,
            finalFare,
            netEarnings,
            platformShareDue: platformFee,
            cashBalanceUpdated: platformFee > 0,
        },
    };
>>>>>>> 14c146dabe2491c7238ceb55d507474f5b956c15
};
