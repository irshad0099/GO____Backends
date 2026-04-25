import express from 'express';

import {
    getDashboard,
    getUsers,
    getUser,
    updateUserStatus,
    getDrivers,
    getDriver,
    updateDriverVerification,
    updateDriverStatus,
    getRides,
    getTransactions,
    getRevenueAnalytics,
} from '../controllers/admincontroller.js';

import {
    userFilterSchema,
    driverFilterSchema,
    rideFilterSchema,
    transactionFilterSchema,
    toggleStatusSchema,
    verifyDriverSchema,
    analyticsSchema,
    validate,
} from '../validators/adminvalidator.js';

import { authenticate } from '../../../core/middleware/auth.middleware.js';
import { requireRole }  from '../../../core/middleware/roleMiddleware.js';
import { apiLimiter }   from '../../../core/middleware/rateLimiter.middleware.js';

const router = express.Router();

// All admin routes — must be logged in AND must have admin role
router.use(authenticate);
router.use(requireRole(['admin']));
router.use(apiLimiter);

// ─── Dashboard ────────────────────────────────────────────────────────────────
// GET /api/v1/admin/dashboard
router.get('/dashboard', getDashboard);

// ─── Users ───────────────────────────────────────────────────────────────────
// GET /api/v1/admin/users
router.get('/users',                validate(userFilterSchema, 'query'), getUsers);
// GET /api/v1/admin/users/:userId
router.get('/users/:userId',        getUser);
// PATCH /api/v1/admin/users/:userId/status
router.patch('/users/:userId/status', validate(toggleStatusSchema), updateUserStatus);

// ─── Drivers ─────────────────────────────────────────────────────────────────
// GET /api/v1/admin/drivers
router.get('/drivers',                     validate(driverFilterSchema, 'query'), getDrivers);
// GET /api/v1/admin/drivers/:driverId
router.get('/drivers/:driverId',           getDriver);
// PATCH /api/v1/admin/drivers/:driverId/verify
router.patch('/drivers/:driverId/verify',  validate(verifyDriverSchema), updateDriverVerification);
// PATCH /api/v1/admin/drivers/:driverId/status
router.patch('/drivers/:driverId/status',  validate(toggleStatusSchema), updateDriverStatus);

// ─── Rides ───────────────────────────────────────────────────────────────────
// GET /api/v1/admin/rides
router.get('/rides', validate(rideFilterSchema, 'query'), getRides);

// ─── Transactions ────────────────────────────────────────────────────────────
// GET /api/v1/admin/transactions
router.get('/transactions', validate(transactionFilterSchema, 'query'), getTransactions);

// ─── Analytics ───────────────────────────────────────────────────────────────
// GET /api/v1/admin/analytics/revenue?days=7
router.get('/analytics/revenue', validate(analyticsSchema, 'query'), getRevenueAnalytics);

export default router;