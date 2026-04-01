import * as docService from '../services/documentExpiryService.js';

export const getDocumentStatus = async (req, res, next) => {
    try {
        const data = await docService.getDocumentStatus(req.user.id);
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};
