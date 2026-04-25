import * as kycService from '../services/kycService.js';
import logger from '../../../core/logger/logger.js';
import { sendResponse, sendError } from '../../../core/utils/response.js';

// ─── Driver endpoints ──────────────────────────────────────────────────────────

export const getStatus = async (req, res) => {
    try {
        const data = await kycService.getKycStatus(req.user.id);
        sendResponse(res, 200, '', data);
    } catch (err) {
        logger.error('[KYC] getStatus error:', err);
        sendError(res, err.statusCode || 500, err.message);
    }
};

export const submitDocument = async (req, res) => {
    try {
        const frontFile = req.files?.file?.[0] || req.file;
        if (!frontFile) return sendError(res, 400, 'Document file is required');

        const docType = (req.body.document_type || '').toUpperCase();
        if (!docType) return sendError(res, 400, 'document_type is required (AADHAAR | PAN | DRIVING_LICENCE | VEHICLE_RC)');

        const backFile = req.files?.file_back?.[0] || null;

        const data = await kycService.submitDocument(req.user.id, docType, {
            fileBuffer:     frontFile.buffer,
            fileName:       frontFile.originalname,
            mimeType:       frontFile.mimetype,
            backFileBuffer: backFile?.buffer   || null,
            backFileName:   backFile?.originalname || null,
            backMimeType:   backFile?.mimetype || null,
        });

        const httpStatus = data.status === 'rejected' ? 422 : 200;
        res.status(httpStatus).json({ success: data.status !== 'rejected', data });
    } catch (err) {
        logger.error('[KYC] submitDocument error:', err);
        if (err.statusCode === 409) return sendError(res, 409, err.message);
        sendError(res, err.statusCode || 500, err.message);
    }
};

export const retryDocument = async (req, res) => {
    try {
        const frontFile = req.files?.file?.[0] || req.file;
        if (!frontFile) return sendError(res, 400, 'Document file is required');
        const { id } = req.params;

        const backFile = req.files?.file_back?.[0] || null;

        const data = await kycService.retryDocument(Number(id), req.user.id, {
            fileBuffer:     frontFile.buffer,
            fileName:       frontFile.originalname,
            mimeType:       frontFile.mimetype,
            backFileBuffer: backFile?.buffer       || null,
            backFileName:   backFile?.originalname || null,
            backMimeType:   backFile?.mimetype     || null,
        });

        const httpStatus = data.status === 'rejected' ? 422 : 200;
        res.status(httpStatus).json({ success: data.status !== 'rejected', data });
    } catch (err) {
        logger.error('[KYC] retryDocument error:', err);
        sendError(res, err.statusCode || 500, err.message);
    }
};

export const submitBankAccount = async (req, res) => {
    try {
        const { account_number, ifsc, name } = req.body;
        if (!account_number || !ifsc || !name) {
            return sendError(res, 400, 'account_number, ifsc, and name are required');
        }
        const data = await kycService.submitBankAccount(req.user.id, account_number, ifsc, name);
        sendResponse(res, 200, data.message, data);
    } catch (err) {
        logger.error('[KYC] submitBankAccount error:', err);
        if (err.statusCode === 409) return sendError(res, 409, err.message);
        sendError(res, err.statusCode || 500, err.message);
    }
};

export const submitFaceMatch = async (req, res) => {
    try {
        if (!req.file) return sendError(res, 400, 'Selfie image is required');
        const data = await kycService.submitFaceMatch(req.user.id, {
            fileBuffer: req.file.buffer,
            mimeType:   req.file.mimetype,
        });
        const httpStatus = data.status === 'rejected' ? 422 : 200;
        res.status(httpStatus).json({ success: data.status !== 'rejected', data });
    } catch (err) {
        logger.error('[KYC] submitFaceMatch error:', err);
        sendError(res, err.statusCode || 500, err.message);
    }
};

// ─── Admin endpoints ───────────────────────────────────────────────────────────

export const getReviewQueue = async (req, res) => {
    try {
        const { type, page = 1, limit = 20 } = req.query;
        const data = await kycService.getReviewQueue(type || null, Number(page), Number(limit));
        sendResponse(res, 200, '', data);
    } catch (err) {
        logger.error('[KYC] getReviewQueue error:', err);
        sendError(res, err.statusCode || 500, err.message);
    }
};

export const getDocumentForAdmin = async (req, res) => {
    try {
        const data = await kycService.getDocumentForAdmin(Number(req.params.id));
        sendResponse(res, 200, '', data);
    } catch (err) {
        logger.error('[KYC] getDocumentForAdmin error:', err);
        sendError(res, err.statusCode || 500, err.message);
    }
};

export const approveDocument = async (req, res) => {
    try {
        const { notes } = req.body;
        const data = await kycService.approveDocument(Number(req.params.id), req.user.id, notes);
        sendResponse(res, 200, 'Document approved', data);
    } catch (err) {
        logger.error('[KYC] approveDocument error:', err);
        sendError(res, err.statusCode || 500, err.message);
    }
};

export const rejectDocument = async (req, res) => {
    try {
        const { reason, allowRetry = true } = req.body;
        if (!reason) return sendError(res, 400, 'reason is required');
        const data = await kycService.rejectDocument(Number(req.params.id), req.user.id, reason, allowRetry);
        sendResponse(res, 200, 'Document rejected', data);
    } catch (err) {
        logger.error('[KYC] rejectDocument error:', err);
        sendError(res, err.statusCode || 500, err.message);
    }
};

export const getFraudAlerts = async (req, res) => {
    try {
        const { severity } = req.query;
        const data = await kycService.getFraudAlerts(severity || null);
        sendResponse(res, 200, '', data);
    } catch (err) {
        logger.error('[KYC] getFraudAlerts error:', err);
        sendError(res, err.statusCode || 500, err.message);
    }
};

export const suspendDriver = async (req, res) => {
    try {
        const { userId } = req.params;
        const { reason } = req.body;
        if (!reason) return sendError(res, 400, 'reason is required');
        const data = await kycService.suspendDriverByAdmin(Number(userId), req.user.id, reason);
        sendResponse(res, 200, 'Driver suspended', data);
    } catch (err) {
        logger.error('[KYC] suspendDriver error:', err);
        sendError(res, err.statusCode || 500, err.message);
    }
};
