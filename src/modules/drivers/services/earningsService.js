import * as earningsRepo from '../repositoriess.repository.js';
import * as driverRepo from '../repositories/driver.repository.js';
import * as cashRepo from '../repositories/cashCollection.repository.js';
import { creditWallet } from '../../wallet/repositories/wallet.repository.js';
import { createCompanyEarning } from '../../payments/repositories/payment.Repository.js';
import { pool } from '../../../infrastructure/database/postgres.js';
import { NotFoundError } from '../../../core/errors/ApiError.js';
import logger from '../../../core/logger/logger.js';

// ─── Weekly earnings list ───────────────────────────────────────────────────
export const getWeeklyEarnings = async (userId, { limit = 10, offset = 0 }) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);
        if (!driver) throw new NotFoundError('Driver profile');

        const weeks = await earningsRepo.findWeeklyEarnings(driver.id, { limit, offset });

        return weeks.map(w => ({
            weekStart:          w.week_start,
            weekEnd:            w.week_end,
            completedRides:     parseInt(w.completed_rides),
            rideEarnings:       parseFloat(w.ride_earnings),
            tipEarnings:        parseFloat(w.tip_earnings),
            incentiveEarnings:  parseFloat(w.incentive_earnings),
            referralEarnings:   parseFloat(w.referral_earnings),
            cashCollected:      parseFloat(w.cash_collected),
            platformFeePaid:    parseFloat(w.platform_fee_paid || 0),
            totalDeductions:    parseFloat(w.total_deductions),
            netEarnings:        parseFloat(w.net_earnings),
            totalOnlineHours:   parseInt(w.total_online_hours || 0),
        }));
    } catch (error) {
        logger.error('Get weekly earnings service error:', error);
        throw error;
    }
};

// ─── Monthly earnings list ──────────────────────────────────────────────────
export const getMonthlyEarnings = async (userId, { limit = 12, offset = 0 }) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);
        if (!driver) throw new NotFoundError('Driver profile');

        const months = await earningsRepo.findMonthlyEarnings(driver.id, { limit, offset });

        return months.map(m => ({
            month:              parseInt(m.month),
            year:               parseInt(m.year),
            completedRides:     parseInt(m.completed_rides),
            rideEarnings:       parseFloat(m.ride_earnings),
            tipEarnings:        parseFloat(m.tip_earnings),
            incentiveEarnings:  parseFloat(m.incentive_earnings),
            referralEarnings:   parseFloat(m.referral_earnings),
            cashCollected:      parseFloat(m.cash_collected),
            platformFeePaid:    parseFloat(m.platform_fee_paid || 0),
            totalDeductions:    parseFloat(m.total_deductions),
            netEarnings:        parseFloat(m.net_earnings),
            totalOnlineHours:   parseInt(m.total_online_hours || 0),
        }));
    } catch (error) {
        logger.error('Get monthly earnings service error:', error);
        throw error;
    }
};

// ─── Current week live ──────────────────────────────────────────────────────
export const getCurrentWeekEarnings = async (userId) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);
        if (!driver) throw new NotFoundError('Driver profile');

        const w = await earningsRepo.findCurrentWeekEarnings(driver.id);
        return {
            weekStart:          w.week_start,
            weekEnd:            w.week_end,
            completedRides:     parseInt(w.completed_rides),
            rideEarnings:       parseFloat(w.ride_earnings),
            tipEarnings:        parseFloat(w.tip_earnings),
            incentiveEarnings:  parseFloat(w.incentive_earnings),
            platformFeePaid:    parseFloat(w.platform_fee_paid || 0),
            totalDeductions:    parseFloat(w.total_deductions),
            netEarnings:        parseFloat(w.net_earnings),
            totalOnlineHours:   parseInt(w.total_online_hours || 0),
        };
    } catch (error) {
        logger.error('Get current week earnings service error:', error);
        throw error;
    }
};

// ─── Earnings statement (date range) ────────────────────────────────────────
export const getEarningsStatement = async (userId, fromDate, toDate) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);
        if (!driver) throw new NotFoundError('Driver profile');

        return await earningsRepo.findEarningsByDateRange(driver.id, fromDate, toDate);
    } catch (error) {
        logger.error('Get earnings statement service error:', error);
        throw error;
    }
};

// ─── Transaction history (ledger entries) ────────────────────────────────────
export const getLedgerHistory = async (userId, { limit = 20, offset = 0 }) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);
        if (!driver) throw new NotFoundError('Driver profile');

        const entries = await earningsRepo.findLedgerHistory(driver.id, { limit, offset });
        return entries.map(e => ({
            id:            e.id,
            type:          e.type,
            amount:        parseFloat(e.amount),
            rideId:        e.ride_id,
            referenceId:   e.reference_id,
            paymentMethod: e.payment_method,
            note:          e.note,
            createdAt:     e.created_at,
        }));
    } catch (error) {
        logger.error('Get ledger history service error:', error);
        throw error;
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  Credit driver earnings after ride payment (wallet/card/upi/cash/corporate)
//  Idempotent — safe to call multiple times for same ride
// ─────────────────────────────────────────────────────────────────────────────
export const creditDriverEarnings = async ({
    driverUserId,
    rideId,
    netEarnings,
    tipAmount = 0,
    durationMinutes = 0,
    platformFee,
    paymentMethod,
    collectionMethodActual = null,
}) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const driver = await driverRepo.findDriverByUserId(driverUserId);
        if (!driver) throw new NotFoundError('Driver profile');

        // Idempotency check — already credited for this ride?
        const existingCredit = await client.query(
            `SELECT * FROM driver_ledger WHERE driver_id = $1 AND ride_id = $2 AND type = 'ride_earning'`,
            [driver.id, rideId]
        );
        if (existingCredit.rows.length > 0) {
            await client.query('ROLLBACK');
            logger.warn(`[Earnings] Duplicate credit blocked | Driver: ${driver.id} | Ride: ${rideId}`);
            return {
                success: true,
                message: 'Earnings already credited for this ride',
                alreadyCredited: true,
                data: existingCredit.rows[0],
            };
        }

        // ── Auto-deduction: pending cash dues hain toh online earning se kat lo ──
        let autoDeductedAmount = 0;
        const cashBalance = await cashRepo.findCashBalance(driver.id);
        const pendingCashDues = parseFloat(cashBalance?.pending_amount ?? 0);
        const heldNetEarnings = parseFloat(cashBalance?.pending_net_earnings ?? 0);

        if (pendingCashDues > 0 && paymentMethod !== 'cash' && paymentMethod !== 'personal_upi') {
            autoDeductedAmount = Math.min(pendingCashDues, netEarnings);
            netEarnings = netEarnings - autoDeductedAmount;

            await cashRepo.deductFromPending(client, driver.id, autoDeductedAmount);

            await cashRepo.insertDeposit({
                driver_id:        driver.id,
                amount:           autoDeductedAmount,
                deposit_method:   'auto_deduct',
                reference_number: `AUTO-${rideId}-${Date.now()}`,
                deposit_proof:    null,
            });

            // Ledger: auto-deduction entry
            await earningsRepo.insertLedgerEntry(client, {
                driver_id:       driver.id,
                type:            'auto_deduct',
                amount:          -autoDeductedAmount,
                duration_minutes: durationMinutes,
                ride_id:         rideId,
                payment_method:  paymentMethod,
                note:            `Auto-deducted cash dues for ride #${rideId}`,
            });

            // Mark previous held cash ride earnings as 'completed' (due settled)
            await client.query(
                `UPDATE driver_ledger
                 SET status = 'completed'
                 WHERE driver_id = $1 AND type = 'ride_earning' AND status = 'held'
                 AND created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'`,
                [driver.id]
            );

            // Pending net earnings from cash rides — release to wallet
            if (heldNetEarnings > 0) {
                await cashRepo.releaseNetEarnings(client, driver.id);
                await creditWallet(client, driverUserId, heldNetEarnings);
                await driverRepo.incrementTotalEarnings(client, driver.id, heldNetEarnings);

                logger.info(`[Earnings] Cash held earnings released | Driver: ${driver.id} | Amount: ₹${heldNetEarnings}`);
            }

            logger.info(`[Earnings] Auto-deducted cash dues | Driver: ${driver.id} | Deducted: ₹${autoDeductedAmount}`);
        }

        // Credit driver wallet
        const updatedWallet = await creditWallet(client, driverUserId, netEarnings);

        // Ledger: main ride earning
        const ledgerEntry = await earningsRepo.insertLedgerEntry(client, {
            driver_id:       driver.id,
            type:            'ride_earning',
            amount:          netEarnings,
            duration_minutes: durationMinutes,
            ride_id:         rideId,
            payment_method:  paymentMethod,
            note:            collectionMethodActual ? `Collection: ${collectionMethodActual}` : null,
        });

        // Ledger: platform fee (tracking-only — wallet/balance pe asar nahi,
        // ride_earning already net amount hai). Positive amount = driver ne kitni fee pay ki.
        if (platformFee > 0) {
            await earningsRepo.insertLedgerEntry(client, {
                driver_id:      driver.id,
                type:           'platform_fee',
                amount:         platformFee,
                ride_id:        rideId,
                payment_method: paymentMethod,
                note:           `Platform fee for ride #${rideId}`,
            });
        }

        // ── Transaction table entry (user-facing) ────────────────────────────────
        const transactionNumber = `RIDE-${rideId}-${Date.now()}`;
        try {
            const walletRecord = await client.query(
                `SELECT id FROM wallets WHERE user_id = $1`,
                [driverUserId]
            );
            const walletId = walletRecord.rows[0]?.id;

            await client.query(
                `INSERT INTO transactions (
                    transaction_number, user_id, wallet_id, ride_id,
                    amount, type, category,
                    payment_method, status, description,
                    created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [
                    transactionNumber,
                    driverUserId,
                    walletId,
                    rideId,
                    netEarnings,
                    'credit',
                    'ride_earning',
                    paymentMethod || 'wallet',
                    'success',
                    `Ride earnings for ride #${rideId}`
                ]
            );
        } catch (txnErr) {
            logger.warn(`[Earnings] Transaction table entry failed (non-fatal) | Ride: ${rideId}: ${txnErr.message}`);
        }

        // Ledger: tip (if any)
        if (tipAmount > 0) {
            await earningsRepo.insertLedgerEntry(client, {
                driver_id:       driver.id,
                type:            'tip',
                amount:          tipAmount,
                duration_minutes: durationMinutes,
                ride_id:         rideId,
                payment_method:  paymentMethod,
            });

            // Transaction entry for tip
            try {
                const walletRecord = await client.query(
                    `SELECT id FROM wallets WHERE user_id = $1`,
                    [driverUserId]
                );
                const walletId = walletRecord.rows[0]?.id;

                await client.query(
                    `INSERT INTO transactions (
                        transaction_number, user_id, wallet_id, ride_id,
                        amount, type, category,
                        payment_method, status, description,
                        created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                    [
                        `TIP-${rideId}-${Date.now()}`,
                        driverUserId,
                        walletId,
                        rideId,
                        tipAmount,
                        'credit',
                        'tip',
                        paymentMethod || 'wallet',
                        'success',
                        `Tip for ride #${rideId}`
                    ]
                );
            } catch (txnErr) {
                logger.warn(`[Earnings] Tip transaction entry failed (non-fatal) | Ride: ${rideId}: ${txnErr.message}`);
            }
        }

        // For cash rides — add platform fee to driver's cash_balance (driver owes platform)
        if (paymentMethod === 'cash') {
            await client.query(
                `UPDATE drivers
                 SET cash_balance = COALESCE(cash_balance, 0) + $1,
                     total_earnings = COALESCE(total_earnings, 0) + $2,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $3`,
                [platformFee, netEarnings, driver.id]
            );
        } else {
            await client.query(
                `UPDATE drivers
                 SET total_earnings = COALESCE(total_earnings, 0) + $1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2`,
                [netEarnings, driver.id]
            );
        }

        // Company earnings track karo — har payment method pe
        const rideData = await client.query(
            `SELECT passenger_id FROM rides WHERE id = $1`,
            [rideId]
        );
        await createCompanyEarning(client, {
            rideId,
            driverId:      driver.id,
            passengerId:   rideData.rows[0]?.passenger_id || null,
            paymentMethod,
            grossFare:     netEarnings + platformFee,
            platformFee,
            gstOnFee:      0,
            netToDriver:   netEarnings,
        }).catch(e => logger.warn(`[Earnings] Company earning record failed ride=${rideId}: ${e.message}`));

        await client.query('COMMIT');

        logger.info(`[Earnings] Driver credited | Driver: ${driver.id} | Ride: ${rideId} | Net: ₹${netEarnings} | Method: ${paymentMethod}`);

        return {
            success: true,
            message: 'Driver earnings credited successfully',
            data: {
                ledgerEntry,
                walletBalance:  parseFloat(updatedWallet.balance),
                netEarnings,
                tipAmount,
                platformFee,
                paymentMethod,
                ...(autoDeductedAmount > 0 && {
                    autoDeducted:     autoDeductedAmount,
                    cashHeldReleased: heldNetEarnings,
                }),
            },
        };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`[Earnings] creditDriverEarnings error | Driver: ${driverUserId} | Ride: ${rideId}:`, error);
        throw error;
    } finally {
        client.release();
    }
};
