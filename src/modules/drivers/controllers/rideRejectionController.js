import * as rejectionService from '../services/rideRejectionService.js';

export const rejectRide = async (req, res, next) => {
    try {
        const { rideId } = req.params;
        const { reason_code, reason_text } = req.body;
        const data = await rejectionService.rejectRide(req.user.id, parseInt(rideId), reason_code, reason_text);
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const getRejectionHistory = async (req, res, next) => {
    try {
        const { limit = 20, offset = 0 } = req.query;
        const data = await rejectionService.getRejectionHistory(req.user.id, { limit: parseInt(limit), offset: parseInt(offset) });
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const getAcceptanceStats = async (req, res, next) => {
    try {
        const { days = 7 } = req.query;
        const data = await rejectionService.getAcceptanceStats(req.user.id, parseInt(days));
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};
