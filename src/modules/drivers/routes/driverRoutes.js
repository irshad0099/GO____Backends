

import express from 'express';
import * as controller from '../controllers/driverController.js';
import { authenticate, authorize } from '../../../core/middleware/auth.middleware.js';
import { validate } from '../../../core/middleware/validation.middleware.js';
import * as validator from '../validators/driver.validator.js';
import { db } from '../../../infrastructure/database/postgres.js';

// ─── New Feature Controllers ─────────────────────────────────────────────────
import * as incentiveCtrl    from '../controllers/incentiveController.js';
import * as penaltyCtrl      from '../controllers/penaltyController.js';
import * as earningsCtrl     from '../controllers/earningsController.js';
import * as cashCtrl         from '../controllers/cashCollectionController.js';
import * as destCtrl         from '../controllers/destinationModeController.js';
import * as rejectCtrl       from '../controllers/rideRejectionController.js';

// ─── New Feature Validators ──────────────────────────────────────────────────
import {
    rejectRideSchema,
    setDestinationSchema,
    submitDepositSchema,
    appealSchema,
    earningsStatementSchema,
    paginationSchema,
    validate as joiValidate,
} from '../validators/newFeatures.validator.js';

const router = express.Router();

// All driver routes require authentication
router.use(authenticate);

// Driver registration and profile
router.post(
    '/register',
    authorize('passenger', 'driver'),
    validate(validator.driverRegistrationValidators),
    controller.register
);



router.get('/profile', controller.getProfile);
router.put('/profile', controller.updateProfile);

// Location and availability
router.put(
    '/location',
    validate(validator.updateLocationValidators),
    controller.updateLocation
);



// online or offline
router.patch(
    '/availability',
    controller.toggleAvailability
);

// Ride management
router.get('/rides/current', controller.getCurrentRide);
router.get('/rides/history', controller.getRideHistory);

// Earnings
router.get('/earnings', controller.getEarnings);

// ========== NEW ENDPOINTS ==========
router.get('/score', authorize('driver'), controller.getDriverScore);
router.get('/badge', authorize('driver'), controller.getDriverBadge);
router.get('/metrics/daily', authorize('driver'), controller.getDailyMetrics);




// ═════════════════════════════════════════════════════════════════════════════
//  FCM TOKEN — Push Notifications ke liye
// ═════════════════════════════════════════════════════════════════════════════
 
// POST /api/v1/drivers/fcm-token
// Driver app login ke baad FCM token save karo
router.post('/fcm-token', async (req, res) => {
    try {
        const { fcm_token } = req.body;
 
        if (!fcm_token) {
            return res.status(400).json({
                success: false,
                message: 'fcm_token is required'
            });
        }
 
        // Driver ka user_id se driver record dhundho
        const driverResult = await db.query(
            'SELECT id FROM drivers WHERE user_id = $1',
            [req.user.id]
        );
 
        if (!driverResult.rows[0]) {
            return res.status(404).json({
                success: false,
                message: 'Driver not found'
            });
        }
 
        const driverId = driverResult.rows[0].id;
 
        await db.query(
            'UPDATE drivers SET fcm_token = $1 WHERE id = $2',
            [fcm_token, driverId]
        );
 
        return res.status(200).json({
            success: true,
            message: 'FCM token saved successfully'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


// ═════════════════════════════════════════════════════════════════════════════
//  NEW FEATURE ENDPOINTS
// ═════════════════════════════════════════════════════════════════════════════

// ─── Incentives (targets & bonuses) ──────────────────────────────────────────
// GET /api/v1/drivers/incentives — active incentive plans + progress
router.get('/incentives', authorize('driver'), incentiveCtrl.getActiveIncentives);

// GET /api/v1/drivers/incentives/progress — detailed progress on all plans
router.get('/incentives/progress', authorize('driver'), incentiveCtrl.getIncentiveProgress);


// ─── Penalties & Warnings ────────────────────────────────────────────────────
// GET /api/v1/drivers/penalties — my penalties list
router.get('/penalties', authorize('driver'), penaltyCtrl.getMyPenalties);

// GET /api/v1/drivers/penalties/ban-status — am I banned?
router.get('/penalties/ban-status', authorize('driver'), penaltyCtrl.checkBanStatus);

// PATCH /api/v1/drivers/penalties/:penaltyId/acknowledge — mark as seen
router.patch(
    '/penalties/:penaltyId/acknowledge',
    authorize('driver'),
    penaltyCtrl.acknowledgePenalty
);

// POST /api/v1/drivers/penalties/:penaltyId/appeal — contest a penalty
router.post(
    '/penalties/:penaltyId/appeal',
    authorize('driver'),
    joiValidate(appealSchema),
    penaltyCtrl.appealPenalty
);

// GET /api/v1/drivers/acceptance-rate — last 7 days acceptance rate
router.get('/acceptance-rate', authorize('driver'), penaltyCtrl.getAcceptanceRate);


// ─── Earnings Reports (weekly/monthly/statement) ────────────────────────────
// GET /api/v1/drivers/earnings/weekly — past weekly summaries
router.get('/earnings/weekly', authorize('driver'), earningsCtrl.getWeeklyEarnings);

// GET /api/v1/drivers/earnings/monthly — past monthly summaries
router.get('/earnings/monthly', authorize('driver'), earningsCtrl.getMonthlyEarnings);

// GET /api/v1/drivers/earnings/current-week — live current week
router.get('/earnings/current-week', authorize('driver'), earningsCtrl.getCurrentWeekEarnings);

// GET /api/v1/drivers/earnings/statement?from=...&to=... — date range
router.get(
    '/earnings/statement',
    authorize('driver'),
    joiValidate(earningsStatementSchema, 'query'),
    earningsCtrl.getEarningsStatement
);


// ─── Cash Collection & Settlement ────────────────────────────────────────────
// GET /api/v1/drivers/cash/balance — pending cash balance
router.get('/cash/balance', authorize('driver'), cashCtrl.getCashBalance);

// POST /api/v1/drivers/cash/deposit — submit cash deposit
router.post(
    '/cash/deposit',
    authorize('driver'),
    joiValidate(submitDepositSchema),
    cashCtrl.submitDeposit
);

// GET /api/v1/drivers/cash/deposits — deposit history
router.get('/cash/deposits', authorize('driver'), cashCtrl.getDepositHistory);


// ─── Destination Mode ("Going Home") ────────────────────────────────────────
// GET /api/v1/drivers/destination-mode — current active mode
router.get('/destination-mode', authorize('driver'), destCtrl.getDestinationMode);

// POST /api/v1/drivers/destination-mode — set destination
router.post(
    '/destination-mode',
    authorize('driver'),
    joiValidate(setDestinationSchema),
    destCtrl.setDestinationMode
);

// DELETE /api/v1/drivers/destination-mode — turn off
router.delete('/destination-mode', authorize('driver'), destCtrl.removeDestinationMode);


// ─── Ride Rejection ──────────────────────────────────────────────────────────
// POST /api/v1/drivers/rides/:rideId/reject — reject a ride request
router.post(
    '/rides/:rideId/reject',
    authorize('driver'),
    joiValidate(rejectRideSchema),
    rejectCtrl.rejectRide
);

// GET /api/v1/drivers/rides/rejections — rejection history
router.get('/rides/rejections', authorize('driver'), rejectCtrl.getRejectionHistory);

// GET /api/v1/drivers/rides/acceptance-stats — acceptance rate stats
router.get('/rides/acceptance-stats', authorize('driver'), rejectCtrl.getAcceptanceStats);




export default router;