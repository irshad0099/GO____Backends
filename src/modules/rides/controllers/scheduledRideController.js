import * as schedService from '../services/scheduledRideService.js';
import { sendResponse } from '../../../core/utils/response.js';

export const scheduleRide = async (req, res, next) => {
    try {
        const data = await schedService.scheduleRide(req.user.id, req.body);
        sendResponse(res, 201, '', data);
    } catch (error) { next(error); }
};

export const getMyScheduled = async (req, res, next) => {
    try {
        const data = await schedService.getMyScheduledRides(req.user.id, req.query.status);
        sendResponse(res, 200, '', data);
    } catch (error) { next(error); }
};

export const cancelScheduled = async (req, res, next) => {
    try {
        const data = await schedService.cancelScheduledRide(req.user.id, parseInt(req.params.id), req.body.reason);
        sendResponse(res, 200, '', data);
    } catch (error) { next(error); }
};
