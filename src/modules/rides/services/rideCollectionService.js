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
};
