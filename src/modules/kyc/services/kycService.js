import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as cf from './cashfreeService.js';
import * as repo from '../repositories/kycDocuments.repository.js';
import * as scoring from './kycScoringService.js';
import { ENV } from '../../../config/envConfig.js';
import logger from '../../../core/logger/logger.js';
import { ConflictError, ValidationError, NotFoundError } from '../../../core/errors/ApiError.js';
import { db } from '../../../infrastructure/database/postgres.js';

// ─── S3 helpers ───────────────────────────────────────────────────────────────

const s3 = new S3Client({
    region: ENV.AWS_REGION,
    credentials: {
        accessKeyId:     ENV.AWS_ACCESS_KEY_ID,
        secretAccessKey: ENV.AWS_SECRET_ACCESS_KEY,
    },
});

const S3_BUCKET = process.env.AWS_BUCKET_NAME || 'go-mobility-kyc';

const uploadKycFile = async (userId, docType, buffer, mimeType) => {
    const ext = mimeType === 'application/pdf' ? 'pdf' : (mimeType.split('/')[1] || 'jpg');
    const key = `kyc/${userId}/${docType.toLowerCase()}/${Date.now()}.${ext}`;
    await s3.send(new PutObjectCommand({
        Bucket:      S3_BUCKET,
        Key:         key,
        Body:        buffer,
        ContentType: mimeType,
    }));
    return `https://${S3_BUCKET}.s3.${ENV.AWS_REGION}.amazonaws.com/${key}`;
};

// ─── User profile helper ──────────────────────────────────────────────────────

const getUserFullName = async (userId) => {
    const { rows } = await db.query('SELECT full_name FROM users WHERE id = $1', [userId]);
    return rows[0]?.full_name || '';
};

// ─── Masks ────────────────────────────────────────────────────────────────────

const maskAadhaar = n => `XXXX XXXX ${String(n).slice(-4)}`;
const maskPan     = p => `${String(p).slice(0, 3)}XXXXX${String(p).slice(-1)}`;
const maskAccount = a => `XXXX${String(a).slice(-4)}`;
const maskLicense = n => `XXXX${String(n).slice(-4)}`;

// ─── Fraud flag persistence ───────────────────────────────────────────────────

const persistFlags = async (docId, userId, flags) => {
    for (const f of flags) {
        await repo.addFraudFlag(docId, f.type, f.severity, f.details || {});
        await repo.addAuditLog({ userId, docId, action: 'FRAUD_FLAGGED', actorType: 'system', actorId: null,
            beforeState: null, afterState: { flag: f.type, severity: f.severity } });
    }
};

// ─── OCR document submit ──────────────────────────────────────────────────────

const SUPPORTED_OCR_TYPES = new Set(['AADHAAR', 'PAN', 'DRIVING_LICENCE', 'VEHICLE_RC']);

export const submitDocument = async (userId, docType, { fileBuffer, fileName, mimeType, backFileBuffer = null, backFileName = null, backMimeType = null }) => {
    if (!SUPPORTED_OCR_TYPES.has(docType)) {
        throw new ValidationError(`Invalid document_type: ${docType}`);
    }

    // Check if already verified — can't re-submit a verified doc
    const existing = await repo.getDocByUserAndType(userId, docType);
    if (existing && ['auto_verified', 'approved'].includes(existing.status)) {
        throw new ConflictError(`${docType} already verified`);
    }
    if (existing && existing.status === 'rejected' && existing.attempt_count >= 3) {
        throw new ValidationError(`Maximum retries reached for ${docType}. Please contact support.`);
    }

    // Upload to S3
    let fileUrl;
    try {
        fileUrl = await uploadKycFile(userId, docType, fileBuffer, mimeType);
    } catch (err) {
        logger.error(`[KYC] S3 upload failed for ${docType} user=${userId}:`, err);
        throw new ValidationError('File upload failed. Please try again.');
    }

    // Create/update DB record first (pending state)
    const doc = await repo.createDocument(userId, docType, 'OCR', fileUrl);

    await repo.addAuditLog({ userId, docId: doc.id, action: 'SUBMITTED',
        actorType: 'driver', actorId: userId,
        beforeState: existing ? { status: existing.status } : null,
        afterState: { status: 'pending', attempt: doc.attempt_count } });

    // Call Cashfree OCR
    let cfResp;
    try {
        cfResp = await cf.smartOcr({
            documentType: docType,
            fileBuffer,
            fileName,
            mimeType,
            doVerification: ['PAN', 'DRIVING_LICENCE'].includes(docType),
        });
    } catch (err) {
        const msg = err.response?.data?.message || `${docType} OCR service error`;
        await repo.updateDocument(doc.id, { status: 'rejected', rejectionReason: msg });
        await repo.recomputeAggregate(userId);
        throw Object.assign(new Error(msg), { statusCode: 422 });
    }

    // Extract fields per doc type
    const fields = cfResp.document_fields  || {};
    const vdet   = cfResp.verification_details || {};

    let docNumber, extractedName, extractedData;

    switch (docType) {
        case 'AADHAAR': {
            docNumber     = fields.aadhaar_number || fields.uid || fields.id_number;
            extractedName = fields.name;
            extractedData = {
                name:    extractedName || null,
                dob:     fields.dob || fields.date_of_birth || null,
                gender:  fields.gender || null,
                state:   fields.split_address?.state || fields.state || null,
                masked:  docNumber ? maskAadhaar(docNumber) : null,
            };

            // Back side OCR — address fetch karo
            if (backFileBuffer) {
                try {
                    const backResp = await cf.smartOcr({
                        documentType: 'AADHAAR',
                        fileBuffer:   backFileBuffer,
                        fileName:     backFileName,
                        mimeType:     backMimeType,
                        doVerification: false,
                    });
                    const bf = backResp.document_fields || {};
                    extractedData.address            = bf.address || null;
                    extractedData.pin_code           = bf.pin_code || bf.pincode || null;
                    extractedData.district           = bf.district || null;
                    extractedData.state              = extractedData.state || bf.split_address?.state || bf.state || null;
                    extractedData.cashfree_ocr_back  = backResp;
                } catch (backErr) {
                    // Back OCR fail hone se front reject nahi hona chahiye
                    logger.warn(`[KYC] Aadhaar back OCR failed for user=${userId}:`, backErr.message);
                    extractedData.address  = null;
                    extractedData.pin_code = null;
                }
            }
            break;
        }
        case 'PAN': {
            docNumber     = fields.pan || vdet.pan;
            extractedName = vdet.name || fields.name;
            extractedData = {
                name:                    extractedName || null,
                father:                  fields.father || null,
                dob:                     vdet.dob || fields.dob || null,
                masked:                  docNumber ? maskPan(docNumber) : null,
                govt_verified:           vdet.status === 'VALID',
                pan_status:              vdet.pan_status || null,
                name_match:              vdet.name_match || null,
                dob_match:               vdet.dob_match  || null,
                aadhaar_linked:          vdet.aadhaar_seeding_status === 'Y',
                aadhaar_seeding_desc:    vdet.aadhaar_seeding_status_desc || null,
            };
            break;
        }
        case 'DRIVING_LICENCE': {
            docNumber     = fields.license_number || fields.dl_number || vdet.dl_number;
            extractedName = vdet.details_of_driving_licence?.name || vdet.name || fields.full_name || fields.name;
            const dlValidity = vdet.dl_validity || {};
            extractedData = {
                name:              extractedName || null,
                guardian:          fields.guardian_name || vdet.details_of_driving_licence?.father_or_husband_name || null,
                dob:               vdet.dob || fields.date_of_birth || null,
                blood_group:       fields.blood_group || null,
                address:           vdet.details_of_driving_licence?.address || fields.address || null,
                pin_code:          fields.pin || null,
                issuing_authority: fields.issuing_authority || null,
                issue_date:        fields.license_issue_date || null,
                expiry_date:       fields.license_expiry_date || dlValidity.non_transport?.validity_to || null,
                masked:            docNumber ? maskLicense(docNumber) : null,
                govt_verified:     vdet.status === 'VALID',
                dl_status:         vdet.details_of_driving_licence?.status || null,
                photo_url:         vdet.details_of_driving_licence?.photo || null,
            };
            break;
        }
        case 'VEHICLE_RC': {
            docNumber     = fields.registration_number || fields.rc_number;
            extractedName = fields.owner_name || fields.owner;
            extractedData = {
                owner:                extractedName || null,
                relation_name:        fields.relation_name || null,
                vehicle_model:        fields.vehicle_model || null,
                vehicle_type:         fields.vehicle_type  || null,
                manufacturer:         fields.manufacturer_name || null,
                manufacturing_date:   fields.manufacturing_date || null,
                registration_date:    fields.registration_date || null,
                registration_validity:fields.registration_validity || null,
                chassis_number:       fields.chassis_number || null,
                engine_number:        fields.engine_number  || null,
                address:              fields.address || null,
                masked:               docNumber ? String(docNumber).toUpperCase() : null,
            };
            break;
        }
    }

    // Cashfree ka poora response store karo — verification system banane mein kaam aayega
    extractedData.cashfree_ocr = cfResp;

    if (!docNumber) {
        await repo.updateDocument(doc.id, { status: 'rejected', rejectionReason: `Could not extract ${docType} number from image` });
        await repo.recomputeAggregate(userId);
        throw Object.assign(new Error(`Could not extract ${docType} number. Please upload a clearer image.`), { statusCode: 422 });
    }

    // Govt DB check (PAN + DL only — hard fail)
    if (['PAN', 'DRIVING_LICENCE'].includes(docType) && vdet.status && vdet.status !== 'VALID' && ENV.CASHFREE_ENV === 'production') {
        const reason = `${docType} not found or invalid in government records`;
        await repo.updateDocument(doc.id, { status: 'rejected', rejectionReason: reason });
        await repo.recomputeAggregate(userId);
        throw Object.assign(new Error(reason), { statusCode: 422 });
    }

    // Duplicate hash check
    const docHash  = scoring.hashDocNumber(docNumber);
    const isDuplic = await repo.checkHashConflict(docType, docHash, userId);

    const userFullName = await getUserFullName(userId);
    const existingDocs = await repo.getDocsByUser(userId);

    const decision = await scoring.decideDocumentStatus({
        cfResp, documentType: docType,
        extractedName, userFullName,
        existingDocs, userId,
        duplicateHash: isDuplic,
    });

    const verifiedAt = ['auto_verified'].includes(decision.status) ? new Date() : null;
    const updatedDoc = await repo.updateDocument(doc.id, {
        status:          decision.status,
        extractedData:   JSON.stringify(extractedData),
        confidenceScore: decision.confidenceScore,
        fraudScore:      decision.flags.length > 0 ? decision.flags.length * 10 : 0,
        documentNumber:  docNumber ? String(docNumber).slice(-4) : null,
        documentHash:    isDuplic ? null : docHash,
        rejectionReason: decision.reason || null,
        verifiedAt,
    });

    if (decision.flags.length > 0) {
        await persistFlags(doc.id, userId, decision.flags);
    }

    const auditAction = decision.status === 'auto_verified'       ? 'AUTO_VERIFIED'
                      : decision.status === 'manual_review'       ? 'MANUAL_REVIEW_ASSIGNED'
                      : 'REJECTED';
    await repo.addAuditLog({ userId, docId: doc.id, action: auditAction,
        actorType: 'system', actorId: null,
        beforeState: { status: 'pending' },
        afterState: { status: decision.status, score: decision.score } });

    if (decision.isDuplicate) {
        throw new ConflictError('This document is already registered with another account');
    }

    await repo.recomputeAggregate(userId);

    return {
        documentId:      updatedDoc.id,
        documentType:    docType,
        status:          updatedDoc.status,
        confidenceScore: updatedDoc.confidence_score,
        extractedData,
        message:         decision.status === 'auto_verified'
                            ? `${docType} verified successfully`
                            : decision.status === 'manual_review'
                                ? 'Document submitted for manual review. You\'ll be notified within 24 hours.'
                                : decision.reason || 'Document rejected',
        attemptsLeft:    decision.status === 'rejected' ? Math.max(0, 3 - updatedDoc.attempt_count) : undefined,
    };
};

// ─── Retry ────────────────────────────────────────────────────────────────────

export const retryDocument = async (docId, userId, { fileBuffer, fileName, mimeType }) => {
    const doc = await repo.getDocById(docId);
    if (!doc) throw new NotFoundError('Document not found');
    if (doc.user_id !== userId) throw new ValidationError('Unauthorized');
    if (doc.status !== 'rejected') throw new ValidationError('Only rejected documents can be retried');
    if (doc.attempt_count >= 3) throw new ValidationError('Maximum retries reached. Please contact support.');

    return submitDocument(userId, doc.document_type, { fileBuffer, fileName, mimeType });
};

// ─── Bank account (penny-drop) ────────────────────────────────────────────────

export const submitBankAccount = async (userId, accountNumber, ifsc, name) => {
    const existing = await repo.getDocByUserAndType(userId, 'BANK_ACCOUNT');
    if (existing && ['auto_verified', 'approved'].includes(existing.status)) {
        throw new ConflictError('Bank account already verified');
    }
    if (existing && existing.status === 'rejected' && existing.attempt_count >= 3) {
        throw new ValidationError('Maximum retries reached for bank verification. Please contact support.');
    }

    const doc = await repo.createDocument(userId, 'BANK_ACCOUNT', 'PENNY_DROP', null);
    await repo.addAuditLog({ userId, docId: doc.id, action: 'SUBMITTED', actorType: 'driver', actorId: userId,
        beforeState: null, afterState: { status: 'pending' } });

    let cfResp;
    try {
        cfResp = await cf.verifyBankAccount(accountNumber, ifsc, name);
        console.log('Cashfree bank verification response:', cfResp);
    } catch (err) {
        await repo.updateDocument(doc.id, { status: 'rejected', rejectionReason: 'Bank verification service error' });
        await repo.recomputeAggregate(userId);
        throw Object.assign(new Error('Bank account verification failed'), { statusCode: 422 });
    }

    if (cfResp.account_status !== 'VALID') {
        const reason = 'Bank account invalid or details do not match';
        await repo.updateDocument(doc.id, { status: 'rejected', rejectionReason: reason });
        await repo.recomputeAggregate(userId);
        throw Object.assign(new Error(reason), { statusCode: 422 });
    }

    const docHash = scoring.hashDocNumber(accountNumber);
    const isDup   = await repo.checkHashConflict('BANK_ACCOUNT', docHash, userId);
    if (isDup) {
        await repo.updateDocument(doc.id, { status: 'rejected', rejectionReason: 'Account already registered' });
        await repo.recomputeAggregate(userId);
        throw new ConflictError('This bank account is already registered with another account');
    }

    const extractedData = {
        account_masked:     maskAccount(accountNumber),
        ifsc:               ifsc.toUpperCase(),
        holder_name:        cfResp.name_at_bank || name,
        bank_name:          cfResp.bank_name    || null,
        branch:             cfResp.branch       || null,
        city:               cfResp.city         || null,
        micr:               cfResp.micr         || null,
        utr:                cfResp.utr          || null,
        account_status:     cfResp.account_status      || null,
        account_status_code:cfResp.account_status_code || null,
        name_match_score:   cfResp.name_match_score    || null,
        name_match_result:  cfResp.name_match_result   || null,
        ifsc_details:       cfResp.ifsc_details        || null,
        cashfree_ocr:       cfResp,
    };

    const updatedDoc = await repo.updateDocument(doc.id, {
        status:          'auto_verified',
        extractedData:   JSON.stringify(extractedData),
        confidenceScore: 100,
        documentNumber:  String(accountNumber).slice(-4),
        documentHash:    docHash,
        verifiedAt:      new Date(),
    });

    await repo.addAuditLog({ userId, docId: doc.id, action: 'AUTO_VERIFIED', actorType: 'system', actorId: null,
        beforeState: { status: 'pending' }, afterState: { status: 'auto_verified' } });

    await repo.recomputeAggregate(userId);

    return {
        documentId:   updatedDoc.id,
        documentType: 'BANK_ACCOUNT',
        status:       'auto_verified',
        extractedData,
        message:      'Bank account verified successfully',
    };
};

// ─── Selfie upload (admin reviews manually) ───────────────────────────────────

export const submitFaceMatch = async (userId, { fileBuffer, mimeType }) => {
    const aadhaarDoc = await repo.getDocByUserAndType(userId, 'AADHAAR');
    if (!aadhaarDoc || !['auto_verified', 'approved'].includes(aadhaarDoc.status)) {
        throw new ValidationError('Please complete Aadhaar verification before uploading selfie');
    }

    const existing = await repo.getDocByUserAndType(userId, 'SELFIE');
    if (existing && ['approved'].includes(existing.status)) {
        throw new ConflictError('Selfie already approved');
    }
    if (existing && existing.status === 'rejected' && existing.attempt_count >= 3) {
        throw new ValidationError('Maximum selfie retries reached. Please contact support.');
    }

    // Upload selfie to S3
    let selfieUrl;
    try {
        selfieUrl = await uploadKycFile(userId, 'SELFIE', fileBuffer, mimeType);
    } catch (err) {
        logger.error(`[KYC] Selfie S3 upload failed user=${userId}:`, err);
        throw new ValidationError('Selfie upload failed. Please try again.');
    }

    // Always goes to manual_review — admin compares selfie vs Aadhaar visually
    const doc = await repo.createDocument(userId, 'SELFIE', 'FACE_MATCH', selfieUrl);

    const updatedDoc = await repo.updateDocument(doc.id, {
        status:          'manual_review',
        extractedData:   JSON.stringify({ aadhaar_doc_id: aadhaarDoc.id, aadhaar_file_url: aadhaarDoc.file_url }),
        confidenceScore: null,
    });

    await repo.addAuditLog({ userId, docId: doc.id, action: 'MANUAL_REVIEW_ASSIGNED',
        actorType: 'system', actorId: null,
        beforeState: null, afterState: { status: 'manual_review' } });

    await repo.recomputeAggregate(userId);

    return {
        documentId:   updatedDoc.id,
        documentType: 'SELFIE',
        status:       'manual_review',
        message:      'Selfie submitted for admin review. You\'ll be notified within 24 hours.',
    };
};

// ─── Driver KYC status ────────────────────────────────────────────────────────

const ALL_DOC_TYPES = ['AADHAAR', 'PAN', 'DRIVING_LICENCE', 'VEHICLE_RC', 'BANK_ACCOUNT', 'SELFIE'];

const nextActionMessage = (docMap, overall) => {
    if (overall?.overall_status === 'verified') return null;
    const pending = ALL_DOC_TYPES.find(t => {
        const d = docMap[t];
        return !d || !['auto_verified', 'approved', 'manual_review'].includes(d.status);
    });
    if (!pending) return 'All documents submitted. Awaiting review.';
    const labels = { AADHAAR: 'Aadhaar', PAN: 'PAN', DRIVING_LICENCE: 'Driving Licence', VEHICLE_RC: 'Vehicle RC', BANK_ACCOUNT: 'Bank Account', SELFIE: 'Selfie' };
    return `Please upload ${labels[pending]}`;
};

export const getKycStatus = async (userId) => {
    const [docs, overall] = await Promise.all([
        repo.getDocsByUser(userId),
        repo.getKycStatus(userId),
    ]);

    const docMap = {};
    docs.forEach(d => { docMap[d.document_type] = d; });

    return {
        overallStatus:      overall?.overall_status || 'not_started',
        submittedDocsCount: overall?.submitted_docs_count || 0,
        verifiedDocsCount:  overall?.verified_docs_count || 0,
        canGoOnline:        overall?.overall_status === 'verified',
        documents: ALL_DOC_TYPES.map(type => {
            const doc = docMap[type];
            if (!doc) return { type, status: 'not_submitted', canRetry: true };
            return {
                type,
                documentId:      doc.id,
                status:          doc.status,
                confidenceScore: doc.confidence_score,
                canRetry:        doc.status === 'rejected' && doc.attempt_count < 3,
                attemptsLeft:    doc.status === 'rejected' ? Math.max(0, 3 - doc.attempt_count) : undefined,
                rejectionReason: doc.rejection_reason || undefined,
            };
        }),
        nextAction: nextActionMessage(docMap, overall),
    };
};

// Minimal version for login response
export const getKycStatusForLogin = async (userId) => {
    const overall = await repo.getKycStatus(userId);
    return {
        overallStatus: overall?.overall_status || 'not_started',
        submittedDocs: overall?.submitted_docs_count || 0,
        verifiedDocs:  overall?.verified_docs_count  || 0,
        canGoOnline:   overall?.overall_status === 'verified',
        verifiedAt:    overall?.verified_at || null,
    };
};

// ─── Admin ────────────────────────────────────────────────────────────────────

export const getReviewQueue = async (type, page, limit) =>
    repo.listReviewQueue(type, page, limit);

export const getDocumentForAdmin = async (docId) => {
    const doc = await repo.getDocForAdmin(docId);
    if (!doc) throw new NotFoundError('Document not found');
    return doc;
};

export const approveDocument = async (docId, adminId, notes) => {
    const doc = await repo.getDocById(docId);
    if (!doc) throw new NotFoundError('Document not found');
    if (!['manual_review', 'pending'].includes(doc.status)) {
        throw new ValidationError(`Document is in ${doc.status} state, cannot approve`);
    }

    const updated = await repo.adminUpdateDoc(docId, 'approved', adminId, null);
    await repo.addAuditLog({ userId: doc.user_id, docId, action: 'APPROVED',
        actorType: 'admin', actorId: adminId,
        beforeState: { status: doc.status }, afterState: { status: 'approved', notes } });

    await repo.recomputeAggregate(doc.user_id);
    return updated;
};

export const rejectDocument = async (docId, adminId, reason, allowRetry) => {
    const doc = await repo.getDocById(docId);
    if (!doc) throw new NotFoundError('Document not found');

    const updated = await repo.adminUpdateDoc(docId, 'rejected', adminId, reason);
    await repo.addAuditLog({ userId: doc.user_id, docId, action: 'REJECTED',
        actorType: 'admin', actorId: adminId,
        beforeState: { status: doc.status }, afterState: { status: 'rejected', reason } });

    // If not allowing retry, force max attempts
    if (!allowRetry) {
        await db.query('UPDATE kyc_documents SET attempt_count = 3 WHERE id = $1', [docId]);
    }

    await repo.recomputeAggregate(doc.user_id);
    return updated;
};

export const getFraudAlerts = async (severity) =>
    repo.getFraudFlags(severity);

export const suspendDriverByAdmin = async (targetUserId, adminId, reason) => {
    const updated = await repo.suspendDriver(targetUserId, reason);
    await repo.addAuditLog({ userId: targetUserId, docId: null, action: 'SUSPENDED',
        actorType: 'admin', actorId: adminId,
        beforeState: null, afterState: { reason } });
    return updated;
};
