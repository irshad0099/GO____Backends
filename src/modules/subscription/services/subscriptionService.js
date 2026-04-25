import { pool } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';
import { createSubscriptionPlan, cancelSubscription as cancelRazorpaySubscription, fetchSubscription as fetchRazorpaySubscription, createCustomer } from '../../../core/services/razorpayService.js';
import {
    getAllPlans,
    getPlanById,
    getPlanBySlug,
    getActiveSubscription,
    getSubscriptionById,
    getSubscriptionHistory,
    getSubscriptionHistoryCount,
    createSubscription,
    updateSubscriptionStatus,
    updateAutoRenew,
    useFreeRide,
    resetFreeRides,
    createSubscriptionPayment,
    updatePaymentStatus,
    getPaymentsBySubscriptionId,
    createPlan,
    togglePlanStatus,
} from '../repositories/subscriptionRepository.js';

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
    const sub = await getActiveSubscription(userId);
    return {
        success: true,
        data: sub ? formatSubscription(sub) : null,
        hasActiveSubscription: !!sub,
    };
};

// ─────────────────────────────────────────────────────────────────────────────
//  4. Purchase / Subscribe to a plan
// ─────────────────────────────────────────────────────────────────────────────

export const purchaseSubscription = async (userId, {
    plan_id,
    payment_method,
    payment_gateway,
    gateway_transaction_id,
    auto_renew,
    customer_details,
}) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check plan exists
        const plan = await getPlanById(plan_id);
        if (!plan) {
            const err = new Error('Subscription plan not found');
            err.statusCode = 404;
            throw err;
        }

        // Check if user already has an active subscription
        const existing = await getActiveSubscription(userId);
        if (existing) {
            const err = new Error(
                `You already have an active "${existing.plan_name}" subscription valid till ${new Date(existing.expires_at).toLocaleDateString('en-IN')}`
            );
            err.statusCode = 400;
            throw err;
        }

        // Calculate expiry
        const startedAt  = new Date();
        const expiresAt  = new Date();
        expiresAt.setDate(expiresAt.getDate() + plan.duration_days);

        // Free rides monthly reset date
        const freeRidesResetAt = new Date();
        freeRidesResetAt.setDate(freeRidesResetAt.getDate() + 30);

        let razorpaySubscriptionId = null;
        let gatewayTransactionId = null;

        // For Razorpay recurring payments
        if (payment_method === 'card' && payment_gateway === 'razorpay' && auto_renew) {
            // Create Razorpay customer if not exists
            const customer = await createCustomer(customer_details || {
                name: `User ${userId}`,
                email: `user${userId}@example.com`,
                phone: '9999999999',
            });

            // Create Razorpay subscription plan
            const razorpayPlan = await createSubscriptionPlan({
                name: plan.name,
                description: plan.description || `${plan.name} subscription`,
                price: parseFloat(plan.price),
                period: 'monthly',
            }, customer.data);

            razorpaySubscriptionId = razorpayPlan.data.id;
        }

        // Create subscription record
        const subscription = await createSubscription(client, {
            userId,
            planId:          plan.id,
            status:          'active',
            startedAt,
            expiresAt,
            autoRenew:       auto_renew ?? true,
            paymentMethod:   payment_method,
            freeRidesResetAt,
            razorpaySubscriptionId,
        });

        // Record payment
        const payment = await createSubscriptionPayment(client, {
            userId,
            subscriptionId:      subscription.id,
            planId:              plan.id,
            amount:              plan.price,
            paymentMethod:       payment_method,
            paymentGateway:      payment_gateway      || null,
            gatewayTransactionId: gateway_transaction_id || null,
            status:              'success',
            description:         `Subscription to ${plan.name}`,
            metadata:            { plan_slug: plan.slug },
        });

        await client.query('COMMIT');

        logger.info(
            `[Subscription] New subscription | User: ${userId} | Plan: ${plan.name} | Razorpay: ${razorpaySubscriptionId} | Expires: ${expiresAt.toISOString()}`
        );

        return {
            success: true,
            message: `Successfully subscribed to ${plan.name}!`,
            data: {
                subscription: {
                    subscriptionId: subscription.id,
                    planName:       plan.name,
                    price:          parseFloat(plan.price),
                    startedAt:      subscription.started_at,
                    expiresAt:      subscription.expires_at,
                    autoRenew:      subscription.auto_renew,
                    razorpaySubscriptionId: razorpaySubscriptionId,
                    benefits: {
                        rideDiscountPercent: parseFloat(plan.ride_discount_percent),
                        freeRidesPerMonth:   plan.free_rides_per_month,
                        priorityBooking:     plan.priority_booking,
                        cancellationWaiver:  plan.cancellation_waiver,
                        surgeProtection:     plan.surge_protection,
                    },
                },
                payment: formatPayment(payment),
                requiresRazorpay: !!razorpaySubscriptionId,
                razorpaySubscriptionId,
            },
        };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`[Subscription] purchaseSubscription error | User: ${userId}:`, error);
        throw error;
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  5. Cancel subscription
// ─────────────────────────────────────────────────────────────────────────────

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

    // Cancel Razorpay subscription if exists
    if (sub.razorpay_subscription_id) {
        try {
            await cancelRazorpaySubscription(sub.razorpay_subscription_id, false);
            logger.info(`[Subscription] Razorpay subscription cancelled | Sub: ${sub.razorpay_subscription_id}`);
        } catch (error) {
            logger.error(`[Subscription] Failed to cancel Razorpay subscription:`, error);
            // Don't fail whole operation if Razorpay cancellation fails
        }
    }

    const updated = await updateSubscriptionStatus(subscription_id, 'cancelled', {
        cancelReason: reason || 'Cancelled by user',
    });

    logger.info(`[Subscription] Cancelled | User: ${userId} | Sub: ${subscription_id}`);

    return {
        success: true,
        message: 'Subscription cancelled. Benefits valid till expiry date.',
        data: {
            subscriptionId: updated.id,
            status:         updated.status,
            cancelledAt:    updated.cancelled_at,
            expiresAt:      updated.expires_at,   // still usable till expires_at
        },
    };
};

// ─────────────────────────────────────────────────────────────────────────────
//  6. Toggle auto-renew
// ─────────────────────────────────────────────────────────────────────────────

export const toggleAutoRenew = async (userId, { subscription_id, auto_renew }) => {
    const sub = await getSubscriptionById(subscription_id, userId);

    if (!sub) {
        const err = new Error('Subscription not found');
        err.statusCode = 404;
        throw err;
    }
    if (sub.status !== 'active') {
        const err = new Error('Cannot update auto-renew on an inactive subscription');
        err.statusCode = 400;
        throw err;
    }

    const updated = await updateAutoRenew(subscription_id, userId, auto_renew);

    return {
        success: true,
        message: `Auto-renew ${auto_renew ? 'enabled' : 'disabled'} successfully`,
        data: { subscriptionId: updated.id, autoRenew: updated.auto_renew },
    };
};

// ─────────────────────────────────────────────────────────────────────────────
//  7. Check & apply subscription benefits for a ride
//     Called by ride-service before billing
// ─────────────────────────────────────────────────────────────────────────────

export const applyRideBenefits = async (userId, rideAmount) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const sub = await getActiveSubscription(userId);

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