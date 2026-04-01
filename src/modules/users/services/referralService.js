import * as referralRepo from '../repositories/referral.repository.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import logger from '../../../core/logger/logger.js';
import crypto from 'crypto';

const REFERRER_BONUS = 50;
const REFERRED_BONUS = 50;
const EXPIRY_DAYS = 30;

// Generate unique 6-char alphanumeric code
const generateCode = () => {
    return crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
};

export const getMyReferralCode = async (userId) => {
    try {
        let codeRecord = await referralRepo.findCodeByUser(userId);
        if (!codeRecord) {
            const code = generateCode();
            codeRecord = await referralRepo.insertCode(userId, code);
        }
        return {
            code: codeRecord.code,
            totalReferrals: codeRecord.total_referrals,
            totalEarned: parseFloat(codeRecord.total_earned)
        };
    } catch (error) {
        logger.error('Get referral code service error:', error);
        throw error;
    }
};

export const applyReferralCode = async (userId, code) => {
    try {
        // Check if already referred
        const existing = await referralRepo.findReferralByReferred(userId);
        if (existing) {
            throw new ApiError(400, 'You have already applied a referral code');
        }

        // Find referrer
        const codeRecord = await referralRepo.findByCode(code.toUpperCase());
        if (!codeRecord) {
            throw new ApiError(404, 'Invalid referral code');
        }

        // Can't refer yourself
        if (codeRecord.user_id === userId) {
            throw new ApiError(400, 'You cannot use your own referral code');
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + EXPIRY_DAYS);

        const referral = await referralRepo.insertReferral({
            referrer_id: codeRecord.user_id,
            referred_id: userId,
            referral_code: code.toUpperCase(),
            referrer_bonus: REFERRER_BONUS,
            referred_bonus: REFERRED_BONUS,
            expires_at: expiresAt
        });

        return {
            status: referral.status,
            message: `Referral code applied! Complete your first ride to earn ₹${REFERRED_BONUS}`,
            referrerBonus: REFERRER_BONUS,
            referredBonus: REFERRED_BONUS
        };
    } catch (error) {
        logger.error('Apply referral code service error:', error);
        throw error;
    }
};

export const getMyReferrals = async (userId) => {
    try {
        const referrals = await referralRepo.findReferralsByReferrer(userId);
        return referrals.map(r => ({
            referredName: r.referred_name,
            referredPhone: r.referred_phone ? `${r.referred_phone.slice(0, 4)}****${r.referred_phone.slice(-2)}` : null,
            status: r.status,
            referrerBonus: parseFloat(r.referrer_bonus),
            completedAt: r.completed_at,
            createdAt: r.created_at
        }));
    } catch (error) {
        logger.error('Get my referrals service error:', error);
        throw error;
    }
};
