import express from 'express';
import * as controller from '../controllers/couponController.js';
import { authenticate } from '../../../core/middleware/auth.middleware.js';
import { applyCouponSchema, validate } from '../validators/couponValidator.js';

const router = express.Router();

router.use(authenticate);

// GET /api/v1/coupons/available?vehicleType=bike — available coupons
router.get('/available', controller.getAvailable);

// POST /api/v1/coupons/apply — validate + calculate discount
router.post('/apply', validate(applyCouponSchema), controller.applyCoupon);

export default router;
