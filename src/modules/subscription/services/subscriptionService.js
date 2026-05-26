import { db } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';
import { createSubscriptionPlan, cancelSubscription as cancelRazorpaySubscription, fetchSubscription as fetchRazorpaySubscription, createCustomer, createRazorpayOrder, verifyRazorpayPayment } from '../../../core/services/razorpayService.js';
import { debitWallet, createTransaction, findWalletByUserId } from '../../wallet/repositories/wallet.repository.js';
import redis, { redisSafe } from '../../../config/redis.config.js';
import {
    getAllPlans,
    getPlanById,
    getPlanBySlug,
    getActiveSubscription,
    getActiveSubscriptionForUpdate,
    getSubscriptionById,
    getSubscriptionHistory,
    getSubscriptionHistoryCount,
    createSubscription,
    updateAutoRenew,
    useFreeRide,
    refundFreeRide,
    resetFreeRides,
    getWalletAutoRenewCandidates,
    extendSubscription,
    disableAutoRenew,
    createSubscriptionPayment,
    updatePaymentStatus,
    getPaymentsBySubscriptionId,
    createPlan,
    togglePlanStatus,
} from '../repositories/subscriptionRepository.js';

// ─── Redis Cache ──────────────────────────────────────────────────────────────
const SUB_CACHE_KEY = (userId) => `subscription:active:${userId}`;
const SUB_CACHE_TTL = 10 * 60; // 10 minutes

const getCachedSubscription = async (userId) => {
    try {
        const data = await redisSafe(() => redis.get(SUB_CACHE_KEY(userId)));
        if (!data) return null;
        logger.info(`✅ Subscription cache HIT for user ${userId}`);
        return JSON.parse(data);
    } catch (error) {
        logger.warn('Subscription cache parse error:', error.message);
        return null;
    }
};

const setCachedSubscription = async (userId, data) => {
    try {
        await redisSafe(() => redis.setex(SUB_CACHE_KEY(userId), SUB_CACHE_TTL, JSON.stringify(data)));
        logger.info(`💾 Subscription cached in Redis for user ${userId}`);
    } catch (error) {
        logger.warn('Subscription Redis SET error:', error.message);
    }
};

const invalidateSubscriptionCache = async (userId) => {
    try {
        await redisSafe(() => redis.del(SUB_CACHE_KEY(userId)));
        logger.debug(`🗑 Subscription cache invalidated for user ${userId}`);
    } catch (error) {
        logger.warn('Subscription Redis DEL error:', error.message);
    }
};

// ─── Formatters ───────────────────────────────────────────────────────────────

const formatPlan = (p) => ({
    planId:               p.id,
    name:                 p.name,
    slug:                 p.slug,
    description:          p.description   || null,
    price:                parseFloat(p.price),
    durationDays:         p.duration_days,
    benefits: {
        rideDiscountPercent:  parseFloat(p.ride_discount_percent),
        freeRidesPerMonth:    p.free_rides_per_month,
        priorityBooking:      p.priority_booking,
        cancellationWaiver:   p.cancellation_waiver,
        surgeProtection:      p.surge_protection,
    },
    isActive:             p.is_active,
    createdAt:            p.created_at,
});

const formatSubscription = (s) => ({
    subscriptionId:      s.id,
    userId:              s.user_id,
    plan: {
        planId:          s.plan_id,
        name:            s.plan_name        || null,
        slug:            s.slug             || null,
        price:           s.price            ? parseFloat(s.price) : null,
        benefits: {
            rideDiscountPercent: s.ride_discount_percent ? parseFloat(s.ride_discount_percent) : null,
            freeRidesPerMonth:   s.free_rides_per_month  || null,
            priorityBooking:     s.priority_booking      || null,
            cancellationWaiver:  s.cancellation_waiver   || null,
            surgeProtection:     s.surge_protection      || null,
        },
    },
    status:              s.status,
    startedAt:           s.started_at,
    expiresAt:           s.expires_at,
    cancelledAt:         s.cancelled_at    || null,
    cancelReason:        s.cancel_reason   || null,
    autoRenew:           s.auto_renew,
    freeRidesUsed:       s.free_rides_used,
    freeRidesResetAt:    s.free_rides_reset_at || null,
    paymentMethod:       s.payment_method  || null,
    razorpaySubscriptionId: s.razorpay_subscription_id || null,
    createdAt:           s.created_at,
});

const formatPayment = (p) => ({
    paymentId:           p.id,
    subscriptionId:      p.subscription_id,
    planId:              p.plan_id,
    amount:              parseFloat(p.amount),
    paymentMethod:       p.payment_method       || null,
    paymentGateway:      p.payment_gateway      || null,
    gatewayTransactionId: p.gateway_transaction_id || null,
    status:              p.status,
    description:         p.description          || null,
    createdAt:           p.created_at,
});

// ─────────────────────────────────────────────────────────────────────────────
//  1. Get all active plans (public)
// ─────────────────────────────────────────────────────────────────────────────

export const fetchAllPlans = async () => {
    const plans = await getAllPlans();
    return {
        success: true,
        data: plans.map(formatPlan),
    };
};

// ─────────────────────────────────────────────────────────────────────────────
//  2. Get single plan detail
// ─────────────────────────────────────────────────────────────────────────────

export const fetchPlanById = async (planId) => {
    const plan = await getPlanById(planId);
    if (!plan) {
        const err = new Error('Plan not found');
        err.statusCode = 404;
        throw err;
    }
    return { success: true, data: formatPlan(plan) };
};

// ─────────────────────────────────────────────────────────────────────────────
//  3. Get user's active subscription
// ─────────────────────────────────────────────────────────────────────────────

export const fetchActiveSubscription = async (userId) => {
    // Check cache first
    const cached = await getCachedSubscription(userId);
    if (cached !== null) {
        return cached;
    }

    // Cache miss - fetch from DB
    const sub = await getActiveSubscription(userId);
    const result = {
        success: true,
        data: sub ? formatSubscription(sub) : null,
        hasActiveSubscription: !!sub,
    };

    // Cache the result
    await setCachedSubscription(userId, result);
    return result;
};

// ─────────────────────────────────────────────────────────────────────────────
//  4. Purchase / Subscribe to a plan
// ─────────────────────────────────────────────────────────────────────────────

const generateTxnNumber = () => {
    const ts   = Date.now();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `TXN${ts}${rand}`;
};

export const purchaseSubscription = async (userId, {
    plan_id,
    payment_method,
    payment_gateway,
    auto_renew,
}) => {
    // Check plan exists
    const plan = await getPlanById(plan_id);
    if (!plan) {
        const err = new Error('Subscription plan not found');
        err.statusCode = 404;
        throw err;
    }

    // Block if user already has any active subscription
    const existing = await getActiveSubscription(userId);
    if (existing) {
        const err = new Error(
            `You already have an active "${existing.plan_name}" subscription valid till ${new Date(existing.expires_at).toLocaleDateString('en-IN')}`
        );
        err.statusCode = 400;
        throw err;
    }

    const price = parseFloat(plan.price);

    // ── WALLET — deduct immediately, activate immediately ──
    if (payment_method === 'wallet') {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            // Balance check + deduct (row-level lock inside debitWallet)
            const wallet = await findWalletByUserId(userId);
            if (!wallet || parseFloat(wallet.balance) < price) {
                const err = new Error(`Insufficient wallet balance. Required: ₹${price}, Available: ₹${parseFloat(wallet?.balance || 0).toFixed(2)}`);
                err.statusCode = 400;
                throw err;
            }
            await debitWallet(client, userId, price);

            // Wallet transaction record
            await createTransaction(client, {
                transactionNumber: generateTxnNumber(),
                userId,
                walletId:          wallet.id,
                amount:            price,
                type:              'debit',
                category:          'subscription',
                paymentMethod:     'wallet',
                status:            'success',
                description:       `Subscription: ${plan.name}`,
                metadata:          { plan_id: plan.id, plan_slug: plan.slug },
            });

            const startedAt        = new Date();
            const expiresAt        = new Date();
            expiresAt.setDate(expiresAt.getDate() + plan.duration_days);
            const freeRidesResetAt = new Date();
            freeRidesResetAt.setDate(freeRidesResetAt.getDate() + 30);

            // Wallet is the only payment method we can auto-charge against,
            // so wallet subs default to auto-renew on (user can still opt out).
            const subscription = await createSubscription(client, {
                userId, planId: plan.id, status: 'active',
                startedAt, expiresAt, autoRenew: auto_renew ?? true,
                paymentMethod: 'wallet', freeRidesResetAt,
            });

            const payment = await createSubscriptionPayment(client, {
                userId, subscriptionId: subscription.id, planId: plan.id,
                amount: price, paymentMethod: 'wallet', paymentGateway: null,
                gatewayTransactionId: null, status: 'success',
                description: `Subscription to ${plan.name}`,
                metadata: { plan_slug: plan.slug },
            });

            await client.query('COMMIT');
            await invalidateSubscriptionCache(userId);

            logger.info(`[Subscription] Wallet purchase | User: ${userId} | Plan: ${plan.name} | ₹${price}`);

            return {
                success: true,
                message: `Successfully subscribed to ${plan.name}!`,
                data: {
                    subscription: formatSubscription({ ...subscription, plan_name: plan.name, slug: plan.slug, price: plan.price, ride_discount_percent: plan.ride_discount_percent, free_rides_per_month: plan.free_rides_per_month, priority_booking: plan.priority_booking, cancellation_waiver: plan.cancellation_waiver, surge_protection: plan.surge_protection }),
                    payment: formatPayment(payment),
                },
            };
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error(`[Subscription] wallet purchase error | User: ${userId}:`, error);
            throw error;
        } finally {
            client.release();
        }
    }

    // ── UPI / CARD — Razorpay order create, frontend pay kare, /verify pe activate ──
    const razorpayOrder = await createRazorpayOrder(price, 'INR', `sub_${Date.now()}`, {
        userId: String(userId),
        planId: String(plan.id),
        purpose: 'subscription',
    });

    logger.info(`[Subscription] Razorpay order created | User: ${userId} | Plan: ${plan.name} | Order: ${razorpayOrder.data.id}`);

    return {
        success:         true,
        message:         'Complete payment to activate subscription',
        requiresPayment: true,
        data: {
            razorpayOrderId: razorpayOrder.data.id,
            amount:          razorpayOrder.data.amount,
            currency:        razorpayOrder.data.currency,
            plan: {
                planId:   plan.id,
                name:     plan.name,
                price,
                durationDays: plan.duration_days,
            },
        },
    };
};

// ─────────────────────────────────────────────────────────────────────────────
//  4b. Verify UPI/Card payment and activate subscription
// ─────────────────────────────────────────────────────────────────────────────

export const verifyAndActivateSubscription = async (userId, {
    plan_id,
    payment_method,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    auto_renew,
}) => {
    // Verify Razorpay signature
    const verified = await verifyRazorpayPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!verified?.data?.id) {
        const err = new Error('Payment verification failed');
        err.statusCode = 400;
        throw err;
    }

    // Check again — race condition se bacho
    const existing = await getActiveSubscription(userId);
    if (existing) {
        const err = new Error(`Already have an active "${existing.plan_name}" subscription`);
        err.statusCode = 400;
        throw err;
    }

    const plan = await getPlanById(plan_id);
    if (!plan) {
        const err = new Error('Plan not found');
        err.statusCode = 404;
        throw err;
    }

    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const startedAt        = new Date();
        const expiresAt        = new Date();
        expiresAt.setDate(expiresAt.getDate() + plan.duration_days);
        const freeRidesResetAt = new Date();
        freeRidesResetAt.setDate(freeRidesResetAt.getDate() + 30);

        // Razorpay one-shot payments don't give us a recurring mandate — we
        // have no way to auto-charge later, so force auto_renew = false here
        // regardless of what the client passed.
        const subscription = await createSubscription(client, {
            userId, planId: plan.id, status: 'active',
            startedAt, expiresAt, autoRenew: false,
            paymentMethod: payment_method, freeRidesResetAt,
        });

        const payment = await createSubscriptionPayment(client, {
            userId, subscriptionId: subscription.id, planId: plan.id,
            amount: parseFloat(plan.price), paymentMethod: payment_method,
            paymentGateway: 'razorpay', gatewayTransactionId: razorpay_payment_id,
            status: 'success',
            description: `Subscription to ${plan.name}`,
            metadata: { plan_slug: plan.slug, razorpay_order_id },
        });

        await client.query('COMMIT');
        await invalidateSubscriptionCache(userId);

        logger.info(`[Subscription] Verified & activated | User: ${userId} | Plan: ${plan.name} | Payment: ${razorpay_payment_id}`);

        return {
            success: true,
            message: `Successfully subscribed to ${plan.name}!`,
            data: {
                subscription: formatSubscription({ ...subscription, plan_name: plan.name, slug: plan.slug, price: plan.price, ride_discount_percent: plan.ride_discount_percent, free_rides_per_month: plan.free_rides_per_month, priority_booking: plan.priority_booking, cancellation_waiver: plan.cancellation_waiver, surge_protection: plan.surge_protection }),
                payment: formatPayment(payment),
            },
        };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`[Subscription] verify & activate error | User: ${userId}:`, error);
        throw error;
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  5. Cancel subscription
// ─────────────────────────────────────────────────────────────────────────────

// Cancel = stop the next auto-renew. The subscription itself keeps running
// until its expires_at; the daily expiry cron will mark it 'expired' after.
// This is now the only way to opt out of auto-renew (toggle endpoint is gone).
export const cancelSubscription = async (userId, { subscription_id, reason }) => {
    const sub = await getSubscriptionById(subscription_id, userId);

    if (!sub) {
        const err = new Error('Subscription not found');
        err.statusCode = 404;
        throw err;
    }
    if (sub.status !== 'active') {
        const err = new Error(`Subscription is already ${sub.status}`);
        err.statusCode = 400;
        throw err;
    }

    // If a Razorpay recurring mandate exists, tell Razorpay to stop charging.
    // Local sub stays active till expires_at — benefits continue till then.
    if (sub?.razorpay_subscription_id) {
        try {
            await cancelRazorpaySubscription(sub.razorpay_subscription_id, false);
            logger.info(`[Subscription] Razorpay mandate cancelled | Sub: ${sub.razorpay_subscription_id}`);
        } catch (error) {
            logger.error(`[Subscription] Failed to cancel Razorpay mandate:`, error);
            // Don't fail the whole operation if Razorpay cancellation fails
        }
    }

    await updateAutoRenew(subscription_id, userId, false);
    await invalidateSubscriptionCache(userId);

    logger.info(`[Subscription] Auto-renew cancelled (sub stays active till expiry) | User: ${userId} | Sub: ${subscription_id} | Reason: ${reason || 'n/a'}`);

    return {
        success: true,
        message: 'Auto-renew stopped. Subscription benefits continue till expiry.',
        data: {
            subscriptionId: sub.id,
            status:         sub.status,        // still 'active'
            autoRenew:      false,
            expiresAt:      sub.expires_at,
        },
    };
};

// ─────────────────────────────────────────────────────────────────────────────
//  7. Check & apply subscription benefits for a ride
//     Called by ride-service before billing
// ─────────────────────────────────────────────────────────────────────────────

export const applyRideBenefits = async (userId, rideAmount) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        // Lock the active subscription row inside the same tx so two concurrent
        // ride requests cannot both see freeRidesLeft=1 and double-consume.
        const sub = await getActiveSubscriptionForUpdate(client, userId);

        // No active subscription — return original amount
        if (!sub) {
            await client.query('ROLLBACK');
            return {
                success:        true,
                hasSubscription: false,
                originalAmount:  rideAmount,
                finalAmount:     rideAmount,
                discountAmount:  0,
                isFreeRide:      false,
                benefits:        null,
            };
        }

        const freeRidesLeft = sub.free_rides_per_month - sub.free_rides_used;
        let finalAmount     = rideAmount;
        let discountAmount  = 0;
        let isFreeRide      = false;

        // Free ride available — charge ₹0
        if (freeRidesLeft > 0) {
            isFreeRide    = true;
            finalAmount   = 0;
            discountAmount = rideAmount;
            await useFreeRide(client, sub.id);

        // Discount ride
        } else if (parseFloat(sub.ride_discount_percent) > 0) {
            discountAmount = (rideAmount * parseFloat(sub.ride_discount_percent)) / 100;
            discountAmount = Math.round(discountAmount * 100) / 100;
            finalAmount    = Math.max(0, rideAmount - discountAmount);
        }

        await client.query('COMMIT');

        // Free ride consumption changes free_rides_used — drop the 10-min cache
        // so subsequent reads don't show stale counters and let the user
        // over-consume.
        if (isFreeRide) {
            await invalidateSubscriptionCache(userId);
        }

        logger.info(
            `[Subscription] Ride benefit applied | User: ${userId} | Free: ${isFreeRide} | Discount: ₹${discountAmount}`
        );

        return {
            success:         true,
            hasSubscription: true,
            originalAmount:  rideAmount,
            finalAmount,
            discountAmount,
            isFreeRide,
            freeRidesLeft:   isFreeRide ? freeRidesLeft - 1 : freeRidesLeft,
            benefits: {
                planName:          sub.plan_name,
                priorityBooking:   sub.priority_booking,
                cancellationWaiver: sub.cancellation_waiver,
                surgeProtection:   sub.surge_protection,
            },
        };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`[Subscription] applyRideBenefits error | User: ${userId}:`, error);
        throw error;
    } finally {
        client.release();
    }
};

// Renew a single wallet-paid subscription. Called by the daily auto-renew
// cron for each candidate row. If the wallet doesn't have enough balance we
// disable auto-renew (so we don't retry every day) and let the subscription
// expire naturally — caller (cron) just logs and moves on.
export const renewSubscriptionFromWallet = async (sub) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const price  = parseFloat(sub.price);
        const wallet = await findWalletByUserId(sub.user_id);

        if (!wallet || parseFloat(wallet.balance) < price) {
            await client.query('COMMIT');
            await disableAutoRenew(sub.id);
            await invalidateSubscriptionCache(sub.user_id);
            logger.warn(`[Subscription] Auto-renew aborted (insufficient balance) | User: ${sub.user_id} | Sub: ${sub.id}`);
            return { renewed: false, reason: 'insufficient_balance' };
        }

        await debitWallet(client, sub.user_id, price);

        await createTransaction(client, {
            transactionNumber: generateTxnNumber(),
            userId:            sub.user_id,
            walletId:          wallet.id,
            amount:            price,
            type:              'debit',
            category:          'subscription',
            paymentMethod:     'wallet',
            status:            'success',
            description:       `Auto-renew: ${sub.plan_name}`,
            metadata:          { plan_id: sub.plan_id, plan_slug: sub.slug, subscription_id: sub.id, auto_renew: true },
        });

        // Push expiry forward from the *current* expires_at so renewing a
        // sub that's a few hours early doesn't shorten the user's total.
        const newExpiresAt = new Date(sub.expires_at);
        newExpiresAt.setDate(newExpiresAt.getDate() + sub.duration_days);
        const newFreeRidesResetAt = new Date();
        newFreeRidesResetAt.setDate(newFreeRidesResetAt.getDate() + 30);

        await extendSubscription(client, sub.id, newExpiresAt, newFreeRidesResetAt);

        await createSubscriptionPayment(client, {
            userId:               sub.user_id,
            subscriptionId:       sub.id,
            planId:               sub.plan_id,
            amount:               price,
            paymentMethod:        'wallet',
            paymentGateway:       null,
            gatewayTransactionId: null,
            status:               'success',
            description:          `Auto-renew: ${sub.plan_name}`,
            metadata:             { plan_slug: sub.slug, auto_renew: true },
        });

        await client.query('COMMIT');
        await invalidateSubscriptionCache(sub.user_id);

        logger.info(`[Subscription] Auto-renewed | User: ${sub.user_id} | Sub: ${sub.id} | NewExpires: ${newExpiresAt.toISOString()}`);
        return { renewed: true, newExpiresAt };
    } catch (err) {
        await client.query('ROLLBACK');
        logger.error(`[Subscription] renewSubscriptionFromWallet error | Sub: ${sub.id}:`, err.message);
        throw err;
    } finally {
        client.release();
    }
};

// Wallet auto-renew cron driver — fetches candidates and processes each
// independently so one failure doesn't poison the rest of the batch.
export const runWalletAutoRenewBatch = async () => {
    const candidates = await getWalletAutoRenewCandidates();
    if (!candidates.length) return { processed: 0, renewed: 0, failed: 0 };

    let renewed = 0;
    let failed  = 0;
    for (const sub of candidates) {
        try {
            const r = await renewSubscriptionFromWallet(sub);
            if (r.renewed) renewed++; else failed++;
        } catch (err) {
            failed++;
            logger.error(`[Subscription] Auto-renew failed | Sub: ${sub.id}:`, err.message);
        }
    }
    return { processed: candidates.length, renewed, failed };
};

// Refund a free ride back to the user's active subscription when a free ride
// gets cancelled / expires. Safe to call without checking is_free_ride first —
// returns null if there's no active sub or nothing to refund. Best-effort:
// never throws into the caller's flow (cancellation must succeed).
export const refundFreeRideOnCancel = async (userId) => {
    try {
        const refunded = await refundFreeRide(userId);
        if (refunded) {
            await invalidateSubscriptionCache(userId);
            logger.info(`[Subscription] Free ride refunded | User: ${userId} | Sub: ${refunded.id} | UsedNow: ${refunded.free_rides_used}`);
        }
        return refunded;
    } catch (err) {
        logger.error(`[Subscription] refundFreeRideOnCancel failed | User: ${userId}:`, err.message);
        return null;
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  8. Subscription history (paginated)
// ─────────────────────────────────────────────────────────────────────────────

export const fetchSubscriptionHistory = async (userId, { limit, offset }) => {
    const [history, total] = await Promise.all([
        getSubscriptionHistory(userId, { limit, offset }),
        getSubscriptionHistoryCount(userId),
    ]);

    return {
        success: true,
        data: {
            subscriptions: history.map(formatSubscription),
            pagination: {
                total,
                limit,
                offset,
                hasMore: offset + limit < total,
            },
        },
    };
};

// ─────────────────────────────────────────────────────────────────────────────
//  9. Get payments for a subscription
// ─────────────────────────────────────────────────────────────────────────────

export const fetchSubscriptionPayments = async (userId, subscriptionId) => {
    const sub = await getSubscriptionById(subscriptionId, userId);
    if (!sub) {
        const err = new Error('Subscription not found');
        err.statusCode = 404;
        throw err;
    }

    const payments = await getPaymentsBySubscriptionId(subscriptionId);
    return {
        success: true,
        data: payments.map(formatPayment),
    };
};

// ─────────────────────────────────────────────────────────────────────────────
//  ADMIN SERVICES
// ─────────────────────────────────────────────────────────────────────────────

export const createNewPlan = async (data) => {
    const plan = await createPlan(data);
    logger.info(`[Subscription] New plan created: ${plan.name}`);
    return { success: true, message: 'Plan created successfully', data: formatPlan(plan) };
};

export const setPlanActiveStatus = async (planId, isActive) => {
    const plan = await togglePlanStatus(planId, isActive);
    if (!plan) {
        const err = new Error('Plan not found');
        err.statusCode = 404;
        throw err;
    }
    return {
        success: true,
        message: `Plan ${isActive ? 'activated' : 'deactivated'} successfully`,
        data: formatPlan(plan),
    };
};