import * as cashService from '../services/cashCollectionService.js';
import { sendResponse } from '../../../core/utils/response.js';

export const getCashBalance = async (req, res, next) => {
    try {
        const data = await cashService.getCashBalance(req.user.id);
        sendResponse(res, 200, '', data);
    } catch (error) {
        next(error);
    }
};

export const submitDeposit = async (req, res, next) => {
    try {
        const data = await cashService.submitDeposit(req.user.id, req.body);
        sendResponse(res, 201, 'Deposit submitted successfully', data);
    } catch (error) {
        next(error);
    }
};

export const getDepositHistory = async (req, res, next) => {
    try {
        const { limit = 20, offset = 0 } = req.query;
        const data = await cashService.getDepositHistory(req.user.id, { limit: parseInt(limit), offset: parseInt(offset) });
        sendResponse(res, 200, '', data);
    } catch (error) {
        next(error);
    }
};
