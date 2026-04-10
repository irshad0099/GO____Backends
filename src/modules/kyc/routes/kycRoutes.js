import express from 'express';
import { authenticate, authorize } from '../../../core/middleware/auth.middleware.js';
import * as ctrl from '../controllers/kycController.js';

const router = express.Router();

// All KYC routes require authentication
router.use(authenticate);

// ─── Rider KYC ───────────────────────────────────────────────────────────────

// GET  /api/v1/kyc/status — fetch current KYC status
router.get('/status', ctrl.getStatus);

// POST /api/v1/kyc/aadhaar/otp — send OTP to Aadhaar-linked mobile
// Body: { aadhaar_number }
router.post('/aadhaar/otp', ctrl.sendAadhaarOtp);

// POST /api/v1/kyc/aadhaar/verify — submit OTP
// Body: { ref_id, otp }
router.post('/aadhaar/verify', ctrl.submitAadhaarOtp);

// POST /api/v1/kyc/pan — verify PAN
// Body: { pan_number, name }
router.post('/pan', ctrl.submitPan);

// POST /api/v1/kyc/bank — verify bank account
// Body: { account_number, ifsc, name }
router.post('/bank', ctrl.submitBankAccount);

// POST /api/v1/kyc/face — optional selfie face match
// Body: { selfie (base64), aadhaar_photo (base64) }
router.post('/face', ctrl.submitFaceMatch);

// POST /api/v1/kyc/license — verify driver license (Cashfree auto-approval)
// Body: { license_number, dob (DD-MM-YYYY), name }
router.post('/license', ctrl.submitDrivingLicense);

// POST /api/v1/kyc/rc — verify vehicle RC (Cashfree auto-approval)
// Body: { rc_number }
router.post('/rc', ctrl.submitVehicleRC);

// ─── Admin KYC ────────────────────────────────────────────────────────────────

// GET  /api/v1/kyc/admin/manual-reviews — list pending manual reviews
router.get('/admin/manual-reviews', authorize('admin'), ctrl.listManualReviews);

// POST /api/v1/kyc/admin/manual-reviews/:user_id/resolve
// Body: { decision: 'approve'|'reject', reason }
router.post('/admin/manual-reviews/:user_id/resolve', authorize('admin'), ctrl.resolveReview);

export default router;
