// import express from 'express';
// import * as controller from '../controllers/driverController.js';
// import { authenticate, authorize } from '../../../core/middleware/auth.middleware.js';
// import { validate } from '../../../core/middleware/validation.middleware.js';
// import * as validator from '../validators/driver.validator.js';

// const router = express.Router();

// // All driver routes require authentication
// router.use(authenticate);

// // Driver registration and profile
// router.post(
//     '/register',
//     authorize('passenger', 'driver'),
//     validate(validator.driverRegistrationValidators),
//     controller.register
// );

// router.get('/profile', controller.getProfile);

// router.put('/profile', controller.updateProfile);

// // Location and availability
// router.put(
//     '/location',
//     validate(validator.updateLocationValidators),
//     controller.updateLocation
// );

// router.patch(
//     '/availability',
//     controller.toggleAvailability
// );

// // Ride management
// router.get('/rides/current', controller.getCurrentRide);

// router.get('/rides/history', controller.getRideHistory);

// // Earnings
// router.get('/earnings', controller.getEarnings);

// export default router;


import express from 'express';
import * as controller from '../controllers/driverController.js';
import { authenticate, authorize } from '../../../core/middleware/auth.middleware.js';
import { validate } from '../../../core/middleware/validation.middleware.js';
import * as validator from '../validators/driver.validator.js';

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

export default router;