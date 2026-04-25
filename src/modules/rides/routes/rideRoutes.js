import express from 'express';
import * as controller from '../controllers/rideController.js';
import { authenticate, authorize } from '../../../core/middleware/auth.middleware.js';
import { validate } from '../../../core/middleware/validation.middleware.js';
import * as validator from '../validators/rideValidator.js';
import ridePaymentRoutes from './ridePaymentRoutes.js';

// ─── New Feature Controllers ─────────────────────────────────────────────────
import * as cancelCtrl    from '../controllers/rideCancellationController.js';
import * as otpCtrl       from '../controllers/rideOtpController.js';
import * as invoiceCtrl   from '../controllers/rideInvoiceController.js';
import * as schedCtrl     from '../controllers/scheduledRideController.js';
import * as collectionCtrl from '../controllers/rideCollectionController.js';
import {
    cancelRideSchema, verifyOtpSchema, scheduleRideSchema,
    validate as joiValidate,
} from '../validators/rideNewFeatures.validator.js';
import Joi from 'joi';

const router = express.Router();

router.use(authenticate);

// GET /nearby-drivers – uses QUERY validators
router.get('/nearby-drivers',
    validate([
        validator.validateVehicleTypeQuery(),
        validator.validateLatitudeQuery('latitude'),
        validator.validateLongitudeQuery('longitude')
    ]),
    controller.findNearbyDrivers
);

router.post('/calculate-fare', controller.calculateFare);

router.post('/request',
    authorize('passenger'),
    validate(validator.requestRideValidators),
    controller.requestRide
);

router.get('/passenger/history',
    authorize('passenger'),
    validate(validator.getRideHistoryValidators),
    controller.getPassengerRideHistory
);

router.post('/:rideId/accept',
    authorize('driver'),
    validate(validator.acceptRideValidators),
    controller.acceptRide
);

router.patch('/:rideId/status',
    authorize('driver'),
    validate(validator.updateRideStatusValidators),
    controller.updateRideStatus
);

router.get('/driver/history',
    authorize('driver'),
    validate(validator.getRideHistoryValidators),
    controller.getDriverRideHistory
);

router.get('/current', controller.getCurrentRide);

router.get('/:rideId',
    validate(validator.acceptRideValidators),
    controller.getRideDetails
);

router.post('/:rideId/rate',
    validate(validator.rateRideValidators),
    controller.rateRide
);


// ═════════════════════════════════════════════════════════════════════════════
//  NEW FEATURE ENDPOINTS
// ═════════════════════════════════════════════════════════════════════════════

// ─── Ride Cancellation (Passenger) ──────────────────────────────────────────
// POST /api/v1/rides/:rideId/cancel
router.post(
    '/:rideId/cancel',
    authorize('passenger'),
    joiValidate(cancelRideSchema),
    cancelCtrl.cancelRide
);

// ─── Ride OTP Verification ──────────────────────────────────────────────────
// POST /api/v1/rides/:rideId/verify-otp — driver enters passenger's OTP
router.post(
    '/:rideId/verify-otp',
    authorize('driver'),
    joiValidate(verifyOtpSchema),
    otpCtrl.verifyOtp
);

// ─── Ride Invoice ───────────────────────────────────────────────────────────
// GET /api/v1/rides/:rideId/invoice — get receipt after ride
router.get('/:rideId/invoice', invoiceCtrl.getInvoice);

// ─── Cash Collection (Driver confirms payment received) ────────────────────
// Validation schema for cash collection
const collectConfirmSchema = Joi.object({
    collection_method: Joi.string().valid('cash', 'personal_upi').default('cash'),
});

// POST /api/v1/rides/:rideId/collect-confirm — driver confirms cash collection
router.post(
    '/:rideId/collect-confirm',
    authorize('driver'),
    joiValidate(collectConfirmSchema),
    collectionCtrl.confirmCollection
);

// GET /api/v1/rides/:rideId/collection-status — get collection status
router.get('/:rideId/collection-status', collectionCtrl.getCollectionStatus);

// ─── Scheduled Rides (Book for Later) ───────────────────────────────────────
// POST /api/v1/rides/schedule
router.post(
    '/schedule',
    authorize('passenger'),
    joiValidate(scheduleRideSchema),
    schedCtrl.scheduleRide
);

// GET /api/v1/rides/scheduled — my scheduled rides
router.get('/scheduled', authorize('passenger'), schedCtrl.getMyScheduled);

// DELETE /api/v1/rides/scheduled/:id — cancel scheduled ride
router.delete('/scheduled/:id', authorize('passenger'), schedCtrl.cancelScheduled);

// ─── Ride Payments ─────────────────────────────────────────────────────
// Mount payment-specific routes under /payments
router.use('/payments', ridePaymentRoutes);

export default router;