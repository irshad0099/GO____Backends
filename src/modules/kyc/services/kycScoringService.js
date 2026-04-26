import crypto from 'crypto';
import { ENV } from '../../../config/envConfig.js';
import redis from '../../../config/redis.config.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const nameSimilarity = (a = '', b = '') => {
    const tokenize = s => s.toLowerCase().replace(/[^a-z ]/g, '').trim().split(/\s+/).filter(Boolean);
    const ta = new Set(tokenize(a));
    const tb = new Set(tokenize(b));
    if (ta.size === 0 && tb.size === 0) return 100;
    const intersection = [...ta].filter(t => tb.has(t)).length;
    const union = new Set([...ta, ...tb]).size;
    return union === 0 ? 100 : Math.round((intersection / union) * 100);
};

const daysUntilDate = (dateStr) => {
    if (!dateStr) return 999;
    let date;
    const s = String(dateStr).trim();
    if (/^\d{4}[-\/]/.test(s)) {
        date = new Date(s);
    } else {
        const parts = s.split(/[-\/]/);
        date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    }
    if (isNaN(date.getTime())) return 999;
    return Math.floor((date.getTime() - Date.now()) / 86400000);
};

const checkVelocity = async (userId) => {
    const key = `kyc:velocity:${userId}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 86400);
    return count <= 5;
};

// ─── Exports ──────────────────────────────────────────────────────────────────

export const hashDocNumber = (number) =>
    crypto.createHash('sha256').update(String(number).replace(/\s/g, '').toUpperCase()).digest('hex');

/** Derive confidence 0–100 from Cashfree quality_checks */
export const extractConfidence = (cfResp) => {
    const q = cfResp.quality_checks || {};
    let score = 100;
    if (q.blur)              score -= 20;
    if (q.glare)             score -= 10;
    if (q.partially_present) score -= 30;
    if (q.obscured)          score -= 30;
    return Math.max(0, score);
};

/** Full scoring decision — returns { status, score, reason, flags, confidenceScore } */
export const decideDocumentStatus = async ({
    cfResp,
    documentType,
    extractedName,
    userFullName,
    existingDocs,
    userId,
    duplicateHash,
}) => {
    const flags = [];
    const fraud = cfResp.fraud_checks || {};
    const fields = cfResp.document_fields || {};
    const isProduction = ENV.CASHFREE_ENV === 'production';

    // ── Hard fails (short-circuit) ────────────────────────────────────────────
    // is_overwritten / is_photo_imposed = actual tampering → hard reject
    // is_forged alone = Cashfree false-positive on compressed images → manual_review
    if (isProduction && (fraud.is_overwritten || fraud.is_photo_imposed)) {
        flags.push({ type: 'TEMPLATE_TAMPERING', severity: 'HIGH', details: fraud });
        return { status: 'rejected', score: 0, reason: 'Document appears tampered or forged', flags, confidenceScore: 0 };
    }
    if (fraud.is_forged) {
        flags.push({ type: 'TEMPLATE_TAMPERING', severity: 'HIGH', details: fraud });
        return { status: 'manual_review', score: 50, reason: 'Fraud check flagged — requires manual verification', flags, confidenceScore: extractConfidence(cfResp) };
    }

    if (duplicateHash) {
        flags.push({ type: 'DUPLICATE_NUMBER', severity: 'HIGH', details: {} });
        return { status: 'rejected', score: 0, reason: 'This document is already registered with another account', flags, confidenceScore: 0, isDuplicate: true };
    }

    if (documentType === 'DRIVING_LICENCE') {
        const expiry = fields.expiry_date || fields.validity?.non_transport || fields.valid_till;
        if (expiry && daysUntilDate(expiry) < 90) {
            flags.push({ type: 'EXPIRED_DOC', severity: 'HIGH', details: { expiry } });
            return { status: 'rejected', score: 0, reason: 'Driving licence expires within 90 days', flags, confidenceScore: 0 };
        }
    }

    // ── Soft scoring ──────────────────────────────────────────────────────────
    const confidenceScore = extractConfidence(cfResp);
    let total = confidenceScore * 0.4;   // 0–40

    // Name match: driver profile vs extracted doc name
    const nameScore = (extractedName && userFullName) ? nameSimilarity(extractedName, userFullName) : 100;
    total += nameScore * 0.2;            // 0–20
    if (extractedName && userFullName && nameScore < ENV.CASHFREE_NAME_MATCH_THRESHOLD) {
        flags.push({ type: 'NAME_MISMATCH', severity: 'MEDIUM', details: { extracted: extractedName, profile: userFullName, score: nameScore } });
    }

    // Velocity
    const vOk = await checkVelocity(userId);
    total += vOk ? 20 : 0;              // 0 or 20
    if (!vOk) flags.push({ type: 'VELOCITY', severity: 'MEDIUM', details: {} });

    // Cross-doc consistency (compare with submitted Aadhaar name)
    const aadhaar = (existingDocs || []).find(d =>
        d.document_type === 'AADHAAR' && ['auto_verified', 'approved', 'manual_review'].includes(d.status)
    );
    let crossScore = 100;
    if (aadhaar && extractedName) {
        const aadhaarName = aadhaar.extracted_data?.name || '';
        if (aadhaarName) {
            crossScore = nameSimilarity(extractedName, aadhaarName);
            if (crossScore < ENV.CASHFREE_NAME_MATCH_THRESHOLD) {
                flags.push({ type: 'CROSS_DOC_MISMATCH', severity: 'MEDIUM', details: { docName: extractedName, aadhaarName, score: crossScore } });
            }
        }
    }
    total += crossScore * 0.2;          // 0–20

    const finalScore = Math.round(total);
    const AUTO_T   = ENV.KYC_AUTO_THRESHOLD   || 85;
    const REVIEW_T = ENV.KYC_REVIEW_THRESHOLD || 60;

    if (flags.length === 0 && finalScore >= AUTO_T)
        return { status: 'auto_verified', score: finalScore, flags, confidenceScore };
    if (finalScore >= REVIEW_T)
        return { status: 'manual_review', score: finalScore, flags, confidenceScore };
    return { status: 'rejected', score: finalScore, reason: 'Low confidence — please upload a clearer image', flags, confidenceScore };
};
