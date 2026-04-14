import * as docService from '../services/documentExpiryService.js';
import { sendResponse } from '../../../core/utils/response.js';

export const getDocumentStatus = async (req, res, next) => {
    try {
        const data = await docService.getDocumentStatus(req.user.id);
        sendResponse(res, 200, '', data);
    } catch (error) {
        next(error);
    }
};
