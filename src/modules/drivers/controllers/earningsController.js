import * as earningsService from '../services/earningsService.js';
import { sendResponse } from '../../../core/utils/response.js';

export const getWeeklyEarnings = async (req, res, next) => {
    try {
        const { limit = 10, offset = 0 } = req.query;
        const data = await earningsService.getWeeklyEarnings(req.user.id, { limit: parseInt(limit), offset: parseInt(offset) });
        sendResponse(res, 200, '', data);
    } catch (error) {
        next(error);
    }
};

export const getMonthlyEarnings = async (req, res, next) => {
    try {
        const { limit = 12, offset = 0 } = req.query;
        const data = await earningsService.getMonthlyEarnings(req.user.id, { limit: parseInt(limit), offset: parseInt(offset) });
        sendResponse(res, 200, '', data);
    } catch (error) {
        next(error);
    }
};

export const getCurrentWeekEarnings = async (req, res, next) => {
    try {
        const data = await earningsService.getCurrentWeekEarnings(req.user.id);
        sendResponse(res, 200, '', data);
    } catch (error) {
        next(error);
    }
};

export const getEarningsStatement = async (req, res, next) => {
    try {
        const { from, to } = req.query;
        const data = await earningsService.getEarningsStatement(req.user.id, from, to);
        sendResponse(res, 200, '', data);
    } catch (error) {
        next(error);
    }
};
