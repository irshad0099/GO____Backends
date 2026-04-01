import * as docRepo from '../repositories/documentExpiry.repository.js';
import * as driverRepo from '../repositories/driver.repository.js';
import { NotFoundError } from '../../../core/errors/ApiError.js';
import logger from '../../../core/logger/logger.js';

// ─── Get all document statuses ──────────────────────────────────────────────
export const getDocumentStatus = async (userId) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);
        if (!driver) throw new NotFoundError('Driver profile');

        const docs = await docRepo.findAllByDriver(driver.id);

        // Agar koi document entry nahi hai to sab "not_uploaded" dikhao
        const allDocTypes = ['license', 'insurance', 'permit', 'rc', 'aadhaar', 'pan'];
        const docMap = {};
        docs.forEach(d => { docMap[d.document_type] = d; });

        return allDocTypes.map(type => {
            const doc = docMap[type];
            if (!doc) {
                return {
                    documentType: type,
                    status: 'not_uploaded',
                    documentNumber: null,
                    expiryDate: null,
                    daysUntilExpiry: null
                };
            }

            let daysUntilExpiry = null;
            if (doc.expiry_date) {
                const diff = new Date(doc.expiry_date) - new Date();
                daysUntilExpiry = Math.ceil(diff / (1000 * 60 * 60 * 24));
            }

            return {
                documentType: doc.document_type,
                status: doc.status,
                documentNumber: doc.document_number,
                expiryDate: doc.expiry_date,
                daysUntilExpiry,
                lastVerifiedAt: doc.last_verified_at,
                expiryNotified: doc.expiry_notified
            };
        });
    } catch (error) {
        logger.error('Get document status service error:', error);
        throw error;
    }
};
