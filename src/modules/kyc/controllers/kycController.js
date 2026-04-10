import * as kycService from '../services/kycService.js';
import logger from '../../../core/logger/logger.js';

const respond = (res, data, status = 200) =>
    res.status(status).json({ success: true, data });

const handleError = (res, err) => {
    logger.error('KYC error:', err);
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, message: err.message });
};

// ─── Rider Endpoints ──────────────────────────────────────────────────────────

export const getStatus = async (req, res) => {
    try {
        const data = await kycService.getKycStatus(req.user.id);
        respond(res, data);
    } catch (err) { handleError(res, err); }
};

export const sendAadhaarOtp = async (req, res) => {
    try {
        const { aadhaar_number } = req.body;
        const data = await kycService.initiateAadhaarOtp(req.user.id, aadhaar_number);
        respond(res, data);
    } catch (err) { handleError(res, err); }
};

export const submitAadhaarOtp = async (req, res) => {
    try {
        const { ref_id, otp } = req.body;
        const data = await kycService.verifyAadhaarOtp(req.user.id, ref_id, otp);
        respond(res, data);
    } catch (err) { handleError(res, err); }
};

export const submitPan = async (req, res) => {
    try {
        const { pan_number, name } = req.body;
        const data = await kycService.verifyPan(req.user.id, pan_number.toUpperCase(), name);
        respond(res, data);
    } catch (err) { handleError(res, err); }
};

export const submitBankAccount = async (req, res) => {
    try {
        const { account_number, ifsc, name } = req.body;
        const data = await kycService.verifyBankAccount(req.user.id, account_number, ifsc, name);
        respond(res, data);
    } catch (err) { handleError(res, err); }
};

export const submitFaceMatch = async (req, res) => {
    try {
        const { selfie, aadhaar_photo } = req.body;
        const data = await kycService.verifyFace(req.user.id, selfie, aadhaar_photo);
        respond(res, data);
    } catch (err) { handleError(res, err); }
};

export const submitDrivingLicense = async (req, res) => {
    try {
        const { license_number, dob, name } = req.body;
        const data = await kycService.verifyDrivingLicense(req.user.id, { license_number, dob, name });
        respond(res, data);
    } catch (err) { handleError(res, err); }
};

export const submitVehicleRC = async (req, res) => {
    try {
        const { rc_number } = req.body;
        const data = await kycService.verifyVehicleRC(req.user.id, rc_number);
        respond(res, data);
    } catch (err) { handleError(res, err); }
};

// ─── Admin Endpoints ──────────────────────────────────────────────────────────

export const listManualReviews = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const data = await kycService.listManualReviews({ page: +page, limit: +limit });
        respond(res, data);
    } catch (err) { handleError(res, err); }
};

export const resolveReview = async (req, res) => {
    try {
        const { user_id } = req.params;
        const { decision, reason } = req.body;
        const data = await kycService.resolveManualReview(user_id, decision, req.user.id, reason);
        respond(res, data);
    } catch (err) { handleError(res, err); }
};
