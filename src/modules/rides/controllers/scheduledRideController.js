import * as schedService from '../services/scheduledRideService.js';

export const scheduleRide = async (req, res, next) => {
    try {
        const data = await schedService.scheduleRide(req.user.id, req.body);
        res.status(201).json({ success: true, data });
    } catch (error) { next(error); }
};

export const getMyScheduled = async (req, res, next) => {
    try {
        const data = await schedService.getMyScheduledRides(req.user.id, req.query.status);
        res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
};

export const cancelScheduled = async (req, res, next) => {
    try {
        const data = await schedService.cancelScheduledRide(req.user.id, parseInt(req.params.id), req.body.reason);
        res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
};
