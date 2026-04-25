import * as sosService from '../services/sosService.js';
import { sendResponse } from '../../../core/utils/response.js';

export const triggerSOS = async (req, res, next) => {
    try {
        const data = await sosService.triggerSOS(req.user.id, req.body);
        sendResponse(res, 201, '', data);
    } catch (error) { next(error); }
};

export const cancelSOS = async (req, res, next) => {
    try {
        const data = await sosService.cancelSOS(req.user.id, parseInt(req.params.alertId));
        sendResponse(res, 200, '', data);
    } catch (error) { next(error); }
};

export const getMySosHistory = async (req, res, next) => {
    try {
        const data = await sosService.getMySosHistory(req.user.id);
        sendResponse(res, 200, '', data);
    } catch (error) { next(error); }
};
