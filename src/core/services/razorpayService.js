import Razorpay from 'razorpay';
import crypto from 'crypto';
import { ENV } from '../../config/envConfig.js';
import logger from '../../core/logger/logger.js';

// Initialize Razorpay instance
const razorpay = new Razorpay({
    key_id: ENV.RAZORPAY_KEY_ID,
    key_secret: ENV.RAZORPAY_KEY_SECRET,
});

// ─────────────────────────────────────────────────────────────────────────────
//  One-time Payment (Ride Payments)
// ─────────────────────────────────────────────────────────────────────────────

export const createRazorpayOrder = async (amount, currency = 'INR', receipt, notes = {}) => {
    try {
        const options = {
            amount: amount * 100, // Razorpay uses paise
            currency,
            receipt: receipt || `receipt_${Date.now()}`,
            notes: {
                ...notes,
                created_at: new Date().toISOString(),
            },
            payment: {
                capture: 'automatic',
                capture_options: {
                    automatic_expiry_period: 15, // 15 minutes
                },
            },
        };

        const order = await razorpay.orders.create(options);
        
        logger.info(`[Razorpay] Order created | Amount: ₹${amount} | Order ID: ${order.id}`);
        
        return {
            success: true,
            data: {
                id: order.id,
                entity: order.entity,
                amount: order.amount,
                amount_paid: order.amount_paid,
                amount_due: order.amount_due,
                currency: order.currency,
                receipt: order.receipt,
                status: order.status,
                attempts: order.attempts,
                notes: order.notes,
                created_at: order.created_at,
            },
        };
    } catch (error) {
        logger.error('[Razorpay] createOrder error:', error);
        throw new Error(`Failed to create Razorpay order: ${error.message}`);
    }
};

export const verifyRazorpayPayment = async (razorpayOrderId, razorpayPaymentId, signature) => {
    try {
        // Verify signature
        const body = `${razorpayOrderId}|${razorpayPaymentId}`;
        const expectedSignature = crypto
            .createHmac('sha256', ENV.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest('hex');

        if (expectedSignature !== signature) {
            throw new Error('Invalid payment signature');
        }

        // Fetch payment details
        const payment = await razorpay.payments.fetch(razorpayPaymentId);
        
        logger.info(`[Razorpay] Payment verified | Payment ID: ${razorpayPaymentId} | Status: ${payment.status}`);
        
        return {
            success: true,
            data: {
                id: payment.id,
                entity: payment.entity,
                amount: payment.amount,
                currency: payment.currency,
                status: payment.status,
                order_id: payment.order_id,
                invoice_id: payment.invoice_id,
                international: payment.international,
                method: payment.method,
                amount_refunded: payment.amount_refunded,
                refund_status: payment.refund_status,
                captured: payment.captured,
                description: payment.description,
                card_id: payment.card_id,
                bank: payment.bank,
                wallet: payment.wallet,
                vpa: payment.vpa,
                email: payment.email,
                contact: payment.contact,
                notes: payment.notes,
                created_at: payment.created_at,
            },
        };
    } catch (error) {
        logger.error('[Razorpay] verifyPayment error:', error);
        throw new Error(`Payment verification failed: ${error.message}`);
    }
};

export const createRazorpayRefund = async (paymentId, amount, notes = {}) => {
    try {
        const options = {
            payment_id: paymentId,
            amount: amount * 100, // Convert to paise
            notes: {
                ...notes,
                refund_reason: 'Customer requested refund',
                created_at: new Date().toISOString(),
            },
        };

        const refund = await razorpay.payments.refund(options);
        
        logger.info(`[Razorpay] Refund created | Payment ID: ${paymentId} | Refund ID: ${refund.id}`);
        
        return {
            success: true,
            data: {
                id: refund.id,
                entity: refund.entity,
                amount: refund.amount,
                currency: refund.currency,
                payment_id: refund.payment_id,
                status: refund.status,
                notes: refund.notes,
                created_at: refund.created_at,
            },
        };
    } catch (error) {
        logger.error('[Razorpay] createRefund error:', error);
        throw new Error(`Refund failed: ${error.message}`);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  Subscription Payments (Recurring)
// ─────────────────────────────────────────────────────────────────────────────

export const createSubscriptionPlan = async (plan, customerDetails) => {
    try {
        const options = {
            period: plan.period || 'monthly',
            interval: 1,
            item: {
                name: plan.name,
                description: plan.description || `${plan.name} subscription`,
                amount: plan.price * 100, // Convert to paise
                currency: 'INR',
            },
            customer_notify: true,
            notify_info: customerDetails,
        };

        const subscription = await razorpay.subscriptions.create(options);
        
        logger.info(`[Razorpay] Subscription created | Plan: ${plan.name} | Sub ID: ${subscription.id}`);
        
        return {
            success: true,
            data: {
                id: subscription.id,
                entity: subscription.entity,
                plan_id: subscription.plan_id,
                customer_id: subscription.customer_id,
                status: subscription.status,
                current_start: subscription.current_start,
                current_end: subscription.current_end,
                ended_at: subscription.ended_at,
                created_at: subscription.created_at,
                notes: subscription.notes,
            },
        };
    } catch (error) {
        logger.error('[Razorpay] createSubscription error:', error);
        throw new Error(`Failed to create subscription: ${error.message}`);
    }
};

export const cancelSubscription = async (subscriptionId, cancelAtCycleEnd = false) => {
    try {
        const options = {
            cancel_at_cycle_end: cancelAtCycleEnd,
        };

        const subscription = await razorpay.subscriptions.cancel(subscriptionId, options);
        
        logger.info(`[Razorpay] Subscription cancelled | Sub ID: ${subscriptionId}`);
        
        return {
            success: true,
            data: {
                id: subscription.id,
                entity: subscription.entity,
                plan_id: subscription.plan_id,
                customer_id: subscription.customer_id,
                status: subscription.status,
                current_start: subscription.current_start,
                current_end: subscription.current_end,
                ended_at: subscription.ended_at,
                created_at: subscription.created_at,
                notes: subscription.notes,
            },
        };
    } catch (error) {
        logger.error('[Razorpay] cancelSubscription error:', error);
        throw new Error(`Failed to cancel subscription: ${error.message}`);
    }
};

export const fetchSubscription = async (subscriptionId) => {
    try {
        const subscription = await razorpay.subscriptions.fetch(subscriptionId);
        
        return {
            success: true,
            data: {
                id: subscription.id,
                entity: subscription.entity,
                plan_id: subscription.plan_id,
                customer_id: subscription.customer_id,
                status: subscription.status,
                current_start: subscription.current_start,
                current_end: subscription.current_end,
                ended_at: subscription.ended_at,
                created_at: subscription.created_at,
                notes: subscription.notes,
                short_url: subscription.short_url,
                has_free_trial: subscription.has_free_trial,
                charge_at: subscription.charge_at,
                start_at: subscription.start_at,
                end_at: subscription.end_at,
                auth_status: subscription.auth_status,
                uptime: subscription.uptime,
                total_count: subscription.total_count,
                paid_count: subscription.paid_count,
                customer_notify: subscription.customer_notify,
                created_at: subscription.created_at,
                expire_by: subscription.expire_by,
                offer_id: subscription.offer_id,
            },
        };
    } catch (error) {
        logger.error('[Razorpay] fetchSubscription error:', error);
        throw new Error(`Failed to fetch subscription: ${error.message}`);
    }
};

export const createCustomer = async (customerData) => {
    try {
        const options = {
            name: customerData.name,
            email: customerData.email,
            contact: customerData.phone,
            fail_existing: '0',
            notes: customerData.notes || {},
        };

        const customer = await razorpay.customers.create(options);
        
        logger.info(`[Razorpay] Customer created | ID: ${customer.id} | Email: ${customerData.email}`);
        
        return {
            success: true,
            data: customer,
        };
    } catch (error) {
        logger.error('[Razorpay] createCustomer error:', error);
        throw new Error(`Failed to create customer: ${error.message}`);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

export const generateRazorpayOrderId = () => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `order_${timestamp}_${random}`;
};

export const verifyWebhookSignature = (webhookBody, webhookSignature) => {
    try {
        const expectedSignature = crypto
            .createHmac('sha256', ENV.RAZORPAY_KEY_SECRET)
            .update(JSON.stringify(webhookBody))
            .digest('hex');

        return expectedSignature === webhookSignature;
    } catch (error) {
        logger.error('[Razorpay] Webhook signature verification error:', error);
        return false;
    }
};
