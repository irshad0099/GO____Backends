import * as subscriptionService from '../services/subscriptionService.js';
import logger from '../../../core/logger/logger.js';

// ==================== Plans (Public) ====================
export const getAllPlans = async (req, res, next) => {
    try {
        const plans = await subscriptionService.getAllPlans();
        res.status(200).json({ success: true, data: plans });
    } catch (error) {
        next(error);
    }
};

export const getPlanBySlug = async (req, res, next) => {
    try {
        const { slug } = req.params;
        const plan = await subscriptionService.getPlanBySlug(slug);
        res.status(200).json({ success: true, data: plan });
    } catch (error) {
        next(error);
    }
};

// ==================== Plans (Admin) ====================
export const createPlan = async (req, res, next) => {
    try {
        const planData = req.body;
        const plan = await subscriptionService.createPlan(planData);
        res.status(201).json({ success: true, message: 'Plan created', data: plan });
    } catch (error) {
        next(error);
    }
};

export const updatePlan = async (req, res, next) => {
    try {
        const { planId } = req.params;
        const updates = req.body;
        const plan = await subscriptionService.updatePlan(planId, updates);
        res.status(200).json({ success: true, message: 'Plan updated', data: plan });
    } catch (error) {
        next(error);
    }
};

// ==================== User Subscriptions ====================
export const getMyActiveSubscription = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const subscription = await subscriptionService.getMyActiveSubscription(userId);
        res.status(200).json({ success: true, data: subscription });
    } catch (error) {
        next(error);
    }
};

export const getMySubscriptions = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const subscriptions = await subscriptionService.getMySubscriptions(userId);
        res.status(200).json({ success: true, data: subscriptions });
    } catch (error) {
        next(error);
    }
};

export const purchaseSubscription = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { planId, paymentMethod, paymentDetails } = req.body;
        const result = await subscriptionService.purchaseSubscription(userId, planId, paymentMethod, paymentDetails);
        res.status(201).json({
            success: true,
            message: 'Subscription activated successfully',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

export const cancelMySubscription = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { subscriptionId } = req.params;
        const { reason } = req.body;
        const cancelled = await subscriptionService.cancelMySubscription(userId, subscriptionId, reason);
        res.status(200).json({
            success: true,
            message: 'Subscription cancelled',
            data: cancelled
        });
    } catch (error) {
        next(error);
    }
};

// ==================== Admin Utilities ====================
export const expireOverdue = async (req, res, next) => {
    try {
        const count = await subscriptionService.expireAllOverdue();
        res.status(200).json({ success: true, message: `Expired ${count} subscriptions` });
    } catch (error) {
        next(error);
    }
};

export const resetFreeRides = async (req, res, next) => {
    try {
        const count = await subscriptionService.resetFreeRidesForAll();
        res.status(200).json({ success: true, message: `Reset free rides for ${count} active subscriptions` });
    } catch (error) {
        next(error);
    }
};