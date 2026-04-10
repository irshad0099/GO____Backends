import { db } from '../../../infrastructure/database/postgres.js';

// ─── Create / Fetch ───────────────────────────────────────────────────────────

export const findByUserId = async (userId) => {
    const { rows } = await db.query(
        'SELECT * FROM rider_kyc WHERE user_id = $1',
        [userId]
    );
    return rows[0] || null;
};

export const createKyc = async (userId) => {
    const { rows } = await db.query(
        `INSERT INTO rider_kyc (user_id) VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING
         RETURNING *`,
        [userId]
    );
    // If record already existed, fetch it
    if (!rows[0]) return findByUserId(userId);
    return rows[0];
};

// ─── Aadhaar ──────────────────────────────────────────────────────────────────

export const setAadhaarOtpSent = async (userId, refId) => {
    const { rows } = await db.query(
        `UPDATE rider_kyc
         SET aadhaar_status   = 'otp_sent',
             aadhaar_ref_id   = $2,
             aadhaar_attempts = aadhaar_attempts + 1,
             kyc_status       = CASE WHEN kyc_status = 'pending' THEN 'in_progress' ELSE kyc_status END,
             updated_at       = NOW()
         WHERE user_id = $1
         RETURNING *`,
        [userId, refId]
    );
    return rows[0];
};

export const setAadhaarVerified = async (userId, data) => {
    const { rows } = await db.query(
        `UPDATE rider_kyc
         SET aadhaar_status        = 'verified',
             aadhaar_name          = $2,
             aadhaar_number_masked = $3,
             aadhaar_dob           = $4,
             aadhaar_gender        = $5,
             aadhaar_state         = $6,
             aadhaar_verified_at   = NOW(),
             updated_at            = NOW()
         WHERE user_id = $1
         RETURNING *`,
        [userId, data.name, data.numberMasked, data.dob, data.gender, data.state]
    );
    return rows[0];
};

export const setAadhaarFailed = async (userId) => {
    const { rows } = await db.query(
        `UPDATE rider_kyc
         SET aadhaar_status   = 'failed',
             aadhaar_attempts = aadhaar_attempts + 1,
             updated_at       = NOW()
         WHERE user_id = $1
         RETURNING *`,
        [userId]
    );
    return rows[0];
};

// ─── PAN ──────────────────────────────────────────────────────────────────────

export const setPanVerified = async (userId, data) => {
    const { rows } = await db.query(
        `UPDATE rider_kyc
         SET pan_status       = 'verified',
             pan_name         = $2,
             pan_number_masked= $3,
             pan_dob          = $4,
             pan_attempts     = pan_attempts + 1,
             pan_verified_at  = NOW(),
             updated_at       = NOW()
         WHERE user_id = $1
         RETURNING *`,
        [userId, data.name, data.numberMasked, data.dob]
    );
    return rows[0];
};

export const setPanFailed = async (userId) => {
    const { rows } = await db.query(
        `UPDATE rider_kyc
         SET pan_status   = 'failed',
             pan_attempts = pan_attempts + 1,
             updated_at   = NOW()
         WHERE user_id = $1
         RETURNING *`,
        [userId]
    );
    return rows[0];
};

// ─── Bank ─────────────────────────────────────────────────────────────────────

export const setBankVerified = async (userId, data) => {
    const { rows } = await db.query(
        `UPDATE rider_kyc
         SET bank_status        = 'verified',
             bank_account_masked= $2,
             bank_ifsc          = $3,
             bank_holder_name   = $4,
             bank_name          = $5,
             bank_verified_at   = NOW(),
             updated_at         = NOW()
         WHERE user_id = $1
         RETURNING *`,
        [userId, data.accountMasked, data.ifsc, data.holderName, data.bankName]
    );
    return rows[0];
};

export const setBankFailed = async (userId) => {
    const { rows } = await db.query(
        `UPDATE rider_kyc
         SET bank_status = 'failed',
             updated_at  = NOW()
         WHERE user_id = $1
         RETURNING *`,
        [userId]
    );
    return rows[0];
};

// ─── Face ─────────────────────────────────────────────────────────────────────

export const setFaceVerified = async (userId, score) => {
    const { rows } = await db.query(
        `UPDATE rider_kyc
         SET face_status      = 'verified',
             face_match_score = $2,
             face_verified_at = NOW(),
             updated_at       = NOW()
         WHERE user_id = $1
         RETURNING *`,
        [userId, score]
    );
    return rows[0];
};

export const setFaceFailed = async (userId, score) => {
    const { rows } = await db.query(
        `UPDATE rider_kyc
         SET face_status      = 'failed',
             face_match_score = $2,
             updated_at       = NOW()
         WHERE user_id = $1
         RETURNING *`,
        [userId, score]
    );
    return rows[0];
};

// ─── Driving License ──────────────────────────────────────────────────────────

export const setDrivingLicenseVerified = async (userId, data) => {
    const { rows } = await db.query(
        `UPDATE rider_kyc
         SET dl_status            = 'verified',
             dl_number_masked     = $2,
             dl_verified_name     = $3,
             dl_verified_dob      = $4,
             dl_issuing_authority = $5,
             dl_cf_reference_id   = $6,
             dl_attempts          = dl_attempts + 1,
             dl_verified_at       = NOW(),
             updated_at           = NOW()
         WHERE user_id = $1
         RETURNING *`,
        [userId, data.numberMasked, data.verifiedName, data.verifiedDob, data.issuingAuthority, data.referenceId]
    );
    return rows[0];
};

export const setDrivingLicenseFailed = async (userId) => {
    const { rows } = await db.query(
        `UPDATE rider_kyc
         SET dl_status   = 'failed',
             dl_attempts = dl_attempts + 1,
             updated_at  = NOW()
         WHERE user_id = $1
         RETURNING *`,
        [userId]
    );
    return rows[0];
};

export const setDrivingLicenseManualReview = async (userId, reason) => {
    const { rows } = await db.query(
        `UPDATE rider_kyc
         SET dl_status               = 'pending',
             dl_manual_review_reason = $2,
             updated_at              = NOW()
         WHERE user_id = $1
         RETURNING *`,
        [userId, reason]
    );
    return rows[0];
};

// ─── Vehicle RC ───────────────────────────────────────────────────────────────

export const setVehicleRcVerified = async (userId, data) => {
    const { rows } = await db.query(
        `UPDATE rider_kyc
         SET rc_status               = 'verified',
             rc_number_masked        = $2,
             rc_owner_name           = $3,
             rc_vehicle_model        = $4,
             rc_fuel_type            = $5,
             rc_registration_date    = $6,
             rc_vehicle_class        = $7,
             rc_cf_reference_id      = $8,
             rc_attempts             = rc_attempts + 1,
             rc_verified_at          = NOW(),
             updated_at              = NOW()
         WHERE user_id = $1
         RETURNING *`,
        [userId, data.numberMasked, data.ownerName, data.vehicleModel, data.fuelType, data.registrationDate, data.vehicleClass, data.referenceId]
    );
    return rows[0];
};

export const setVehicleRcFailed = async (userId) => {
    const { rows } = await db.query(
        `UPDATE rider_kyc
         SET rc_status   = 'failed',
             rc_attempts = rc_attempts + 1,
             updated_at  = NOW()
         WHERE user_id = $1
         RETURNING *`,
        [userId]
    );
    return rows[0];
};

export const setVehicleRcManualReview = async (userId, reason) => {
    const { rows } = await db.query(
        `UPDATE rider_kyc
         SET rc_status               = 'pending',
             rc_manual_review_reason = $2,
             updated_at              = NOW()
         WHERE user_id = $1
         RETURNING *`,
        [userId, reason]
    );
    return rows[0];
};

// ─── Overall Status ───────────────────────────────────────────────────────────

export const setOverallStatus = async (userId, status, extra = {}) => {
    const { rows } = await db.query(
        `UPDATE rider_kyc
         SET kyc_status           = $2,
             manual_review_reason = COALESCE($3, manual_review_reason),
             rejection_reason     = COALESCE($4, rejection_reason),
             updated_at           = NOW()
         WHERE user_id = $1
         RETURNING *`,
        [userId, status, extra.manualReason || null, extra.rejectionReason || null]
    );
    return rows[0];
};

// ─── Admin: Manual Review ─────────────────────────────────────────────────────

export const resolveManualReview = async (userId, decision, adminId, reason) => {
    const status = decision === 'approve' ? 'approved' : 'rejected';
    const { rows } = await db.query(
        `UPDATE rider_kyc
         SET kyc_status       = $2,
             reviewed_by      = $3,
             reviewed_at      = NOW(),
             rejection_reason = CASE WHEN $2 = 'rejected' THEN $4 ELSE rejection_reason END,
             updated_at       = NOW()
         WHERE user_id = $1
         RETURNING *`,
        [userId, status, adminId, reason || null]
    );
    return rows[0];
};

// ─── Admin: List Manual Reviews ───────────────────────────────────────────────

export const listManualReviews = async ({ limit = 20, offset = 0 }) => {
    const { rows } = await db.query(
        `SELECT rk.*, u.full_name, u.phone_number
         FROM rider_kyc rk
         JOIN users u ON u.id = rk.user_id
         WHERE rk.kyc_status = 'manual_review'
         ORDER BY rk.updated_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
    );
    return rows;
};
