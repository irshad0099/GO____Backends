import crypto from 'crypto';
import * as cf from './cashfreeService.js';
import * as repo from '../repositories/kyc.repository.js';
import { ENV } from '../../../config/envConfig.js';
import logger from '../../../core/logger/logger.js';
import redis from '../../../config/redis.config.js';

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
const maskPan     = (p) => `${String(p).slice(0, 3)}XX${String(p).slice(5, 9)}X`;
const maskAccount = (a) => `XXXX${String(a).slice(-4)}`;
const maskLicense = (n) => `XXXX${String(n).slice(-4)}`;
const maskRC      = (n) => String(n).toUpperCase();

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

    if (!allVerified) return;

    const reasons = [];

    const nameSim = nameSimilarity(kyc.aadhaar_name, kyc.pan_name);
    if (nameSim < ENV.CASHFREE_NAME_MATCH_THRESHOLD) {
        reasons.push(`Name mismatch: Aadhaar "${kyc.aadhaar_name}" vs PAN "${kyc.pan_name}" (${nameSim}% match)`);
    }

    const age = ageFromDob(kyc.aadhaar_dob);
    if (age < 18) {
        reasons.push(`Rider appears to be underage (age ${age} from Aadhaar DOB)`);
    }

    if (kyc.face_status === 'failed' && kyc.face_match_score !== null) {
        reasons.push(`Face match score too low (${kyc.face_match_score}% < ${ENV.CASHFREE_FACE_MATCH_THRESHOLD}%)`);
    }

    if (reasons.length > 0) {
        await repo.setOverallStatus(kyc.user_id, 'manual_review', {
            manualReason: reasons.join(' | '),
        });
    } else {
        await repo.setOverallStatus(kyc.user_id, 'approved');
    }
};

// ─── KYC Status ───────────────────────────────────────────────────────────────

export const getKycStatus = async (userId) => {
    let kyc = await repo.findByUserId(userId);
    if (!kyc) kyc = await repo.createKyc(userId);
    return kyc;
};

// ─── Generic Smart OCR (PAN / AADHAAR / DRIVING_LICENCE / VEHICLE_RC) ────────

/** Per-doc config: which status field to guard, whether govt DB verification is supported */
const OCR_DOC_TYPES = {
    PAN:             { statusField: 'pan_status',    doVerification: true  },
    AADHAAR:         { statusField: 'aadhaar_status', doVerification: false },
    DRIVING_LICENCE: { statusField: 'dl_status',     doVerification: true  },
    VEHICLE_RC:      { statusField: 'rc_status',     doVerification: false },
};

const markOcrFailed = async (userId, documentType) => {
    switch (documentType) {
        case 'PAN':             return repo.setPanFailed(userId);
        case 'AADHAAR':         return repo.setAadhaarFailed(userId);
        case 'DRIVING_LICENCE': return repo.setDrivingLicenseFailed(userId);
        case 'VEHICLE_RC':      return repo.setVehicleRcFailed(userId);
    }
};

/**
 * Unified OCR verification endpoint — driver uploads document image/PDF.
 * Cashfree Smart OCR extracts fields, runs quality/fraud checks, and (for PAN/DL)
 * cross-verifies against govt DB.
 *
 * Sandbox mein Cashfree mocked fraud/quality flags bhejta hai (e.g., is_screenshot always true)
 * → production mein strict reject, sandbox mein sirf log karke continue.
 */
export const submitOcrDocument = async (userId, documentType, { fileBuffer, fileName, mimeType }) => {
    const docConfig = OCR_DOC_TYPES[documentType];
    if (!docConfig) {
        throw Object.assign(
            new Error(`Invalid document_type: ${documentType}. Must be one of: ${Object.keys(OCR_DOC_TYPES).join(', ')}`),
            { statusCode: 400 }
        );
    }

    const kyc = await repo.findByUserId(userId) || await repo.createKyc(userId);
    if (kyc[docConfig.statusField] === 'verified') {
        throw Object.assign(new Error(`${documentType} already verified`), { statusCode: 409 });
    }
    console.log(`Submitting ${documentType} OCR for user ${userId} (file: ${fileName}, mime: ${mimeType}, size: ${fileBuffer.length} bytes)`);

    let cfResp;
    try {
        cfResp = await cf.smartOcr({
            documentType,
            fileBuffer,
            fileName,
            mimeType,
            doVerification: docConfig.doVerification,
        });
    } catch (err) {
        await markOcrFailed(userId, documentType);
        const msg = err.response?.data?.message || `${documentType} OCR failed`;
        throw Object.assign(new Error(msg), { statusCode: 422 });
    }

    // ─── Fraud checks — instant rejection in production ───────────────────────
    const fraud = cfResp.fraud_checks || {};
    const fraudReasons = [];
    if (fraud.is_forged)          fraudReasons.push('forged');
    if (fraud.is_overwritten)     fraudReasons.push('overwritten');
    if (fraud.is_screenshot)      fraudReasons.push('screenshot');
    if (fraud.is_photo_of_screen) fraudReasons.push('photo_of_screen');
    if (fraud.is_photo_imposed)   fraudReasons.push('photo_imposed');

    const isProduction = ENV.CASHFREE_ENV === 'production';

    if (fraudReasons.length > 0 && isProduction) {
        await markOcrFailed(userId, documentType);
        throw Object.assign(
            new Error(`${documentType} rejected — fraud indicators: ${fraudReasons.join(', ')}`),
            { statusCode: 422 }
        );
    }
    if (fraudReasons.length > 0) {
        logger.warn(`[KYC] ${documentType} OCR fraud flags (sandbox — ignored): ${fraudReasons.join(', ')} for user=${userId}`);
    }

    // ─── Govt DB verification check (PAN + DL only) ──────────────────────────
    const fields = cfResp.document_fields || {};
    const vdet   = cfResp.verification_details || {};

    if (docConfig.doVerification && vdet.status && vdet.status !== 'VALID') {
        await markOcrFailed(userId, documentType);
        throw Object.assign(
            new Error(`${documentType} is invalid or not found in govt records`),
            { statusCode: 422 }
        );
    }

    // ─── Quality warnings — soft flag for manual review ──────────────────────
    const quality = cfResp.quality_checks || {};
    const qualityWarnings = [];
    if (quality.blur)              qualityWarnings.push('blur');
    if (quality.glare)             qualityWarnings.push('glare');
    if (quality.partially_present) qualityWarnings.push('partially_present');
    if (quality.obscured)          qualityWarnings.push('obscured');

    // ─── Extract + save per document type ────────────────────────────────────
    let updated;
    let extracted = {};

    switch (documentType) {
        case 'PAN': {
            const panNumber = fields.pan;
            const name      = vdet.name || fields.name;
            const dob       = vdet.dob  || fields.dob;
            if (!panNumber) {
                await repo.setPanFailed(userId);
                throw Object.assign(new Error('Could not extract PAN number from image'), { statusCode: 422 });
            }
            updated = await repo.setPanVerified(userId, {
                name:         name || '',
                numberMasked: maskPan(panNumber),
                dob:          dob || null,
            });
            extracted = {
                pan_masked:       maskPan(panNumber),
                name,
                dob,
                govt_verified:    vdet.status === 'VALID',
                aadhaar_linked:   vdet.aadhaar_seeding_status === 'Y',
                name_match_govt:  vdet.name_match === 'Y',
                dob_match_govt:   vdet.dob_match  === 'Y',
            };
            break;
        }

        case 'AADHAAR': {
            const aadhaarNumber = fields.aadhaar_number || fields.uid || fields.id_number;
            const name          = fields.name;
            const dob           = fields.dob || fields.date_of_birth;
            const gender        = fields.gender;
            const state         = fields.split_address?.state || fields.state || null;
            if (!aadhaarNumber) {
                await repo.setAadhaarFailed(userId);
                throw Object.assign(new Error('Could not extract Aadhaar number from image'), { statusCode: 422 });
            }
            updated = await repo.setAadhaarVerified(userId, {
                name:         name || '',
                numberMasked: maskAadhaar(aadhaarNumber),
                dob:          dob || null,
                gender:       gender || null,
                state,
            });
            extracted = {
                aadhaar_masked: maskAadhaar(aadhaarNumber),
                name,
                dob,
                gender,
                state,
            };
            break;
        }

        case 'DRIVING_LICENCE': {
            const dlNumber = fields.dl_number || fields.license_number || fields.id_number;
            const name     = vdet.name || fields.name;
            const dob      = vdet.dob  || fields.dob;
            if (!dlNumber) {
                await repo.setDrivingLicenseFailed(userId);
                throw Object.assign(new Error('Could not extract DL number from image'), { statusCode: 422 });
            }
            updated = await repo.setDrivingLicenseVerified(userId, {
                numberMasked:     maskLicense(dlNumber),
                verifiedName:     name || null,
                verifiedDob:      dob || null,
                issuingAuthority: vdet.reg_authority || fields.issuing_authority || null,
                referenceId:      String(cfResp.reference_id || ''),
            });
            extracted = {
                dl_masked:         maskLicense(dlNumber),
                name,
                dob,
                govt_verified:     vdet.status === 'VALID',
                issuing_authority: vdet.reg_authority || fields.issuing_authority || null,
            };

            // DL name vs Aadhaar name cross-check
            if (kyc.aadhaar_name && name) {
                const sim = nameSimilarity(name, kyc.aadhaar_name);
                if (sim < ENV.CASHFREE_NAME_MATCH_THRESHOLD) {
                    qualityWarnings.push(`dl_name_mismatch(${sim}%)`);
                }
            }
            break;
        }

        case 'VEHICLE_RC': {
            const rcNumber = fields.rc_number || fields.vehicle_number || fields.registration_number;
            const owner    = fields.owner || fields.owner_name;
            const model    = fields.model || fields.vehicle_model;
            if (!rcNumber) {
                await repo.setVehicleRcFailed(userId);
                throw Object.assign(new Error('Could not extract RC number from image'), { statusCode: 422 });
            }
            updated = await repo.setVehicleRcVerified(userId, {
                numberMasked:     maskRC(rcNumber),
                ownerName:        owner || null,
                vehicleModel:     model || null,
                fuelType:         fields.fuel_type || fields.norms_type || null,
                registrationDate: fields.registration_date || fields.reg_date || null,
                vehicleClass:     fields.vehicle_class || fields.class || null,
                referenceId:      String(cfResp.reference_id || ''),
            });
            extracted = {
                rc_masked:     maskRC(rcNumber),
                owner,
                model,
                fuel_type:     fields.fuel_type || fields.norms_type || null,
                reg_date:      fields.registration_date || fields.reg_date || null,
                vehicle_class: fields.vehicle_class || fields.class || null,
            };

            // RC owner vs Aadhaar name cross-check
            if (kyc.aadhaar_name && owner) {
                const sim = nameSimilarity(owner, kyc.aadhaar_name);
                if (sim < ENV.CASHFREE_NAME_MATCH_THRESHOLD) {
                    qualityWarnings.push(`rc_owner_mismatch(${sim}%)`);
                }
            }
            break;
        }
    }

    // ─── Quality → manual review (prod only; sandbox mein sirf log) ──────────
    if (qualityWarnings.length > 0 && isProduction) {
        await repo.setOverallStatus(userId, 'manual_review', {
            manualReason: `${documentType} quality/match issues: ${qualityWarnings.join(', ')}`,
        });
    } else {
        if (qualityWarnings.length > 0) {
            logger.warn(`[KYC] ${documentType} OCR quality warnings (sandbox — ignored): ${qualityWarnings.join(', ')} for user=${userId}`);
        }
        await evaluateOverallStatus(updated);
    }

    return {
        ...updated,
        ocr: {
            document_type:    documentType,
            ...extracted,
            quality_warnings: qualityWarnings,
            fraud_indicators: fraudReasons,
            environment:      ENV.CASHFREE_ENV,
            enforcement_mode: isProduction ? 'strict' : 'lenient (sandbox)',
        },
    };
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

// ─── DigiLocker ───────────────────────────────────────────────────────────────

const VALID_DOCS = new Set(['AADHAAR', 'PAN', 'DRIVING_LICENSE']);

export const getDigilockerDocument = async (userId, documentType, { verification_id, reference_id }) => {
    if (!VALID_DOCS.has(documentType)) {
        throw Object.assign(new Error(`Invalid document_type: ${documentType}. Must be AADHAAR, PAN, or DRIVING_LICENSE`), { statusCode: 400 });
    }
    if (!verification_id && !reference_id) {
        throw Object.assign(new Error('verification_id or reference_id is required'), { statusCode: 400 });
    }

    let cfResp;
    try {
        cfResp = await cf.getDigilockerDocument(documentType, verification_id, reference_id);
    } catch (err) {
        const msg = err.response?.data?.message || 'Failed to fetch DigiLocker document';
        throw Object.assign(new Error(msg), { statusCode: 502 });
    }

    return cfResp;
};

export const getDigilockerStatus = async (userId, { verification_id, reference_id }) => {
    if (!verification_id && !reference_id) {
        throw Object.assign(new Error('verification_id or reference_id is required'), { statusCode: 400 });
    }

    let cfResp;
    try {
        cfResp = await cf.getDigilockerStatus(verification_id, reference_id);
    } catch (err) {
        const msg = err.response?.data?.message || 'Failed to fetch DigiLocker status';
        throw Object.assign(new Error(msg), { statusCode: 502 });
    }

    return {
        status:                    cfResp.status,
        verification_id:           cfResp.verification_id,
        reference_id:              cfResp.reference_id,
        document_requested:        cfResp.document_requested,
        document_consent:          cfResp.document_consent,
        document_consent_validity: cfResp.document_consent_validity,
        user_details:              cfResp.user_details || null,
    };
};

export const createDigilockerUrl = async (userId, { document_requested, user_flow = 'signup' }) => {
    if (!Array.isArray(document_requested) || document_requested.length === 0) {
        throw Object.assign(new Error('document_requested must be a non-empty array'), { statusCode: 400 });
    }
    const invalid = document_requested.filter(d => !VALID_DOCS.has(d));
    if (invalid.length > 0) {
        throw Object.assign(new Error(`Invalid document types: ${invalid.join(', ')}`), { statusCode: 400 });
    }
    if (!['signin', 'signup'].includes(user_flow)) {
        throw Object.assign(new Error('user_flow must be signin or signup'), { statusCode: 400 });
    }

    const verificationId = `digi_${userId}_${Date.now()}`;
    const redirectUrl    = ENV.DIGILOCKER_REDIRECT_URL;

    let cfResp;
    try {
        cfResp = await cf.createDigilockerUrl(verificationId, document_requested, redirectUrl, user_flow);
    } catch (err) {
        const msg = err.response?.data?.message || 'Failed to create DigiLocker URL';
        throw Object.assign(new Error(msg), { statusCode: 502 });
    }

    return {
        url:                cfResp.url,
        status:             cfResp.status,
        verification_id:    cfResp.verification_id,
        reference_id:       cfResp.reference_id,
        document_requested: cfResp.document_requested,
        user_flow:          cfResp.user_flow,
    };
};

export const verifyDigilocker = async (userId, mobileNumber, aadhaarNumber) => {
    if (!mobileNumber && !aadhaarNumber) {
        throw Object.assign(new Error('mobile_number or aadhaar_number is required'), { statusCode: 400 });
    }

    let cfResp;
    try {
        cfResp = await cf.verifyDigilockerAccount(mobileNumber, aadhaarNumber);
    } catch (err) {
        const msg = err.response?.data?.message || 'DigiLocker verification failed';
        throw Object.assign(new Error(msg), { statusCode: 502 });
    }

    return {
        status:         cfResp.status,
        digilocker_id:  cfResp.digilocker_id || null,
        reference_id:   cfResp.reference_id  || null,
        account_exists: cfResp.status === 'ACCOUNT_EXISTS',
    };
};

// ─── DigiLocker Webhook ───────────────────────────────────────────────────────

const verifyWebhookSignature = (rawBody, timestamp, signature) => {
    const message  = timestamp + rawBody;
    const expected = crypto
        .createHmac('sha256', ENV.CASHFREE_CLIENT_SECRET)
        .update(message)
        .digest('base64');
    return expected === signature;
};

export const processDigilockerWebhook = async (rawBody, headers) => {
    const signature = headers['x-webhook-signature'];
    const timestamp = headers['x-webhook-timestamp'];

    if (!signature || !timestamp) {
        throw Object.assign(new Error('Missing webhook signature headers'), { statusCode: 400 });
    }

    if (!verifyWebhookSignature(rawBody, timestamp, signature)) {
        logger.warn('[DigiLocker Webhook] Signature mismatch — rejecting');
        throw Object.assign(new Error('Invalid webhook signature'), { statusCode: 401 });
    }

    const payload        = JSON.parse(rawBody);
    const eventType      = payload.event_type;
    const data           = payload.data || {};
    const verificationId = data.verification_id;

    const idempotencyKey   = `webhook:digilocker:${verificationId}:${eventType}`;
    const alreadyProcessed = await redis.set(idempotencyKey, '1', 'EX', 86400, 'NX');
    if (alreadyProcessed === null) {
        logger.info(`[DigiLocker Webhook] Duplicate event ignored: ${idempotencyKey}`);
        return { ignored: true };
    }

    logger.info(`[DigiLocker Webhook] event=${eventType} verification_id=${verificationId}`);

    switch (eventType) {
        case 'DIGILOCKER_VERIFICATION_SUCCESS': {
            const kyc = await repo.findByVerificationId(verificationId);
            if (!kyc) {
                logger.warn(`[DigiLocker Webhook] No KYC record for verification_id=${verificationId}`);
                break;
            }
            const userDetails = data.user_details || {};
            const updated = await repo.setDigilockerVerified(kyc.user_id, userDetails);
            await evaluateOverallStatus(updated);
            break;
        }

        case 'DIGILOCKER_VERIFICATION_LINK_EXPIRED':
        case 'DIGILOCKER_VERIFICATION_CONSENT_DENIED':
        case 'DIGILOCKER_VERIFICATION_FAILURE':
            logger.warn(`[DigiLocker Webhook] Terminal event: ${eventType} for ${verificationId}`);
            break;

        case 'DIGILOCKER_VERIFICATION_CONSENT_EXPIRED':
            logger.info(`[DigiLocker Webhook] Consent expired for ${verificationId} — driver must re-authenticate`);
            break;

        default:
            logger.warn(`[DigiLocker Webhook] Unknown event_type: ${eventType}`);
    }

    return { processed: true, event_type: eventType };
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
