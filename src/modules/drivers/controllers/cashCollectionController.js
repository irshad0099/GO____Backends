import * as cashService from '../services/cashCollectionService.js';

export const getCashBalance = async (req, res, next) => {
    try {
        const data = await cashService.getCashBalance(req.user.id);
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const submitDeposit = async (req, res, next) => {
    try {
        const data = await cashService.submitDeposit(req.user.id, req.body);
        res.status(201).json({ success: true, message: 'Deposit submitted successfully', data });
    } catch (error) {
        next(error);
    }
};

export const getDepositHistory = async (req, res, next) => {
    try {
        const { limit = 20, offset = 0 } = req.query;
        const data = await cashService.getDepositHistory(req.user.id, { limit: parseInt(limit), offset: parseInt(offset) });
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};
