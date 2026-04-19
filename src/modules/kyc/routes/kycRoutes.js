import express from 'express';
import { authenticate, authorize } from '../../../core/middleware/auth.middleware.js';
import { kycUpload, enforcePdfSize, handleKycUploadError } from '../middleware/kycUpload.middleware.js';
import * as ctrl from '../controllers/kycController.js';

const router = express.Router();

// POST /api/v1/kyc/digilocker/webhook — Cashfree public callback (no auth)
// Signature verified inside the service via x-webhook-signature + x-webhook-timestamp
router.post('/digilocker/webhook', ctrl.handleDigilockerWebhook);

// All KYC routes below require authentication
router.use(authenticate);

// ─── Driver KYC ───────────────────────────────────────────────────────────────

// GET  /api/v1/kyc/status — fetch current KYC status
router.get('/status', authorize('driver'), ctrl.getStatus);

// POST /api/v1/kyc/ocr — unified Smart OCR endpoint
// multipart/form-data: { document_type: PAN|AADHAAR|DRIVING_LICENCE|VEHICLE_RC, file: <image/PDF> }
router.post(
    '/ocr',
    authorize('driver'),
    kycUpload.single('file'),
    handleKycUploadError,
    enforcePdfSize,
    ctrl.submitOcrDocument
);

// POST /api/v1/kyc/bank — verify bank account
// Body: { account_number, ifsc, name }
router.post('/bank', authorize('driver'), ctrl.submitBankAccount);

// POST /api/v1/kyc/face — optional selfie face match
// Body: { selfie (base64), aadhaar_photo (base64) }
router.post('/face', authorize('driver'), ctrl.submitFaceMatch);

// ─── DigiLocker (alternate verified path) ────────────────────────────────────

// POST /api/v1/kyc/digilocker/verify — check if mobile/Aadhaar has a DigiLocker account
// Body: { mobile_number } OR { aadhaar_number } (one required)
router.post('/digilocker/verify', authorize('driver'), ctrl.submitDigilocker);

// POST /api/v1/kyc/digilocker/url — create a DigiLocker URL for document retrieval
// Body: { document_requested: ['AADHAAR','PAN','DRIVING_LICENSE'], user_flow?: 'signup'|'signin' }
router.post('/digilocker/url', authorize('driver'), ctrl.createDigilockerUrl);

// GET  /api/v1/kyc/digilocker/status — poll verification status
// Query: ?verification_id=... OR ?reference_id=...
router.get('/digilocker/status', authorize('driver'), ctrl.getDigilockerStatus);

// GET  /api/v1/kyc/digilocker/document/:document_type — fetch doc after consent (AADHAAR|PAN|DRIVING_LICENSE)
// Query: ?verification_id=... OR ?reference_id=...
router.get('/digilocker/document/:document_type', authorize('driver'), ctrl.getDigilockerDocument);

// ─── Admin KYC ────────────────────────────────────────────────────────────────

// GET  /api/v1/kyc/admin/manual-reviews — list pending manual reviews
router.get('/admin/manual-reviews', authorize('admin'), ctrl.listManualReviews);

// POST /api/v1/kyc/admin/manual-reviews/:user_id/resolve
// Body: { decision: 'approve'|'reject', reason }
router.post('/admin/manual-reviews/:user_id/resolve', authorize('admin'), ctrl.resolveReview);

export default router;
