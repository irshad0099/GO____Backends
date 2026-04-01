import * as cancelService from '../services/rideCancellationService.js';

export const cancelRide = async (req, res, next) => {
    try {
        const data = await cancelService.cancelRide(req.user.id, parseInt(req.params.rideId), req.body);
        res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
};
