import * as referralService from '../services/referralService.js';

export const getMyCode = async (req, res, next) => {
    try {
        const data = await referralService.getMyReferralCode(req.user.id);
        res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
};

export const applyCode = async (req, res, next) => {
    try {
        const data = await referralService.applyReferralCode(req.user.id, req.body.code);
        res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
};

export const getMyReferrals = async (req, res, next) => {
    try {
        const data = await referralService.getMyReferrals(req.user.id);
        res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
};
