import express from 'express';
import { authenticate, authorize } from '../../../core/middleware/auth.middleware.js';
import * as ctrl from '../controllers/driverKycController.js';

const router = express.Router();

router.use(authenticate);

// ─── Driver KYC ───────────────────────────────────────────────────────────────

// GET  /api/v1/driver-kyc/status
router.get('/status', authorize('driver'), ctrl.getStatus);

// POST /api/v1/driver-kyc/aadhaar/otp     body: { aadhaar_number }
router.post('/aadhaar/otp', authorize('driver'), ctrl.sendAadhaarOtp);

// POST /api/v1/driver-kyc/aadhaar/verify  body: { ref_id, otp }
router.post('/aadhaar/verify', authorize('driver'), ctrl.submitAadhaarOtp);

// POST /api/v1/driver-kyc/pan             body: { pan_number, name }
router.post('/pan', authorize('driver'), ctrl.submitPan);

// POST /api/v1/driver-kyc/bank            body: { account_number, ifsc, name }
router.post('/bank', authorize('driver'), ctrl.submitBank);

// POST /api/v1/driver-kyc/license         body: { license_number, dob, name }
// dob format: DD-MM-YYYY
router.post('/license', authorize('driver'), ctrl.submitDl);

// POST /api/v1/driver-kyc/rc              body: { rc_number }
// rc_number: vehicle registration number e.g. MH01AB1234
router.post('/rc', authorize('driver'), ctrl.submitRc);

// ─── Admin ────────────────────────────────────────────────────────────────────

// GET  /api/v1/driver-kyc/admin/manual-reviews?page=1&limit=20
router.get('/admin/manual-reviews', authorize('admin'), ctrl.listManualReviews);

// POST /api/v1/driver-kyc/admin/manual-reviews/:driver_id/resolve
// body: { dl_decision?: 'approve'|'reject', rc_decision?: 'approve'|'reject', reason? }
router.post('/admin/manual-reviews/:driver_id/resolve', authorize('admin'), ctrl.resolveReview);

export default router;
