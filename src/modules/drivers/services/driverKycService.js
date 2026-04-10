import * as cf from '../../kyc/services/cashfreeService.js';
import * as repo from '../repositories/driverKyc.repository.js';
import { findDriverByUserId, checkAllDocumentsVerified, markDriverVerified } from '../repositories/driver.repository.js';
import { ENV } from '../../../config/envConfig.js';
import logger from '../../../core/logger/logger.js';

const MAX_AADHAAR_ATTEMPTS = 3;
const MAX_DL_ATTEMPTS      = 3;
const MAX_RC_ATTEMPTS      = 3;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const nameSimilarity = (a = '', b = '') => {
    const tokenize = (s) => s.toLowerCase().replace(/[^a-z ]/g, '').trim().split(/\s+/);
    const ta = new Set(tokenize(a));
    const tb = new Set(tokenize(b));
    const intersection = [...ta].filter(t => tb.has(t)).length;
    const union = new Set([...ta, ...tb]).size;
    return union === 0 ? 100 : Math.round((intersection / union) * 100);
};

// Conservative map: unknown class → null → no flag
const VEHICLE_CLASS_MAP = {
    'MOTOR CYCLE':            'bike',
    'MOTOR CYCLE WITH GEAR':  'bike',
    'MCWG':                   'bike',
    'SCOOTER':                'bike',
    'MOPED':                  'bike',
    'LMV':                    'car',
    'LMV-NT':                 'car',
    'AUTO RICKSHAW':          'auto',
    'E-RICKSHAW':             'auto',
    'E-RICKSHAW WITH CART':   'auto',
};

const normalizeVehicleClass = (cfClass = '') => {
    return VEHICLE_CLASS_MAP[cfClass.toUpperCase().trim()] || null;
};

const err = (msg, code) => Object.assign(new Error(msg), { statusCode: code });

// ─── Internal ─────────────────────────────────────────────────────────────────

const getDriverId = async (userId) => {
    const driver = await findDriverByUserId(userId);
    if (!driver) throw err('Driver profile not found', 404);
    return driver.id;
};

/**
 * After any document is verified, check if ALL 5 are now verified.
 * If yes, mark driver as fully verified.
 */
const evaluateAndFinalize = async (driverId) => {
    const docs = await repo.findDocsByDriverId(driverId);
    if (!docs) return;

    const allVerified =
        docs.aadhaar_vst  === 'verified' &&
        docs.pan_vst      === 'verified' &&
        docs.bank_vst     === 'verified' &&
        docs.license_vst  === 'verified' &&
        docs.vehicle_vst  === 'verified';

    const noManualFlags =
        !docs.dl_manual_review_reason &&
        !docs.rc_manual_review_reason;

    if (allVerified && noManualFlags) {
        await markDriverVerified(driverId);
        logger.info(`Driver ${driverId} fully verified via digital KYC`);
    }
};

// ─── Status ───────────────────────────────────────────────────────────────────

export const getKycStatus = async (userId) => {
    const driverId = await getDriverId(userId);
    return repo.findDocsByDriverId(driverId);
};

// ─── Aadhaar ──────────────────────────────────────────────────────────────────

export const initiateAadhaarOtp = async (userId, aadhaarNumber) => {
    const driverId = await getDriverId(userId);
    const docs = await repo.findDocsByDriverId(driverId);

    if (docs?.aadhaar_vst === 'verified') {
        throw err('Aadhaar already verified', 409);
    }
    if ((docs?.aadhaar_attempts || 0) >= MAX_AADHAAR_ATTEMPTS) {
        throw err('Too many Aadhaar OTP attempts. Contact support.', 429);
    }

    const cfResp = await cf.generateAadhaarOtp(aadhaarNumber);
    await repo.setAadhaarRefId(driverId, cfResp.ref_id);

    return { message: 'OTP sent to Aadhaar-linked mobile', refId: cfResp.ref_id };
};

export const verifyAadhaarOtp = async (userId, refId, otp) => {
    const driverId = await getDriverId(userId);
    const docs = await repo.findDocsByDriverId(driverId);

    if (docs?.aadhaar_vst === 'verified') throw err('Aadhaar already verified', 409);

    let cfResp;
    try {
        cfResp = await cf.verifyAadhaarOtp(refId, otp);
    } catch (e) {
        throw err('Aadhaar OTP verification failed', 422);
    }

    if (cfResp.status !== 'VALID') {
        throw err('Invalid OTP or Aadhaar not found', 422);
    }

    const ad = cfResp.aadhaar_data || cfResp;
    await repo.setAadhaarVerifiedData(driverId, {
        name:   ad.name,
        dob:    ad.dob   || null,
        gender: ad.gender || null,
        state:  ad.address?.state || ad.state || null,
    });

    await evaluateAndFinalize(driverId);
    return repo.findDocsByDriverId(driverId);
};

// ─── PAN ──────────────────────────────────────────────────────────────────────

export const verifyPan = async (userId, panNumber, name) => {
    const driverId = await getDriverId(userId);
    const docs = await repo.findDocsByDriverId(driverId);

    if (docs?.pan_vst === 'verified') throw err('PAN already verified', 409);

    let cfResp;
    try {
        cfResp = await cf.verifyPan(panNumber, name);
    } catch (e) {
        throw err('PAN verification failed', 422);
    }

    if (cfResp.status !== 'VALID') {
        throw err('PAN is invalid or not found', 422);
    }

    await repo.setDocVerified('driver_pan', driverId);
    await evaluateAndFinalize(driverId);
    return repo.findDocsByDriverId(driverId);
};

// ─── Bank Account ─────────────────────────────────────────────────────────────

export const verifyBankAccount = async (userId, accountNumber, ifsc, name) => {
    const driverId = await getDriverId(userId);
    const docs = await repo.findDocsByDriverId(driverId);

    if (docs?.bank_vst === 'verified') throw err('Bank account already verified', 409);

    let cfResp;
    try {
        cfResp = await cf.verifyBankAccount(accountNumber, ifsc, name);
    } catch (e) {
        throw err('Bank account verification failed', 422);
    }

    if (cfResp.account_status !== 'VALID') {
        throw err('Bank account is invalid or does not match', 422);
    }

    await repo.setDocVerified('driver_bank', driverId);
    await evaluateAndFinalize(driverId);
    return repo.findDocsByDriverId(driverId);
};

// ─── Driving License ──────────────────────────────────────────────────────────

export const verifyDrivingLicense = async (userId, { license_number, dob, name }) => {
    const driverId = await getDriverId(userId);
    const docs = await repo.findDocsByDriverId(driverId);

    if (docs?.dl_cf_status === 'verified' && docs?.license_vst === 'verified') {
        throw err('Driving license already verified', 409);
    }
    if ((docs?.dl_attempts || 0) >= MAX_DL_ATTEMPTS) {
        await repo.setDlManualReview(driverId, 'Exceeded max DL verification attempts');
        throw err('Too many attempts. Flagged for manual review.', 429);
    }

    let cfResp;
    try {
        cfResp = await cf.verifyDrivingLicense(license_number, dob, name);
    } catch (e) {
        await repo.setDlFailed(driverId);
        throw err('Driving license verification failed', 422);
    }

    if (cfResp.status !== 'VALID') {
        await repo.setDlFailed(driverId);
        throw err('Driving license is invalid or not found', 422);
    }

    await repo.setDlVerified(driverId, {
        referenceId:      cfResp.reference_id,
        verifiedName:     cfResp.name,
        verifiedDob:      cfResp.dob      || null,
        issuingAuthority: cfResp.issuing_authority || null,
    });

    // ─── Manual review checks ────────────────────────────────────────────────
    const reasons = [];

    // Rule 1: DL name vs Aadhaar name mismatch
    if (docs?.aadhaar_name) {
        const sim = nameSimilarity(cfResp.name, docs.aadhaar_name);
        if (sim < ENV.CASHFREE_NAME_MATCH_THRESHOLD) {
            reasons.push(`DL name "${cfResp.name}" vs Aadhaar "${docs.aadhaar_name}" (${sim}% match)`);
        }
    } else {
        logger.warn(`Driver ${driverId}: Aadhaar not yet verified — skipping name cross-check for DL`);
    }

    // Rule 2: DL already expired
    if (docs?.license_expiry_date && new Date(docs.license_expiry_date) < new Date()) {
        reasons.push(`DL expired on ${new Date(docs.license_expiry_date).toISOString().slice(0, 10)}`);
    }

    if (reasons.length > 0) {
        await repo.setDlManualReview(driverId, reasons.join(' | '));
    } else {
        await evaluateAndFinalize(driverId);
    }

    return repo.findDocsByDriverId(driverId);
};

// ─── Vehicle RC ───────────────────────────────────────────────────────────────

export const verifyVehicleRC = async (userId, rcNumber) => {
    const driverId = await getDriverId(userId);
    const docs = await repo.findDocsByDriverId(driverId);

    if (docs?.rc_cf_status === 'verified' && docs?.vehicle_vst === 'verified') {
        throw err('Vehicle RC already verified', 409);
    }
    if ((docs?.rc_attempts || 0) >= MAX_RC_ATTEMPTS) {
        await repo.setRcManualReview(driverId, 'Exceeded max RC verification attempts');
        throw err('Too many attempts. Flagged for manual review.', 429);
    }

    let cfResp;
    try {
        cfResp = await cf.verifyVehicleRC(rcNumber);
    } catch (e) {
        await repo.setRcFailed(driverId);
        throw err('Vehicle RC verification failed', 422);
    }

    if (cfResp.status !== 'VALID') {
        await repo.setRcFailed(driverId);
        throw err('Vehicle RC is invalid or not found', 422);
    }

    await repo.setRcVerified(driverId, {
        referenceId:      cfResp.reference_id,
        ownerName:        cfResp.owner_name,
        model:            cfResp.vehicle_model   || null,
        fuelType:         cfResp.fuel_type        || null,
        registrationDate: cfResp.registration_date || null,
        vehicleClass:     cfResp.vehicle_class    || null,
    });

    // ─── Manual review checks ────────────────────────────────────────────────
    const reasons = [];

    // Rule 1: RC owner name vs Aadhaar name mismatch
    if (docs?.aadhaar_name) {
        const sim = nameSimilarity(cfResp.owner_name, docs.aadhaar_name);
        if (sim < ENV.CASHFREE_NAME_MATCH_THRESHOLD) {
            reasons.push(`RC owner "${cfResp.owner_name}" vs Aadhaar "${docs.aadhaar_name}" (${sim}% match)`);
        }
    } else {
        logger.warn(`Driver ${driverId}: Aadhaar not yet verified — skipping name cross-check for RC`);
    }

    // Rule 2: Vehicle type mismatch (only when class is recognized)
    if (cfResp.vehicle_class) {
        const normalizedClass = normalizeVehicleClass(cfResp.vehicle_class);
        if (normalizedClass !== null && normalizedClass !== docs?.vehicle_type) {
            reasons.push(
                `RC class "${cfResp.vehicle_class}" (${normalizedClass}) doesn't match declared type "${docs?.vehicle_type}"`
            );
        }
    }

    if (reasons.length > 0) {
        await repo.setRcManualReview(driverId, reasons.join(' | '));
    } else {
        await evaluateAndFinalize(driverId);
    }

    return repo.findDocsByDriverId(driverId);
};

// ─── Admin ────────────────────────────────────────────────────────────────────

export const listManualReviews = async ({ page = 1, limit = 20 }) => {
    const offset = (page - 1) * limit;
    return repo.listDriverManualReviews({ limit, offset });
};

export const resolveManualReview = async (driverId, { dl_decision, rc_decision, reason }, adminId) => {
    if (dl_decision && !['approve', 'reject'].includes(dl_decision)) {
        throw err('dl_decision must be approve or reject', 400);
    }
    if (rc_decision && !['approve', 'reject'].includes(rc_decision)) {
        throw err('rc_decision must be approve or reject', 400);
    }

    const result = await repo.resolveDriverManualReview(driverId, {
        dlDecision: dl_decision,
        rcDecision: rc_decision,
        adminId,
        reason,
    });

    // If both approved, attempt finalization
    if (dl_decision === 'approve' || rc_decision === 'approve') {
        await evaluateAndFinalize(driverId);
    }

    return result;
};
