import * as cashRepo from '../repositories/cashCollection.repository.js';
import * as driverRepo from '../repositories/driver.repository.js';
import { NotFoundError, ApiError } from '../../../core/errors/ApiError.js';
import logger from '../../../core/logger/logger.js';

// ─── Get cash balance ───────────────────────────────────────────────────────
export const getCashBalance = async (userId) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);
        if (!driver) throw new NotFoundError('Driver profile');

        let balance = await cashRepo.findCashBalance(driver.id);
        if (!balance) {
            balance = await cashRepo.initCashBalance(driver.id);
        }

        return {
            pendingAmount: parseFloat(balance.pending_amount),
            totalCashCollected: parseFloat(balance.total_cash_collected),
            totalDeposited: parseFloat(balance.total_deposited),
            totalPlatformShare: parseFloat(balance.total_platform_share),
            depositDueDate: balance.deposit_due_date,
            isLimitExceeded: balance.is_limit_exceeded,
            cashLimit: parseFloat(balance.cash_limit)
        };
    } catch (error) {
        logger.error('Get cash balance service error:', error);
        throw error;
    }
};

// ─── Submit cash deposit ────────────────────────────────────────────────────
export const submitDeposit = async (userId, depositData) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);
        if (!driver) throw new NotFoundError('Driver profile');

        const balance = await cashRepo.findCashBalance(driver.id);
        if (!balance || parseFloat(balance.pending_amount) <= 0) {
            throw new ApiError(400, 'No pending cash balance to deposit');
        }

        if (depositData.amount > parseFloat(balance.pending_amount)) {
            throw new ApiError(400, `Deposit amount cannot exceed pending amount (₹${balance.pending_amount})`);
        }

        const deposit = await cashRepo.insertDeposit({
            driver_id: driver.id,
            amount: depositData.amount,
            deposit_method: depositData.deposit_method,
            reference_number: depositData.reference_number,
            deposit_proof: depositData.deposit_proof
        });

        return {
            depositId: deposit.id,
            amount: parseFloat(deposit.amount),
            depositMethod: deposit.deposit_method,
            status: deposit.status,
            referenceNumber: deposit.reference_number,
            message: 'Deposit submitted. Pending verification.'
        };
    } catch (error) {
        logger.error('Submit deposit service error:', error);
        throw error;
    }
};

// ─── Deposit history ────────────────────────────────────────────────────────
export const getDepositHistory = async (userId, { limit = 20, offset = 0 }) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);
        if (!driver) throw new NotFoundError('Driver profile');

        const deposits = await cashRepo.findDeposits(driver.id, { limit, offset });

        return deposits.map(d => ({
            id: d.id,
            amount: parseFloat(d.amount),
            depositMethod: d.deposit_method,
            referenceNumber: d.reference_number,
            status: d.status,
            verifiedAt: d.verified_at,
            rejectionReason: d.rejection_reason,
            createdAt: d.created_at
        }));
    } catch (error) {
        logger.error('Get deposit history service error:', error);
        throw error;
    }
};
