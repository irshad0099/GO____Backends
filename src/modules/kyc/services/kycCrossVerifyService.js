import * as repo from '../repositories/kycDocuments.repository.js';
import * as kycNotify from './kycNotificationService.js';
import { db } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const tokenize = s => (s || '').toLowerCase().replace(/[^a-z ]/g, '').trim().split(/\s+/).filter(Boolean);

const nameSimilarity = (a = '', b = '') => {
    const ta = new Set(tokenize(a));
    const tb = new Set(tokenize(b));
    if (ta.size === 0 || tb.size === 0) return null; // data nahi hai — skip
    const intersection = [...ta].filter(t => tb.has(t)).length;
    const union = new Set([...ta, ...tb]).size;
    return union === 0 ? 100 : Math.round((intersection / union) * 100);
};

const dobMatch = (a, b) => {
    if (!a || !b) return null; // data nahi — skip
    return String(a).slice(0, 10) === String(b).slice(0, 10);
};

// RC vehicle_type (Cashfree raw string) → driver_vehicle type (bike/auto/car)
const RC_TYPE_MAP = {
    bike:  ['M-CYCLE', 'MOTORCYCLE', 'SCOOTER', 'MOPED', 'E-BIKE', 'ELECTRIC CYCLE'],
    auto:  ['AUTO', 'E-RICKSHAW', 'E-CART', 'THREE WHEELER', '3-WHEELER'],
    car:   ['MOTOR CAR', 'CAR', 'TAXI', 'MAXI CAB', 'LIGHT MOTOR VEHICLE', 'LMV', 'SUV', 'MPV'],
};

const mapRcVehicleType = (rcType = '') => {
    const upper = rcType.toUpperCase();
    for (const [mapped, keywords] of Object.entries(RC_TYPE_MAP)) {
        if (keywords.some(k => upper.includes(k))) return mapped;
    }
    return null;
};

const isExpired = (dateStr) => {
    if (!dateStr) return null;
    return new Date(dateStr) < new Date();
};

// ─── Main cross-verify function ───────────────────────────────────────────────

export const runCrossVerify = async (userId) => {
    try {
        const docs = await repo.getDocsByUser(userId);
        const docMap = {};
        for (const d of docs) docMap[d.document_type] = d;

        const passed   = [];
        const failed   = [];   // manual_review trigger
        const warnings = [];   // flag karo, block mat karo

        const get = (type, field) => docMap[type]?.extracted_data?.[field] ?? null;

        // ── 1. Name consistency (Aadhaar ≈ PAN ≈ DL) ─────────────────────────
        const aadhaarName = get('AADHAAR', 'name');
        const panName     = get('PAN', 'name');
        const dlName      = get('DRIVING_LICENCE', 'name');
        const bankName    = get('BANK_ACCOUNT', 'holder_name');

        const NAME_THRESHOLD = 70;

        const apScore = nameSimilarity(aadhaarName, panName);
        if (apScore === null) {
            warnings.push({ check: 'aadhaar_pan_name', reason: 'Name data missing in one of the docs' });
        } else if (apScore < NAME_THRESHOLD) {
            failed.push({ check: 'aadhaar_pan_name', score: apScore, values: { aadhaar: aadhaarName, pan: panName } });
        } else {
            passed.push({ check: 'aadhaar_pan_name', score: apScore });
        }

        const adScore = nameSimilarity(aadhaarName, dlName);
        if (adScore === null) {
            warnings.push({ check: 'aadhaar_dl_name', reason: 'Name data missing in one of the docs' });
        } else if (adScore < NAME_THRESHOLD) {
            failed.push({ check: 'aadhaar_dl_name', score: adScore, values: { aadhaar: aadhaarName, dl: dlName } });
        } else {
            passed.push({ check: 'aadhaar_dl_name', score: adScore });
        }

        // Bank name — soft warning only (family ka account ho sakta hai)
        if (bankName && aadhaarName) {
            const abScore = nameSimilarity(aadhaarName, bankName);
            if (abScore !== null && abScore < NAME_THRESHOLD) {
                warnings.push({ check: 'bank_holder_name', score: abScore,
                    values: { aadhaar: aadhaarName, bank: bankName },
                    note: 'Driver may be using a family member\'s bank account' });
            } else if (abScore !== null) {
                passed.push({ check: 'bank_holder_name', score: abScore });
            }
        }

        // ── 2. DOB consistency (Aadhaar = PAN = DL) ──────────────────────────
        const aadhaarDob = get('AADHAAR', 'dob');
        const panDob     = get('PAN', 'dob');
        const dlDob      = get('DRIVING_LICENCE', 'dob');

        const apDob = dobMatch(aadhaarDob, panDob);
        if (apDob === null) {
            warnings.push({ check: 'aadhaar_pan_dob', reason: 'DOB data missing' });
        } else if (!apDob) {
            failed.push({ check: 'aadhaar_pan_dob', values: { aadhaar: aadhaarDob, pan: panDob } });
        } else {
            passed.push({ check: 'aadhaar_pan_dob' });
        }

        const adDob = dobMatch(aadhaarDob, dlDob);
        if (adDob === null) {
            warnings.push({ check: 'aadhaar_dl_dob', reason: 'DOB data missing' });
        } else if (!adDob) {
            failed.push({ check: 'aadhaar_dl_dob', values: { aadhaar: aadhaarDob, dl: dlDob } });
        } else {
            passed.push({ check: 'aadhaar_dl_dob' });
        }

        // ── 3. PAN health ─────────────────────────────────────────────────────
        const panStatus      = get('PAN', 'pan_status');
        const aadhaarLinked  = get('PAN', 'aadhaar_linked');

        if (panStatus && panStatus !== 'E') {
            failed.push({ check: 'pan_status', value: panStatus, note: 'PAN is not active (status must be E)' });
        } else if (panStatus) {
            passed.push({ check: 'pan_status', value: panStatus });
        }

        if (aadhaarLinked === false) {
            warnings.push({ check: 'pan_aadhaar_link', note: 'PAN is not linked to Aadhaar' });
        } else if (aadhaarLinked === true) {
            passed.push({ check: 'pan_aadhaar_link' });
        }

        // ── 4. DL active status ───────────────────────────────────────────────
        const dlStatus = get('DRIVING_LICENCE', 'dl_status');
        if (dlStatus && dlStatus !== 'ACTIVE') {
            failed.push({ check: 'dl_status', value: dlStatus, note: 'Driving licence is not ACTIVE' });
        } else if (dlStatus) {
            passed.push({ check: 'dl_status', value: dlStatus });
        }

        // ── 5. RC vehicle_type ↔ driver vehicle_type ──────────────────────────
        const rcRawType = get('VEHICLE_RC', 'vehicle_type');

        if (rcRawType) {
            const mappedType = mapRcVehicleType(rcRawType);

            // Driver ka registered vehicle type DB se fetch karo
            const { rows } = await db.query(
                `SELECT dv.vehicle_type FROM driver_vehicle dv
                 JOIN drivers d ON d.id = dv.driver_id
                 WHERE d.user_id = $1`,
                [userId]
            );
            const driverVehicleType = rows[0]?.vehicle_type || null;

            if (!mappedType) {
                warnings.push({ check: 'rc_vehicle_type', value: rcRawType, note: 'Could not map RC vehicle type — admin verify karo' });
            } else if (!driverVehicleType) {
                warnings.push({ check: 'rc_vehicle_type', note: 'Driver vehicle not registered yet' });
            } else if (mappedType !== driverVehicleType) {
                failed.push({ check: 'rc_vehicle_type',
                    values: { rc: mappedType, registered: driverVehicleType },
                    note: 'RC vehicle type does not match driver\'s registered vehicle' });
            } else {
                passed.push({ check: 'rc_vehicle_type', value: mappedType });
            }
        }

        // ── 6. RC registration validity ───────────────────────────────────────
        const rcValidity = get('VEHICLE_RC', 'registration_validity');
        if (rcValidity) {
            if (isExpired(rcValidity)) {
                failed.push({ check: 'rc_validity', value: rcValidity, note: 'RC registration has expired' });
            } else {
                passed.push({ check: 'rc_validity', value: rcValidity });
            }
        }

        // RC owner name — soft warning only (kisi ki bhi gaadi ho sakti hai)
        const rcOwner = get('VEHICLE_RC', 'owner');
        if (rcOwner && aadhaarName) {
            const roScore = nameSimilarity(aadhaarName, rcOwner);
            if (roScore !== null && roScore < NAME_THRESHOLD) {
                warnings.push({ check: 'rc_owner_name', score: roScore,
                    values: { aadhaar: aadhaarName, rc_owner: rcOwner },
                    note: 'Driver may be using someone else\'s vehicle — acceptable' });
            }
        }

        // ── Build report ──────────────────────────────────────────────────────
        const report = {
            ran_at:   new Date().toISOString(),
            passed,
            failed,
            warnings,
            summary: {
                total_checks: passed.length + failed.length + warnings.length,
                passed_count: passed.length,
                failed_count: failed.length,
                warning_count: warnings.length,
                overall: failed.length === 0 ? 'PASS' : 'FAIL',
            },
        };

        // Report driver_kyc_status mein save karo
        await db.query(
            `UPDATE driver_kyc_status SET pre_check_report = $1 WHERE user_id = $2`,
            [JSON.stringify(report), userId]
        );

        // Failed checks ke liye fraud flags add karo + docs ko manual_review mein daalo
        for (const f of failed) {
            let docType = null;
            if (f.check.includes('pan'))       docType = 'PAN';
            else if (f.check.includes('dl'))   docType = 'DRIVING_LICENCE';
            else if (f.check.includes('rc'))   docType = 'VEHICLE_RC';
            else if (f.check.includes('aadhaar')) docType = 'AADHAAR';

            if (docType && docMap[docType] && ['auto_verified', 'manual_review'].includes(docMap[docType].status)) {
                await repo.updateDocument(docMap[docType].id, { status: 'manual_review' });
                await repo.addFraudFlag(docMap[docType].id, 'CROSS_DOC_MISMATCH', 'MEDIUM',
                    { check: f.check, ...f });
                await repo.addAuditLog({
                    userId, docId: docMap[docType].id,
                    action: 'MANUAL_REVIEW_ASSIGNED',
                    actorType: 'system', actorId: null,
                    beforeState: { status: 'auto_verified' },
                    afterState:  { status: 'manual_review', reason: f.check },
                });
            }
        }

        // Notify driver about downgraded docs and overall cross-verify failures
        const downgradedTypes = [];
        for (const f of failed) {
            let docType = null;
            if (f.check.includes('pan'))       docType = 'PAN';
            else if (f.check.includes('dl'))   docType = 'DRIVING_LICENCE';
            else if (f.check.includes('rc'))   docType = 'VEHICLE_RC';
            else if (f.check.includes('aadhaar')) docType = 'AADHAAR';
            if (docType && !downgradedTypes.includes(docType)) {
                downgradedTypes.push(docType);
                kycNotify.notifyDocDowngraded(userId, docType).catch(() => {});
            }
        }
        if (failed.length > 0) {
            kycNotify.notifyCrossVerifyFailed(userId, failed.length).catch(() => {});
        }

        logger.info(`[KYC] Cross-verify done user=${userId} — passed:${passed.length} failed:${failed.length} warnings:${warnings.length}`);
        return report;

    } catch (err) {
        logger.error(`[KYC] Cross-verify error user=${userId}:`, err);
        return null; // cross-verify fail hone se overall flow block nahi hona chahiye
    }
};
