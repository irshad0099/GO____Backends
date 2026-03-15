import express from 'express';
import * as controller from '../controllers/rideController.js';
import { authenticate, authorize } from '../../../core/middleware/auth.middleware.js';
import { validate } from '../../../core/middleware/validation.middleware.js';
import * as validator from '../validators/rideValidator.js';

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

export default router;