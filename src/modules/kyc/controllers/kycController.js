import * as kycService from '../services/kycService.js';
import logger from '../../../core/logger/logger.js';
import { sendResponse, sendError } from '../../../core/utils/response.js';

// ─── DigiLocker Webhook (public — no auth) ───────────────────────────────────

export const handleDigilockerWebhook = async (req, res) => {
    try {
        const rawBody = req.rawBody?.toString('utf8') || JSON.stringify(req.body);
        await kycService.processDigilockerWebhook(rawBody, req.headers);
        res.status(200).json({ success: true });
    } catch (err) {
        logger.error('DigiLocker webhook error:', err);
        res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
};

// ─── Rider Endpoints ──────────────────────────────────────────────────────────

export const getStatus = async (req, res) => {
    try {
        const data = await kycService.getKycStatus(req.user.id);
        sendResponse(res, 200, '', data);
    } catch (err) {
        logger.error('KYC error:', err);
        sendError(res, err.statusCode || 500, err.message);
    }
};

/**
 * POST /kyc/ocr — unified Smart OCR endpoint for PAN / AADHAAR / DRIVING_LICENCE / VEHICLE_RC
 * multipart/form-data: { document_type, file }
 */
export const submitOcrDocument = async (req, res) => {
    try {
        if (!req.file) {
            return sendError(res, 400, 'Document file is required (field name: file)');
        }
        const documentType = (req.body.document_type || '').toUpperCase();
        if (!documentType) {
            return sendError(res, 400, 'document_type is required (PAN | AADHAAR | DRIVING_LICENCE | VEHICLE_RC)');
        }

        const data = await kycService.submitOcrDocument(req.user.id, documentType, {
            fileBuffer: req.file.buffer,
            fileName:   req.file.originalname,
            mimeType:   req.file.mimetype,
        });
        sendResponse(res, 200, `${documentType} verified via OCR`, data);
    } catch (err) {
        logger.error('KYC error:', err);
        sendError(res, err.statusCode || 500, err.message);
    }
};

export const submitBankAccount = async (req, res) => {
    try {
        const { account_number, ifsc, name } = req.body;
        const data = await kycService.verifyBankAccount(req.user.id, account_number, ifsc, name);
        sendResponse(res, 200, '', data);
    } catch (err) {
        logger.error('KYC error:', err);
        sendError(res, err.statusCode || 500, err.message);
    }
};

export const submitFaceMatch = async (req, res) => {
    try {
        const { selfie, aadhaar_photo } = req.body;
        const data = await kycService.verifyFace(req.user.id, selfie, aadhaar_photo);
        sendResponse(res, 200, '', data);
    } catch (err) {
        logger.error('KYC error:', err);
        sendError(res, err.statusCode || 500, err.message);
    }
};

export const getDigilockerDocument = async (req, res) => {
    try {
        const { document_type } = req.params;
        const { verification_id, reference_id } = req.query;
        const data = await kycService.getDigilockerDocument(req.user.id, document_type, { verification_id, reference_id });
        sendResponse(res, 200, '', data);
    } catch (err) {
        logger.error('KYC error:', err);
        sendError(res, err.statusCode || 500, err.message);
    }
};

export const getDigilockerStatus = async (req, res) => {
    try {
        const { verification_id, reference_id } = req.query;
        const data = await kycService.getDigilockerStatus(req.user.id, { verification_id, reference_id });
        sendResponse(res, 200, '', data);
    } catch (err) {
        logger.error('KYC error:', err);
        sendError(res, err.statusCode || 500, err.message);
    }
};

export const createDigilockerUrl = async (req, res) => {
    try {
        const { document_requested, user_flow } = req.body;
        const data = await kycService.createDigilockerUrl(req.user.id, { document_requested, user_flow });
        sendResponse(res, 200, '', data);
    } catch (err) {
        logger.error('KYC error:', err);
        sendError(res, err.statusCode || 500, err.message);
    }
};

export const submitDigilocker = async (req, res) => {
    try {
        const { mobile_number, aadhaar_number } = req.body;
        const data = await kycService.verifyDigilocker(req.user.id, mobile_number, aadhaar_number);
        sendResponse(res, 200, '', data);
    } catch (err) {
        logger.error('KYC error:', err);
        sendError(res, err.statusCode || 500, err.message);
    }
};

// ─── Admin Endpoints ──────────────────────────────────────────────────────────

export const listManualReviews = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const data = await kycService.listManualReviews({ page: +page, limit: +limit });
        sendResponse(res, 200, '', data);
    } catch (err) {
        logger.error('KYC error:', err);
        sendError(res, err.statusCode || 500, err.message);
    }
};

export const resolveReview = async (req, res) => {
    try {
        const { user_id } = req.params;
        const { decision, reason } = req.body;
        const data = await kycService.resolveManualReview(user_id, decision, req.user.id, reason);
        sendResponse(res, 200, '', data);
    } catch (err) {
        logger.error('KYC error:', err);
        sendError(res, err.statusCode || 500, err.message);
    }
};
