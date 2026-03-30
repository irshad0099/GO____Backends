import logger from '../../../core/logger/logger.js';
import {
    fetchAllPlans,
    fetchPlanById,
    fetchActiveSubscription,
    purchaseSubscription,
    cancelSubscription,
    toggleAutoRenew,
    applyRideBenefits,
    fetchSubscriptionHistory,
    fetchSubscriptionPayments,
    createNewPlan,
    setPlanActiveStatus,
} from '../services/subscriptionService.js';

// ─── Error handler ────────────────────────────────────────────────────────────

const handleError = (res, error) => {
    logger.error(`[SubscriptionController] ${error.message}`);
    const status = error.statusCode || 500;
    return res.status(status).json({
        success: false,
        message: error.message || 'Internal server error',
    });
};

// ─────────────────────────────────────────────────────────────────────────────
//  PUBLIC
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/subscriptions/plans
// All available plans — shown on pricing page
export const getPlans = async (req, res) => {
    try {
        const result = await fetchAllPlans();
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

// GET /api/v1/subscriptions/plans/:planId
// Single plan detail
export const getPlan = async (req, res) => {
    try {
        const result = await fetchPlanById(parseInt(req.params.planId));
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  USER — Subscription management
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/subscriptions/active
// User's current active subscription + benefits
export const getActiveSubscription = async (req, res) => {
    try {
        const result = await fetchActiveSubscription(req.user.id);
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

// POST /api/v1/subscriptions/purchase
// Subscribe to a plan
export const purchase = async (req, res) => {
    try {
        const result = await purchaseSubscription(req.user.id, req.body);
        return res.status(201).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

// POST /api/v1/subscriptions/cancel
// Cancel active subscription (benefits still valid till expiry)
export const cancel = async (req, res) => {
    try {
        const result = await cancelSubscription(req.user.id, req.body);
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

// PATCH /api/v1/subscriptions/auto-renew
// Enable or disable auto-renewal
export const autoRenew = async (req, res) => {
    try {
        const result = await toggleAutoRenew(req.user.id, req.body);
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

// POST /api/v1/subscriptions/apply-benefits
// Check & apply ride discount / free ride for a given ride amount
// Called by ride-service before billing user
export const applyBenefits = async (req, res) => {
    try {
        const { ride_amount } = req.body;
        const result = await applyRideBenefits(req.user.id, parseFloat(ride_amount));
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

// GET /api/v1/subscriptions/history
// Paginated subscription history
export const getHistory = async (req, res) => {
    try {
        const { limit = 10, offset = 0 } = req.query;
        const result = await fetchSubscriptionHistory(req.user.id, {
            limit:  parseInt(limit),
            offset: parseInt(offset),
        });
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

// GET /api/v1/subscriptions/:subscriptionId/payments
// Payment history for a specific subscription
export const getPayments = async (req, res) => {
    try {
        const result = await fetchSubscriptionPayments(
            req.user.id,
            parseInt(req.params.subscriptionId)
        );
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  ADMIN
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/v1/subscriptions/admin/plans
// Create a new subscription plan
export const adminCreatePlan = async (req, res) => {
    try {
        const result = await createNewPlan(req.body);
        return res.status(201).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};

// PATCH /api/v1/subscriptions/admin/plans/:planId/status
// Activate or deactivate a plan
export const adminTogglePlan = async (req, res) => {
    try {
        const { is_active } = req.body;
        const result = await setPlanActiveStatus(parseInt(req.params.planId), is_active);
        return res.status(200).json(result);
    } catch (error) {
        return handleError(res, error);
    }
};