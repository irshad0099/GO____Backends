import * as subscriptionRepo from '../repositories/subscriptionRepository.js';
import * as paymentService from '../../payments/services/paymentService.js'; // optional, if you have payment module
import { NotFoundError, ApiError, ConflictError } from '../../../core/errors/ApiError.js';
import logger from '../../../core/logger/logger.js';

// ==================== Plans ====================
export const getAllPlans = async () => {
    try {
        return await subscriptionRepo.findAllPlans(true);
    } catch (error) {
        logger.error('Get all plans service error:', error);
        throw error;
    }
};

export const getPlanBySlug = async (slug) => {
    try {
        const plan = await subscriptionRepo.findPlanBySlug(slug);
        if (!plan) throw new NotFoundError('Subscription plan');
        return plan;
    } catch (error) {
        logger.error('Get plan by slug service error:', error);
        throw error;
    }
};

export const getPlanById = async (planId) => {
    try {
        const plan = await subscriptionRepo.findPlanById(planId);
        if (!plan) throw new NotFoundError('Subscription plan');
        return plan;
    } catch (error) {
        logger.error('Get plan by ID service error:', error);
        throw error;
    }
};

export const createPlan = async (planData) => {
    try {
        // Check if slug already exists
        const existing = await subscriptionRepo.findPlanBySlug(planData.slug);
        if (existing) throw new ConflictError('Plan with this slug already exists');
        return await subscriptionRepo.createPlan(planData);
    } catch (error) {
        logger.error('Create plan service error:', error);
        throw error;
    }
};

export const updatePlan = async (planId, updates) => {
    try {
        const plan = await subscriptionRepo.findPlanById(planId);
        if (!plan) throw new NotFoundError('Subscription plan');
        return await subscriptionRepo.updatePlan(planId, updates);
    } catch (error) {
        logger.error('Update plan service error:', error);
        throw error;
    }
};

// ==================== User Subscriptions ====================
export const getMyActiveSubscription = async (userId) => {
    try {
        return await subscriptionRepo.findActiveSubscriptionByUser(userId);
    } catch (error) {
        logger.error('Get my active subscription service error:', error);
        throw error;
    }
};

export const getMySubscriptions = async (userId) => {
    try {
        return await subscriptionRepo.findUserSubscriptions(userId);
    } catch (error) {
        logger.error('Get my subscriptions service error:', error);
        throw error;
    }
};

export const purchaseSubscription = async (userId, planId, paymentMethod, paymentDetails = {}) => {
    try {
        // 1. Validate plan
        const plan = await subscriptionRepo.findPlanById(planId);
        if (!plan) throw new NotFoundError('Subscription plan');

        // 2. Check if user already has an active subscription (optional: allow multiple? Usually one active)
        const active = await subscriptionRepo.findActiveSubscriptionByUser(userId);
        if (active) {
            throw new ConflictError('You already have an active subscription. Cancel it first or wait until it expires.');
        }

        // 3. Create payment record (or integrate with payment gateway)
        // Here we assume payment is processed and we have transaction details
        // For demo, we'll create a dummy payment record
        const paymentData = {
            user_id: userId,
            subscription_id: null, // will update after subscription created
            plan_id: planId,
            amount: plan.price,
            payment_method: paymentMethod,
            payment_gateway: paymentDetails.gateway || 'razorpay',
            gateway_transaction_id: paymentDetails.transactionId || `txn_${Date.now()}`,
            status: 'success', // assume success
            description: `Subscription purchase for ${plan.name}`,
            metadata: paymentDetails.metadata || {}
        };
        const payment = await subscriptionRepo.createSubscriptionPayment(paymentData);

        // 4. Calculate subscription dates
        const startedAt = new Date();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + plan.duration_days);

        // 5. Create user subscription
        const subscriptionData = {
            user_id: userId,
            plan_id: planId,
            started_at: startedAt,
            expires_at: expiresAt,
            auto_renew: true, // default true
            payment_method: paymentMethod,
            transaction_id: payment.id
        };
        const subscription = await subscriptionRepo.createUserSubscription(subscriptionData);

        // 6. Update payment record with subscription_id
        await subscriptionRepo.updatePaymentStatus(payment.id, 'success', payment.gateway_transaction_id);
        // In a real scenario, you might want to link payment to subscription after creation

        return { subscription, payment };
    } catch (error) {
        logger.error('Purchase subscription service error:', error);
        throw error;
    }
};

export const cancelMySubscription = async (userId, subscriptionId, reason) => {
    try {
        // Verify subscription belongs to user and is active
        const subscriptions = await subscriptionRepo.findUserSubscriptions(userId);
        const sub = subscriptions.find(s => s.id === parseInt(subscriptionId) && s.status === 'active');
        if (!sub) throw new NotFoundError('Active subscription not found');

        const cancelled = await subscriptionRepo.cancelUserSubscription(subscriptionId, reason);
        return cancelled;
    } catch (error) {
        logger.error('Cancel subscription service error:', error);
        throw error;
    }
};

// ==================== Benefits Check (used by ride service) ====================
export const getUserSubscriptionBenefits = async (userId) => {
    try {
        const active = await subscriptionRepo.findActiveSubscriptionByUser(userId);
        if (!active) {
            return {
                hasActive: false,
                discountPercent: 0,
                freeRidesLeft: 0,
                priorityBooking: false,
                cancellationWaiver: false,
                surgeProtection: false
            };
        }
        // Calculate free rides left this month
        let freeRidesLeft = active.free_rides_per_month - active.free_rides_used;
        if (freeRidesLeft < 0) freeRidesLeft = 0;

        return {
            hasActive: true,
            subscriptionId: active.id,
            planName: active.name,
            discountPercent: active.ride_discount_percent,
            freeRidesLeft,
            priorityBooking: active.priority_booking,
            cancellationWaiver: active.cancellation_waiver,
            surgeProtection: active.surge_protection
        };
    } catch (error) {
        logger.error('Get user subscription benefits service error:', error);
        throw error;
    }
};

// Call this after a ride is completed to decrement free ride counter if a free ride was used
export const consumeFreeRide = async (userId) => {
    try {
        const active = await subscriptionRepo.findActiveSubscriptionByUser(userId);
        if (!active) return false;
        if (active.free_rides_used < active.free_rides_per_month) {
            await subscriptionRepo.incrementFreeRidesUsed(active.id);
            return true;
        }
        return false;
    } catch (error) {
        logger.error('Consume free ride service error:', error);
        throw error;
    }
};

// ==================== Cron Jobs ====================
export const expireAllOverdue = async () => {
    try {
        const count = await subscriptionRepo.expireSubscriptions();
        logger.info(`Expired ${count} subscriptions`);
        return count;
    } catch (error) {
        logger.error('Expire all overdue service error:', error);
        throw error;
    }
};

export const resetFreeRidesForAll = async () => {
    // This would be run monthly (first day of month) to reset counters
    try {
        const result = await db.query(
            `UPDATE user_subscriptions
             SET free_rides_used = 0, free_rides_reset_at = NOW(), updated_at = NOW()
             WHERE status = 'active'`
        );
        logger.info(`Reset free rides for ${result.rowCount} active subscriptions`);
        return result.rowCount;
    } catch (error) {
        logger.error('Reset free rides for all service error:', error);
        throw error;
    }
};