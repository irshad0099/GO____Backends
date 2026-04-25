import * as invoiceService from '../services/rideInvoiceService.js';
import { sendResponse } from '../../../core/utils/response.js';

export const getInvoice = async (req, res, next) => {
    try {
        const data = await invoiceService.getInvoice(req.user.id, parseInt(req.params.rideId));
        sendResponse(res, 200, '', data);
    } catch (error) { next(error); }
};
