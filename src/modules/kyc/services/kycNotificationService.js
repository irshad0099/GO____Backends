import { db } from '../../../infrastructure/database/postgres.js';
import { sendNotification } from '../../../core/services/firebaseService.js';
import { saveNotification } from '../../notifications/services/notification.service.js';
import logger from '../../../core/logger/logger.js';

const getDriverFcmToken = async (userId) => {
    const { rows } = await db.query(
        `SELECT d.fcm_token FROM drivers d WHERE d.user_id = $1`,
        [userId]
    );
    return rows[0]?.fcm_token || null;
};

const notify = async (userId, { type, title, body, rideId = null }) => {
    try {
        await saveNotification({ userId, type, title, body, rideId });
    } catch (err) {
        logger.warn(`[KYC Notify] DB save failed user=${userId}:`, err.message);
    }
    try {
        const fcmToken = await getDriverFcmToken(userId);
        if (fcmToken) await sendNotification(fcmToken, title, body, { type });
    } catch (err) {
        logger.warn(`[KYC Notify] FCM failed user=${userId}:`, err.message);
    }
};

const DOC_LABEL = {
    AADHAAR:         'Aadhaar',
    PAN:             'PAN Card',
    DRIVING_LICENCE: 'Driving Licence',
    VEHICLE_RC:      'Vehicle RC',
    BANK_ACCOUNT:    'Bank Account',
    SELFIE:          'Selfie',
};

// ─── Triggers ─────────────────────────────────────────────────────────────────

export const notifyDocSubmitted = async (userId, docType, status, attemptsLeft, rejectionReason) => {
    const label = DOC_LABEL[docType] || docType;

    if (status === 'auto_verified') {
        await notify(userId, {
            type:  'KYC_DOC_VERIFIED',
            title: `${label} Verified`,
            body:  `Your ${label} has been successfully verified.`,
        });
    } else if (status === 'manual_review') {
        await notify(userId, {
            type:  'KYC_DOC_REVIEW',
            title: `${label} Under Review`,
            body:  `Your ${label} is under review. You will be notified within 24 hours.`,
        });
    } else if (status === 'rejected') {
        const retriesMsg = attemptsLeft > 0
            ? `You have ${attemptsLeft} attempt(s) remaining.`
            : 'No attempts remaining. Please contact support.';
        await notify(userId, {
            type:  'KYC_DOC_REJECTED',
            title: `${label} Rejected`,
            body:  `${rejectionReason || 'Document verification failed.'} ${retriesMsg}`,
        });
    }
};

export const notifyAdminApproved = async (userId, docType) => {
    const label = DOC_LABEL[docType] || docType;
    await notify(userId, {
        type:  'KYC_DOC_APPROVED',
        title: `${label} Approved`,
        body:  `Your ${label} has been approved by our team.`,
    });
};

export const notifyAdminRejected = async (userId, docType, reason, attemptsLeft) => {
    const label = DOC_LABEL[docType] || docType;
    const retriesMsg = attemptsLeft > 0
        ? `You have ${attemptsLeft} attempt(s) remaining.`
        : 'Please contact support.';
    await notify(userId, {
        type:  'KYC_DOC_REJECTED',
        title: `${label} Rejected`,
        body:  `${reason} ${retriesMsg}`,
    });
};

export const notifyKycComplete = async (userId) => {
    await notify(userId, {
        type:  'KYC_COMPLETE',
        title: 'KYC Verification Complete',
        body:  'All your documents have been verified. You can now go online and accept rides.',
    });
};

export const notifyCrossVerifyFailed = async (userId, failedCount) => {
    await notify(userId, {
        type:  'KYC_DOC_REVIEW',
        title: 'Document Review Required',
        body:  `${failedCount} document(s) require manual review due to inconsistencies. Our team will verify within 24 hours.`,
    });
};

export const notifyDocDowngraded = async (userId, docType) => {
    const label = DOC_LABEL[docType] || docType;
    await notify(userId, {
        type:  'KYC_DOC_REVIEW',
        title: `${label} Under Review`,
        body:  `Your ${label} has been flagged for manual verification. You will be notified once reviewed.`,
    });
};
