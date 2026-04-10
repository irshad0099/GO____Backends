import { db } from '../../../infrastructure/database/postgres.js';

// Whitelisted tables for generic setDocVerified
const ALLOWED_TABLES = new Set(['driver_aadhaar', 'driver_pan', 'driver_bank']);

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * JOIN across all 5 doc tables — returns everything needed for
 * cross-doc name checks and the finalization check.
 */
export const findDocsByDriverId = async (driverId) => {
    const { rows } = await db.query(
        `SELECT
            d.id             AS driver_id,
            d.user_id,
            -- Aadhaar
            da.aadhaar_name,
            da.aadhaar_number,
            da.cf_reference_id   AS aadhaar_ref_id,
            da.verification_status AS aadhaar_vst,
            -- PAN
            dp.pan_number,
            dp.verification_status AS pan_vst,
            -- Bank
            db2.account_number,
            db2.verification_status AS bank_vst,
            -- License
            dl.license_number,
            dl.license_name,
            dl.license_dob,
            dl.license_expiry_date,
            dl.cf_status         AS dl_cf_status,
            dl.dl_attempts,
            dl.dl_manual_review_reason,
            dl.verification_status AS license_vst,
            -- Vehicle
            dv.rc_number,
            dv.owner_name,
            dv.vehicle_type,
            dv.cf_vehicle_class,
            dv.cf_status         AS rc_cf_status,
            dv.rc_attempts,
            dv.rc_manual_review_reason,
            dv.verification_status AS vehicle_vst
        FROM drivers d
        LEFT JOIN driver_aadhaar  da  ON da.driver_id  = d.id
        LEFT JOIN driver_pan      dp  ON dp.driver_id  = d.id
        LEFT JOIN driver_bank     db2 ON db2.driver_id = d.id
        LEFT JOIN driver_license  dl  ON dl.driver_id  = d.id
        LEFT JOIN driver_vehicle  dv  ON dv.driver_id  = d.id
        WHERE d.id = $1`,
        [driverId]
    );
    return rows[0] || null;
};

// ─── Generic: Aadhaar / PAN / Bank ───────────────────────────────────────────

/** Set verification_status = 'verified' on any of the 3 simple doc tables */
export const setDocVerified = async (table, driverId) => {
    if (!ALLOWED_TABLES.has(table)) throw new Error(`Table ${table} not allowed`);
    const { rows } = await db.query(
        `UPDATE ${table}
         SET verification_status = 'verified',
             verified_at         = NOW()
         WHERE driver_id = $1
         RETURNING *`,
        [driverId]
    );
    return rows[0];
};

/** Store Aadhaar OTP ref_id before OTP is verified */
export const setAadhaarRefId = async (driverId, refId) => {
    const { rows } = await db.query(
        `UPDATE driver_aadhaar
         SET cf_reference_id = $2
         WHERE driver_id = $1
         RETURNING *`,
        [driverId, refId]
    );
    return rows[0];
};

/** Update aadhaar_name from Cashfree response (used for cross-doc name checks) */
export const setAadhaarVerifiedData = async (driverId, { name, dob, gender, state }) => {
    const { rows } = await db.query(
        `UPDATE driver_aadhaar
         SET aadhaar_name        = $2,
             aadhaar_dob         = $3,
             aadhaar_gender      = $4,
             aadhaar_state       = $5,
             verification_status = 'verified',
             verified_at         = NOW()
         WHERE driver_id = $1
         RETURNING *`,
        [driverId, name, dob || null, gender || null, state || null]
    );
    return rows[0];
};

// ─── Driving License ──────────────────────────────────────────────────────────

export const setDlVerified = async (driverId, { referenceId, verifiedName, verifiedDob, issuingAuthority }) => {
    const { rows } = await db.query(
        `UPDATE driver_license
         SET cf_status            = 'verified',
             verification_status  = 'verified',
             cf_reference_id      = $2,
             cf_verified_name     = $3,
             cf_verified_dob      = $4,
             cf_issuing_authority = $5,
             dl_attempts          = dl_attempts + 1,
             dl_verified_at       = NOW(),
             verified_at          = NOW()
         WHERE driver_id = $1
         RETURNING *`,
        [driverId, referenceId, verifiedName, verifiedDob || null, issuingAuthority || null]
    );
    return rows[0];
};

export const setDlFailed = async (driverId) => {
    const { rows } = await db.query(
        `UPDATE driver_license
         SET cf_status   = 'failed',
             dl_attempts = dl_attempts + 1
         WHERE driver_id = $1
         RETURNING *`,
        [driverId]
    );
    return rows[0];
};

/**
 * Called when Cashfree verified the DL but business rules flagged it.
 * cf_status stays 'verified' (document is real).
 * verification_status goes back to 'pending' (admin must review).
 */
export const setDlManualReview = async (driverId, reason) => {
    const { rows } = await db.query(
        `UPDATE driver_license
         SET dl_manual_review_reason = $2,
             verification_status     = 'pending'
         WHERE driver_id = $1
         RETURNING *`,
        [driverId, reason]
    );
    return rows[0];
};

// ─── Vehicle RC ───────────────────────────────────────────────────────────────

export const setRcVerified = async (driverId, { referenceId, ownerName, model, fuelType, registrationDate, vehicleClass }) => {
    const { rows } = await db.query(
        `UPDATE driver_vehicle
         SET cf_status               = 'verified',
             verification_status     = 'verified',
             cf_reference_id         = $2,
             cf_verified_owner_name  = $3,
             cf_verified_model       = $4,
             cf_verified_fuel_type   = $5,
             cf_registration_date    = $6,
             cf_vehicle_class        = $7,
             rc_attempts             = rc_attempts + 1,
             rc_verified_at          = NOW(),
             verified_at             = NOW()
         WHERE driver_id = $1
         RETURNING *`,
        [driverId, referenceId, ownerName, model || null, fuelType || null, registrationDate || null, vehicleClass || null]
    );
    return rows[0];
};

export const setRcFailed = async (driverId) => {
    const { rows } = await db.query(
        `UPDATE driver_vehicle
         SET cf_status   = 'failed',
             rc_attempts = rc_attempts + 1
         WHERE driver_id = $1
         RETURNING *`,
        [driverId]
    );
    return rows[0];
};

export const setRcManualReview = async (driverId, reason) => {
    const { rows } = await db.query(
        `UPDATE driver_vehicle
         SET rc_manual_review_reason = $2,
             verification_status     = 'pending'
         WHERE driver_id = $1
         RETURNING *`,
        [driverId, reason]
    );
    return rows[0];
};

// ─── Admin: Manual Review ─────────────────────────────────────────────────────

export const listDriverManualReviews = async ({ limit = 20, offset = 0 }) => {
    const { rows } = await db.query(
        `SELECT
            d.id AS driver_id,
            u.full_name,
            u.phone_number,
            dl.license_number,
            dl.cf_verified_name,
            dl.dl_manual_review_reason,
            dl.cf_status             AS dl_cf_status,
            dl.license_expiry_date,
            dv.rc_number,
            dv.cf_verified_owner_name,
            dv.rc_manual_review_reason,
            dv.cf_status             AS rc_cf_status,
            dv.cf_vehicle_class,
            dv.vehicle_type
        FROM drivers d
        JOIN users u ON u.id = d.user_id
        LEFT JOIN driver_license dl ON dl.driver_id = d.id
        LEFT JOIN driver_vehicle dv ON dv.driver_id = d.id
        WHERE dl.dl_manual_review_reason IS NOT NULL
           OR dv.rc_manual_review_reason IS NOT NULL
        ORDER BY d.updated_at DESC
        LIMIT $1 OFFSET $2`,
        [limit, offset]
    );
    return rows;
};

export const resolveDriverManualReview = async (driverId, { dlDecision, rcDecision, adminId, reason }) => {
    if (dlDecision) {
        const status = dlDecision === 'approve' ? 'verified' : 'rejected';
        await db.query(
            `UPDATE driver_license
             SET verification_status     = $2,
                 dl_manual_review_reason = NULL,
                 verified_at             = CASE WHEN $2 = 'verified' THEN NOW() ELSE verified_at END,
                 rejected_reason         = CASE WHEN $2 = 'rejected' THEN $3 ELSE rejected_reason END
             WHERE driver_id = $1`,
            [driverId, status, reason || null]
        );
    }
    if (rcDecision) {
        const status = rcDecision === 'approve' ? 'verified' : 'rejected';
        await db.query(
            `UPDATE driver_vehicle
             SET verification_status     = $2,
                 rc_manual_review_reason = NULL,
                 verified_at             = CASE WHEN $2 = 'verified' THEN NOW() ELSE verified_at END,
                 rejected_reason         = CASE WHEN $2 = 'rejected' THEN $3 ELSE rejected_reason END
             WHERE driver_id = $1`,
            [driverId, status, reason || null]
        );
    }
    return findDocsByDriverId(driverId);
};
