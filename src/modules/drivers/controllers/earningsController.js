import * as earningsService from '../services/earningsService.js';

export const getWeeklyEarnings = async (req, res, next) => {
    try {
        const { limit = 10, offset = 0 } = req.query;
        const data = await earningsService.getWeeklyEarnings(req.user.id, { limit: parseInt(limit), offset: parseInt(offset) });
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const getMonthlyEarnings = async (req, res, next) => {
    try {
        const { limit = 12, offset = 0 } = req.query;
        const data = await earningsService.getMonthlyEarnings(req.user.id, { limit: parseInt(limit), offset: parseInt(offset) });
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const getCurrentWeekEarnings = async (req, res, next) => {
    try {
        const data = await earningsService.getCurrentWeekEarnings(req.user.id);
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const getEarningsStatement = async (req, res, next) => {
    try {
        const { from, to } = req.query;
        const data = await earningsService.getEarningsStatement(req.user.id, from, to);
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};
