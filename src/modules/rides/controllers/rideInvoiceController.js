import * as invoiceService from '../services/rideInvoiceService.js';

export const getInvoice = async (req, res, next) => {
    try {
        const data = await invoiceService.getInvoice(req.user.id, parseInt(req.params.rideId));
        res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
};
