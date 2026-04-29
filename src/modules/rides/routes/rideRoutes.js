import express from 'express';
import * as controller from '../controllers/rideController.js';
import { authenticate, authorize } from '../../../core/middleware/auth.middleware.js';
import { validate } from '../../../core/middleware/validation.middleware.js';
import * as validator from '../validators/rideValidator.js';

// ─── New Feature Controllers ─────────────────────────────────────────────────
import * as cancelCtrl    from '../controllers/rideCancellationController.js';
import * as otpCtrl       from '../controllers/rideOtpController.js';
import * as invoiceCtrl   from '../controllers/rideInvoiceController.js';
import * as schedCtrl     from '../controllers/scheduledRideController.js';
import {
    cancelRideSchema, verifyOtpSchema, scheduleRideSchema,
    validate as joiValidate,
} from '../validators/rideNewFeatures.validator.js';

const router = express.Router();

router.use(authenticate);

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

router.post('/:rideId/reject',
    authorize('driver'),
    controller.rejectRide
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

// ─── Emergency Cancel (Driver) ───────────────────────────────────────────────
// POST /api/v1/rides/:rideId/driver-cancel
router.post(
    '/:rideId/driver-cancel',
    authorize('driver'),
    cancelCtrl.driverCancelRide
);

// ─── Ride OTP Generation ────────────────────────────────────────────────────
// POST /api/v1/rides/:rideId/generate-otp — driver/system generates & sends OTP to passenger
router.post(
    '/:rideId/generate-otp',
    authorize('driver'),
    otpCtrl.generateOtp
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

// GET /api/v1/rides/:rideId/driver-summary — trip completed screen ke liye
router.get('/:rideId/driver-summary', authorize('driver'), controller.getDriverRideSummary);




export default router;