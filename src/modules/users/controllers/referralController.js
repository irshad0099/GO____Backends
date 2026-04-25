import * as referralService from '../services/referralService.js';
import { sendResponse } from '../../../core/utils/response.js';

export const getMyCode = async (req, res, next) => {
    try {
        const data = await referralService.getMyReferralCode(req.user.id);
        sendResponse(res, 200, '', data);
    } catch (error) { next(error); }
};

export const applyCode = async (req, res, next) => {
    try {
        const data = await referralService.applyReferralCode(req.user.id, req.body.code);
        sendResponse(res, 200, '', data);
    } catch (error) { next(error); }
};

export const getMyReferrals = async (req, res, next) => {
    try {
        const data = await referralService.getMyReferrals(req.user.id);
        sendResponse(res, 200, '', data);
    } catch (error) { next(error); }
};
