import { db } from '../../../infrastructure/database/postgres.js';

const ALL_DOC_TYPES = ['AADHAAR', 'PAN', 'DRIVING_LICENCE', 'VEHICLE_RC', 'BANK_ACCOUNT', 'SELFIE'];

// ─── Document CRUD ────────────────────────────────────────────────────────────

export const createDocument = async (userId, docType, method, fileUrl) => {
    const { rows } = await db.query(
        `INSERT INTO kyc_documents (user_id, document_type, method, status, file_url)
         VALUES ($1, $2, $3, 'pending', $4)
         ON CONFLICT (user_id, document_type) DO UPDATE
           SET status        = 'pending',
               file_url      = EXCLUDED.file_url,
               method        = EXCLUDED.method,
               attempt_count = kyc_documents.attempt_count + 1,
               rejection_reason = NULL,
               extracted_data   = NULL,
               confidence_score = NULL,
               fraud_score      = 0,
               document_hash    = NULL,
               document_number  = NULL,
               reviewed_by      = NULL,
               verified_at      = NULL,
               updated_at       = NOW()
         RETURNING *`,
        [userId, docType, method, fileUrl]
    );
    return rows[0];
};

export const updateDocument = async (id, data) => {
    const {
        status, extractedData, confidenceScore, fraudScore,
        documentNumber, documentHash, fileUrl, rejectionReason, verifiedAt,
    } = data;
    const { rows } = await db.query(
        `UPDATE kyc_documents
         SET status           = COALESCE($2, status),
             extracted_data   = COALESCE($3, extracted_data),
             confidence_score = COALESCE($4, confidence_score),
             fraud_score      = COALESCE($5, fraud_score),
             document_number  = COALESCE($6, document_number),
             document_hash    = COALESCE($7, document_hash),
             file_url         = COALESCE($8, file_url),
             rejection_reason = COALESCE($9, rejection_reason),
             verified_at      = COALESCE($10, verified_at),
             updated_at       = NOW()
         WHERE id = $1
         RETURNING *`,
        [id, status, extractedData, confidenceScore, fraudScore,
         documentNumber, documentHash, fileUrl, rejectionReason, verifiedAt]
    );
    return rows[0];
};

export const getDocsByUser = async (userId) => {
    const { rows } = await db.query(
        `SELECT * FROM kyc_documents WHERE user_id = $1 ORDER BY document_type`,
        [userId]
    );
    return rows;
};

export const getDocByUserAndType = async (userId, docType) => {
    const { rows } = await db.query(
        `SELECT * FROM kyc_documents WHERE user_id = $1 AND document_type = $2`,
        [userId, docType]
    );
    return rows[0] || null;
};

export const getDocById = async (id) => {
    const { rows } = await db.query(
        `SELECT * FROM kyc_documents WHERE id = $1`,
        [id]
    );
    return rows[0] || null;
};

// Returns true if hash is already used by a DIFFERENT user
export const checkHashConflict = async (docType, hash, userId) => {
    const { rows } = await db.query(
        `SELECT user_id FROM kyc_documents
         WHERE document_type = $1 AND document_hash = $2 AND user_id != $3
         LIMIT 1`,
        [docType, hash, userId]
    );
    return rows.length > 0;
};

// ─── driver_kyc_status aggregate ─────────────────────────────────────────────

export const getKycStatus = async (userId) => {
    const { rows } = await db.query(
        `SELECT * FROM driver_kyc_status WHERE user_id = $1`,
        [userId]
    );
    return rows[0] || null;
};

export const upsertKycStatus = async (userId, data) => {
    const {
        overallStatus, submittedDocsCount, verifiedDocsCount,
        verifiedAt, suspendedAt, suspensionReason,
    } = data;
    const { rows } = await db.query(
        `INSERT INTO driver_kyc_status
            (user_id, overall_status, submitted_docs_count, verified_docs_count,
             last_activity_at, verified_at, suspended_at, suspension_reason)
         VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7)
         ON CONFLICT (user_id) DO UPDATE
           SET overall_status       = EXCLUDED.overall_status,
               submitted_docs_count = EXCLUDED.submitted_docs_count,
               verified_docs_count  = EXCLUDED.verified_docs_count,
               last_activity_at     = NOW(),
               verified_at          = COALESCE(EXCLUDED.verified_at, driver_kyc_status.verified_at),
               suspended_at         = COALESCE(EXCLUDED.suspended_at, driver_kyc_status.suspended_at),
               suspension_reason    = COALESCE(EXCLUDED.suspension_reason, driver_kyc_status.suspension_reason)
         RETURNING *`,
        [userId, overallStatus, submittedDocsCount, verifiedDocsCount,
         verifiedAt || null, suspendedAt || null, suspensionReason || null]
    );
    return rows[0];
};

// ─── Fraud flags ──────────────────────────────────────────────────────────────

export const addFraudFlag = async (docId, flagType, severity, details) => {
    await db.query(
        `INSERT INTO kyc_fraud_flags (document_id, flag_type, severity, details)
         VALUES ($1, $2, $3, $4)`,
        [docId, flagType, severity, JSON.stringify(details || {})]
    );
};

export const getFraudFlags = async (severity) => {
    const { rows } = await db.query(
        `SELECT kff.*, kd.document_type, kd.user_id, u.full_name, u.phone_number
         FROM kyc_fraud_flags kff
         JOIN kyc_documents kd ON kd.id = kff.document_id
         JOIN users u ON u.id = kd.user_id
         WHERE ($1::text IS NULL OR kff.severity = $1)
         ORDER BY kff.created_at DESC
         LIMIT 100`,
        [severity || null]
    );
    return rows;
};

// ─── Audit log ────────────────────────────────────────────────────────────────

export const addAuditLog = async ({ userId, docId, action, actorType, actorId, beforeState, afterState }) => {
    await db.query(
        `INSERT INTO kyc_audit_log
            (user_id, document_id, action, actor_type, actor_id, before_state, after_state)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, docId, action, actorType, actorId,
         beforeState ? JSON.stringify(beforeState) : null,
         afterState  ? JSON.stringify(afterState)  : null]
    );
};

// ─── Admin queue ──────────────────────────────────────────────────────────────

export const listReviewQueue = async (type, page, limit) => {
    const offset = (page - 1) * limit;
    const { rows } = await db.query(
        `SELECT kd.*, u.full_name, u.phone_number
         FROM kyc_documents kd
         JOIN users u ON u.id = kd.user_id
         WHERE kd.status = 'manual_review'
           AND ($1::text IS NULL OR kd.document_type = $1)
         ORDER BY kd.updated_at ASC
         LIMIT $2 OFFSET $3`,
        [type || null, limit, offset]
    );
    const { rows: countRows } = await db.query(
        `SELECT COUNT(*) FROM kyc_documents
         WHERE status = 'manual_review' AND ($1::text IS NULL OR document_type = $1)`,
        [type || null]
    );
    return { items: rows, total: parseInt(countRows[0].count, 10) };
};

export const getDocForAdmin = async (id) => {
    const { rows } = await db.query(
        `SELECT kd.*, u.full_name, u.phone_number, u.email,
                dks.overall_status AS driver_overall_status
         FROM kyc_documents kd
         JOIN users u ON u.id = kd.user_id
         LEFT JOIN driver_kyc_status dks ON dks.user_id = kd.user_id
         WHERE kd.id = $1`,
        [id]
    );
    return rows[0] || null;
};

export const adminUpdateDoc = async (id, status, adminId, rejectionReason) => {
    const verifiedAt = ['approved', 'auto_verified'].includes(status) ? 'NOW()' : 'NULL';
    const { rows } = await db.query(
        `UPDATE kyc_documents
         SET status           = $2,
             reviewed_by      = $3,
             rejection_reason = $4,
             verified_at      = ${verifiedAt === 'NOW()' ? 'NOW()' : 'NULL'},
             updated_at       = NOW()
         WHERE id = $1
         RETURNING *`,
        [id, status, adminId, rejectionReason || null]
    );
    return rows[0];
};

export const suspendDriver = async (userId, reason) => {
    const { rows } = await db.query(
        `UPDATE driver_kyc_status
         SET overall_status   = 'suspended',
             suspended_at     = NOW(),
             suspension_reason = $2
         WHERE user_id = $1
         RETURNING *`,
        [userId, reason]
    );
    return rows[0];
};

// ─── Aggregate recomputation ──────────────────────────────────────────────────

export const recomputeAggregate = async (userId) => {
    const docs = await getDocsByUser(userId);

    const submittedCount = docs.length;
    const verifiedDocs   = docs.filter(d => ['auto_verified', 'approved'].includes(d.status));
    const verifiedCount  = verifiedDocs.length;

    let overallStatus = 'not_started';
    if (submittedCount === 0) {
        overallStatus = 'not_started';
    } else if (verifiedCount === ALL_DOC_TYPES.length) {
        overallStatus = 'verified';
    } else {
        const hasManualReview  = docs.some(d => d.status === 'manual_review');
        const allTypesPresent  = ALL_DOC_TYPES.every(t => docs.find(d => d.document_type === t));
        const hasHardReject    = docs.some(d => d.status === 'rejected' && d.attempt_count >= 3);
        const hasSoftReject    = docs.some(d => d.status === 'rejected');

        if (hasHardReject) {
            overallStatus = 'suspended';
        } else if (allTypesPresent && hasManualReview && !hasSoftReject) {
            overallStatus = 'pending_review';
        } else if (hasSoftReject) {
            overallStatus = 'rejected';
        } else {
            overallStatus = 'in_progress';
        }
    }

    return upsertKycStatus(userId, {
        overallStatus,
        submittedDocsCount: submittedCount,
        verifiedDocsCount:  verifiedCount,
        verifiedAt:   overallStatus === 'verified' ? new Date() : null,
        suspendedAt:  overallStatus === 'suspended' ? new Date() : null,
    });
};
