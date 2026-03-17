import express from 'express';
import * as controller from '../controllers/subscriptionController.js';
import { authenticate, authorize } from '../../../core/middleware/auth.middleware.js';
import { validate } from '../../../core/middleware/validation.middleware.js';
import * as validator from '../validators/subscriptionValidator.js';

const router = express.Router();

// ==================== Public routes (no auth required) ====================
router.get('/plans', controller.getAllPlans);
router.get('/plans/:slug', validate([validator.validatePlanSlug()]), controller.getPlanBySlug);

// ==================== Protected user routes ====================
router.use(authenticate); // all routes below require authentication

router.get('/me/active', controller.getMyActiveSubscription);
router.get('/me/history', controller.getMySubscriptions);
router.post('/purchase', validate(validator.validatePurchase), controller.purchaseSubscription);
router.post('/:subscriptionId/cancel', validate(validator.validateCancel), controller.cancelMySubscription);

// ==================== Admin only routes ====================
router.post('/admin/plans', authorize('admin'), validate(validator.validateCreatePlan), controller.createPlan);
router.put('/admin/plans/:planId', authorize('admin'), validate(validator.validateUpdatePlan), controller.updatePlan);
router.post('/admin/expire', authorize('admin'), controller.expireOverdue);
router.post('/admin/reset-free-rides', authorize('admin'), controller.resetFreeRides);

export default router;