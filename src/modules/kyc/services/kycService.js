import * as cf from './cashfreeService.js';
import * as repo from '../repositories/kyc.repository.js';
import { ENV } from '../../../config/envConfig.js';
import logger from '../../../core/logger/logger.js';

const MAX_AADHAAR_ATTEMPTS = 3;
const MAX_DL_ATTEMPTS = 3;
const MAX_RC_ATTEMPTS = 3;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Simple name similarity score 0–100 (token overlap) */
const nameSimilarity = (a = '', b = '') => {
    const tokenize = (s) => s.toLowerCase().replace(/[^a-z ]/g, '').trim().split(/\s+/);
    const ta = new Set(tokenize(a));
    const tb = new Set(tokenize(b));
    const intersection = [...ta].filter(t => tb.has(t)).length;
    const union = new Set([...ta, ...tb]).size;
    return union === 0 ? 100 : Math.round((intersection / union) * 100);
};

const maskAadhaar = (n) => `XXXX XXXX ${String(n).slice(-4)}`;
const maskPan = (p) => `${p.slice(0, 3)}XX${p.slice(5, 9)}X`;
const maskAccount = (a) => `XXXX${String(a).slice(-4)}`;

/** Compute age from DOB string (YYYY-MM-DD or DD-MM-YYYY) */
const ageFromDob = (dob) => {
    if (!dob) return 99;
    const parts = String(dob).includes('-') ? dob.split('-') : dob.split('/');
    let date;
    if (parts[0].length === 4) {
        date = new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
    } else {
        date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    }
    const diff = Date.now() - date.getTime();
    return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
};

/** Evaluate all checks and decide if KYC should be auto-approved or flagged */
const evaluateOverallStatus = async (kyc) => {
    const allVerified =
        kyc.aadhaar_status === 'verified' &&
        kyc.pan_status     === 'verified' &&
        kyc.bank_status    === 'verified';

    if (!allVerified) return; // not ready yet

    const reasons = [];

    // Rule 1: Aadhaar ↔ PAN name mismatch
    const nameSim = nameSimilarity(kyc.aadhaar_name, kyc.pan_name);
    if (nameSim < ENV.CASHFREE_NAME_MATCH_THRESHOLD) {
        reasons.push(`Name mismatch: Aadhaar "${kyc.aadhaar_name}" vs PAN "${kyc.pan_name}" (${nameSim}% match)`);
    }

    // Rule 2: Underage
    const age = ageFromDob(kyc.aadhaar_dob);
    if (age < 18) {
        reasons.push(`Rider appears to be underage (age ${age} from Aadhaar DOB)`);
    }

    // Rule 3: Low face score (face is optional — only flag if attempted)
    if (kyc.face_status === 'failed' && kyc.face_match_score !== null) {
        reasons.push(`Face match score too low (${kyc.face_match_score}% < ${ENV.CASHFREE_FACE_MATCH_THRESHOLD}%)`);
    }

    if (reasons.length > 0) {
        await repo.setOverallStatus(kyc.user_id, 'manual_review', {
            manualReason: reasons.join(' | '),
        });
    } else {
        await repo.setOverallStatus(kyc.user_id, 'approved');
        // TODO: mark users.is_verified = true
    }
};

// ─── KYC Status ───────────────────────────────────────────────────────────────

export const getKycStatus = async (userId) => {
    let kyc = await repo.findByUserId(userId);
    if (!kyc) kyc = await repo.createKyc(userId);
    return kyc;
};

// ─── Aadhaar ──────────────────────────────────────────────────────────────────

export const initiateAadhaarOtp = async (userId, aadhaarNumber) => {
    let kyc = await repo.findByUserId(userId);
    if (!kyc) kyc = await repo.createKyc(userId);

    if (kyc.aadhaar_status === 'verified') {
        throw Object.assign(new Error('Aadhaar already verified'), { statusCode: 409 });
    }

    if (kyc.aadhaar_attempts >= MAX_AADHAAR_ATTEMPTS) {
        await repo.setOverallStatus(userId, 'manual_review', {
            manualReason: 'Exceeded max Aadhaar OTP attempts',
        });
        throw Object.assign(new Error('Too many attempts. Flagged for manual review.'), { statusCode: 429 });
    }

    const cfResp = await cf.generateAadhaarOtp(aadhaarNumber);
    await repo.setAadhaarOtpSent(userId, cfResp.ref_id);

    return { message: 'OTP sent to Aadhaar-linked mobile', refId: cfResp.ref_id };
};

export const verifyAadhaarOtp = async (userId, refId, otp) => {
    const kyc = await repo.findByUserId(userId);
    if (!kyc) throw Object.assign(new Error('KYC not initiated'), { statusCode: 400 });
    if (kyc.aadhaar_status === 'verified') {
        throw Object.assign(new Error('Aadhaar already verified'), { statusCode: 409 });
    }

    let cfResp;
    try {
        cfResp = await cf.verifyAadhaarOtp(refId, otp);
    } catch (err) {
        await repo.setAadhaarFailed(userId);
        throw Object.assign(new Error('Aadhaar OTP verification failed'), { statusCode: 422 });
    }

    if (cfResp.status !== 'VALID') {
        await repo.setAadhaarFailed(userId);
        throw Object.assign(new Error('Invalid OTP or Aadhaar not found'), { statusCode: 422 });
    }

    const ad = cfResp.aadhaar_data || cfResp;
    const updated = await repo.setAadhaarVerified(userId, {
        name:         ad.name,
        numberMasked: maskAadhaar(ad.aadhaar_number || ''),
        dob:          ad.dob,
        gender:       ad.gender,
        state:        ad.address?.state || ad.state || null,
    });

    await evaluateOverallStatus(updated);
    return updated;
};

// ─── PAN ──────────────────────────────────────────────────────────────────────

export const verifyPan = async (userId, panNumber, name) => {
    const kyc = await repo.findByUserId(userId);
    if (!kyc) throw Object.assign(new Error('KYC not initiated'), { statusCode: 400 });
    if (kyc.pan_status === 'verified') {
        throw Object.assign(new Error('PAN already verified'), { statusCode: 409 });
    }

    let cfResp;
    try {
        cfResp = await cf.verifyPan(panNumber, name);
    } catch (err) {
        await repo.setPanFailed(userId);
        throw Object.assign(new Error('PAN verification failed'), { statusCode: 422 });
    }

    if (cfResp.status !== 'VALID') {
        await repo.setPanFailed(userId);
        throw Object.assign(new Error('PAN is invalid or not found'), { statusCode: 422 });
    }

    const pd = cfResp.pan_data || cfResp;
    const updated = await repo.setPanVerified(userId, {
        name:         pd.name || name,
        numberMasked: maskPan(panNumber),
        dob:          pd.dob || null,
    });

    await evaluateOverallStatus(updated);
    return updated;
};

// ─── Bank Account ─────────────────────────────────────────────────────────────

export const verifyBankAccount = async (userId, accountNumber, ifsc, name) => {
    const kyc = await repo.findByUserId(userId);
    if (!kyc) throw Object.assign(new Error('KYC not initiated'), { statusCode: 400 });
    if (kyc.bank_status === 'verified') {
        throw Object.assign(new Error('Bank account already verified'), { statusCode: 409 });
    }

    let cfResp;
    try {
        cfResp = await cf.verifyBankAccount(accountNumber, ifsc, name);
    } catch (err) {
        await repo.setBankFailed(userId);
        throw Object.assign(new Error('Bank account verification failed'), { statusCode: 422 });
    }

    if (cfResp.account_status !== 'VALID') {
        await repo.setBankFailed(userId);
        throw Object.assign(new Error('Bank account is invalid or does not match'), { statusCode: 422 });
    }

    const updated = await repo.setBankVerified(userId, {
        accountMasked: maskAccount(accountNumber),
        ifsc:          ifsc.toUpperCase(),
        holderName:    cfResp.name_at_bank || name,
        bankName:      cfResp.bank_name || null,
    });

    await evaluateOverallStatus(updated);
    return updated;
};

// ─── Face Match (Optional) ────────────────────────────────────────────────────

export const verifyFace = async (userId, selfieBase64, aadhaarPhotoBase64) => {
    const kyc = await repo.findByUserId(userId);
    if (!kyc) throw Object.assign(new Error('KYC not initiated'), { statusCode: 400 });

    let cfResp;
    try {
        cfResp = await cf.matchFace(selfieBase64, aadhaarPhotoBase64);
    } catch (err) {
        await repo.setFaceFailed(userId, null);
        throw Object.assign(new Error('Face match API error'), { statusCode: 502 });
    }

    const score = cfResp.match_score ?? 0;

    if (score >= ENV.CASHFREE_FACE_MATCH_THRESHOLD) {
        const updated = await repo.setFaceVerified(userId, score);
        await evaluateOverallStatus(updated);
        return updated;
    } else {
        const updated = await repo.setFaceFailed(userId, score);
        await evaluateOverallStatus(updated);
        return updated;
    }
};

// ─── Driving License ─────────────────────────────────────────────────────────

export const verifyDrivingLicense = async (userId, { license_number, dob, name }) => {
    const kyc = await repo.findByUserId(userId);
    if (!kyc) throw Object.assign(new Error('KYC not initiated'), { statusCode: 400 });
    if (kyc.dl_status === 'verified') {
        throw Object.assign(new Error('Driving license already verified'), { statusCode: 409 });
    }
    if ((kyc.dl_attempts || 0) >= MAX_DL_ATTEMPTS) {
        await repo.setDrivingLicenseManualReview(userId, 'Exceeded max DL verification attempts');
        throw Object.assign(new Error('Too many attempts. Flagged for manual review.'), { statusCode: 429 });
    }

    let cfResp;
    try {
        cfResp = await cf.verifyDrivingLicense(license_number, dob, name);
    } catch (err) {
        await repo.setDrivingLicenseFailed(userId);
        throw Object.assign(new Error('Driving license verification failed'), { statusCode: 422 });
    }

    if (cfResp.status !== 'VALID') {
        await repo.setDrivingLicenseFailed(userId);
        throw Object.assign(new Error('Driving license is invalid or not found'), { statusCode: 422 });
    }

    const maskLicense = (n) => `XXXX${String(n).slice(-4)}`;
    const updated = await repo.setDrivingLicenseVerified(userId, {
        numberMasked:      maskLicense(license_number),
        verifiedName:      cfResp.name,
        verifiedDob:       cfResp.dob || null,
        issuingAuthority:  cfResp.issuing_authority || null,
        referenceId:       cfResp.reference_id,
    });

    // ─── Manual review checks ────────────────────────────────────────────────
    const reasons = [];

    // Rule 1: DL name vs Aadhaar name mismatch
    if (kyc?.aadhaar_name) {
        const sim = nameSimilarity(cfResp.name, kyc.aadhaar_name);
        if (sim < ENV.CASHFREE_NAME_MATCH_THRESHOLD) {
            reasons.push(`DL name "${cfResp.name}" vs Aadhaar "${kyc.aadhaar_name}" (${sim}% match)`);
        }
    }

    if (reasons.length > 0) {
        await repo.setDrivingLicenseManualReview(userId, reasons.join(' | '));
    } else {
        await evaluateOverallStatus(updated);
    }

    return updated;
};

// ─── Vehicle RC ───────────────────────────────────────────────────────────────

export const verifyVehicleRC = async (userId, rc_number) => {
    const kyc = await repo.findByUserId(userId);
    if (!kyc) throw Object.assign(new Error('KYC not initiated'), { statusCode: 400 });
    if (kyc.rc_status === 'verified') {
        throw Object.assign(new Error('Vehicle RC already verified'), { statusCode: 409 });
    }
    if ((kyc.rc_attempts || 0) >= MAX_RC_ATTEMPTS) {
        await repo.setVehicleRcManualReview(userId, 'Exceeded max RC verification attempts');
        throw Object.assign(new Error('Too many attempts. Flagged for manual review.'), { statusCode: 429 });
    }

    let cfResp;
    try {
        cfResp = await cf.verifyVehicleRC(rc_number);
    } catch (err) {
        await repo.setVehicleRcFailed(userId);
        throw Object.assign(new Error('Vehicle RC verification failed'), { statusCode: 422 });
    }

    if (cfResp.status !== 'VALID') {
        await repo.setVehicleRcFailed(userId);
        throw Object.assign(new Error('Vehicle RC is invalid or not found'), { statusCode: 422 });
    }

    const maskRC = (n) => `XXXX${String(n).slice(-4)}`;
    const updated = await repo.setVehicleRcVerified(userId, {
        numberMasked:      maskRC(rc_number),
        ownerName:         cfResp.owner_name,
        vehicleModel:      cfResp.vehicle_model || null,
        fuelType:          cfResp.fuel_type || null,
        registrationDate:  cfResp.registration_date || null,
        vehicleClass:      cfResp.vehicle_class || null,
        referenceId:       cfResp.reference_id,
    });

    // ─── Manual review checks ────────────────────────────────────────────────
    const reasons = [];

    // Rule 1: RC owner name vs Aadhaar name mismatch
    if (kyc?.aadhaar_name) {
        const sim = nameSimilarity(cfResp.owner_name, kyc.aadhaar_name);
        if (sim < ENV.CASHFREE_NAME_MATCH_THRESHOLD) {
            reasons.push(`RC owner "${cfResp.owner_name}" vs Aadhaar "${kyc.aadhaar_name}" (${sim}% match)`);
        }
    }

    if (reasons.length > 0) {
        await repo.setVehicleRcManualReview(userId, reasons.join(' | '));
    } else {
        await evaluateOverallStatus(updated);
    }

    return updated;
};

// ─── Admin ────────────────────────────────────────────────────────────────────

export const resolveManualReview = async (targetUserId, decision, adminId, reason) => {
    if (!['approve', 'reject'].includes(decision)) {
        throw Object.assign(new Error('Decision must be approve or reject'), { statusCode: 400 });
    }
    return repo.resolveManualReview(targetUserId, decision, adminId, reason);
};

export const listManualReviews = async ({ page = 1, limit = 20 }) => {
    const offset = (page - 1) * limit;
    return repo.listManualReviews({ limit, offset });
};
