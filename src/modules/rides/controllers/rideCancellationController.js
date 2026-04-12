import * as cancelService from '../services/rideCancellationService.js';
import { getIO } from '../../../config/websocketConfig.js';
import logger from '../../../core/logger/logger.js';

export const cancelRide = async (req, res, next) => {
    try {
        const rideId = parseInt(req.params.rideId);
        const data = await cancelService.cancelRide(req.user.id, rideId, req.body);

        try {
            const io = getIO();
            io.to(`ride:${rideId}`).emit('ride:status_changed', {
                rideId,
                status:      'cancelled',
                cancelledBy: req.user.role,
                reason:      req.body?.reason || 'Cancelled',
                timestamp:   new Date().toISOString()
            });
        } catch (sockErr) {
            logger.warn(`Socket emit failed (ride:cancelled): ${sockErr.message}`);
        }

        res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
};
