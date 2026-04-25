import * as incentiveService from '../services/incentiveService.js';
import { sendResponse } from '../../../core/utils/response.js';

export const getActiveIncentives = async (req, res, next) => {
    try {
        const data = await incentiveService.getActiveIncentives(req.user.id);
        sendResponse(res, 200, '', data);
    } catch (error) {
        next(error);
    }
};

export const getIncentiveProgress = async (req, res, next) => {
    try {
        const data = await incentiveService.getIncentiveProgress(req.user.id);
        sendResponse(res, 200, '', data);
    } catch (error) {
        next(error);
    }
};
