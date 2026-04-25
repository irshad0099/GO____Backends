import express from 'express';
import { authenticate, authorize } from '../../../core/middleware/auth.middleware.js';
import { kycUpload, enforcePdfSize, handleKycUploadError } from '../middleware/kycUpload.middleware.js';
import * as ctrl from '../controllers/kycController.js';

const router = express.Router();

// All KYC routes require auth
router.use(authenticate);

// ─── Driver routes ────────────────────────────────────────────────────────────

// GET  /api/v1/kyc/status
router.get('/status', authorize('driver'), ctrl.getStatus);

// POST /api/v1/kyc/submit  — AADHAAR | PAN | DRIVING_LICENCE | VEHICLE_RC
// multipart/form-data: { document_type, file, file_back? }
// file_back optional — AADHAAR ke liye address fetch karne ke liye
router.post(
    '/submit',
    authorize('driver'),
    kycUpload.fields([{ name: 'file', maxCount: 1 }, { name: 'file_back', maxCount: 1 }]),
    handleKycUploadError,
    enforcePdfSize,
    ctrl.submitDocument
);

// POST /api/v1/kyc/documents/:id/retry
router.post(
    '/documents/:id/retry',
    authorize('driver'),
    kycUpload.fields([{ name: 'file', maxCount: 1 }, { name: 'file_back', maxCount: 1 }]),
    handleKycUploadError,
    enforcePdfSize,
    ctrl.retryDocument
);

// POST /api/v1/kyc/bank
// Body: { account_number, ifsc, name }
router.post('/bank', authorize('driver'), ctrl.submitBankAccount);

// POST /api/v1/kyc/face-match  — selfie upload
// multipart/form-data: { selfie: <image> }
router.post(
    '/face-match',
    authorize('driver'),
    kycUpload.single('selfie'),
    handleKycUploadError,
    ctrl.submitFaceMatch
);

// ─── Admin routes ─────────────────────────────────────────────────────────────

// GET  /api/v1/kyc/admin/queue?type=AADHAAR&page=1&limit=20
router.get('/admin/queue', authorize('admin'), ctrl.getReviewQueue);

// GET  /api/v1/kyc/admin/documents/:id
router.get('/admin/documents/:id', authorize('admin'), ctrl.getDocumentForAdmin);

// POST /api/v1/kyc/admin/documents/:id/approve
router.post('/admin/documents/:id/approve', authorize('admin'), ctrl.approveDocument);

// POST /api/v1/kyc/admin/documents/:id/reject
router.post('/admin/documents/:id/reject', authorize('admin'), ctrl.rejectDocument);

// GET  /api/v1/kyc/admin/fraud-alerts?severity=HIGH
router.get('/admin/fraud-alerts', authorize('admin'), ctrl.getFraudAlerts);

// POST /api/v1/kyc/admin/drivers/:userId/suspend
router.post('/admin/drivers/:userId/suspend', authorize('admin'), ctrl.suspendDriver);

export default router;
