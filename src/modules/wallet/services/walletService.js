import { pool } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';
import {
    findWalletByUserId,
    createWallet,
    creditWallet,
    debitWallet,
    createTransaction,
    updateTransactionStatus,
    getTransactionByNumber,
    getTransactionByRideId,
    getRefundByRideId,
    getWalletTransactions,
    getTransactionCount,
} from '../repositories/wallet.repository.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_WALLET_BALANCE = 100000; // ₹1,00,000 — RBI guideline for semi-closed wallets

// ─── Helpers ──────────────────────────────────────────────────────────────────

// TXN + timestamp + 4 random chars  e.g. TXN1716123456789AB3K
const generateTxnNumber = () => {
    const ts   = Date.now().toString();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `TXN${ts}${rand}`;
};

const formatWallet = (w) => ({
    walletId:          w.id,
    userId:            w.user_id,
    balance:           parseFloat(w.balance),
    totalCredited:     parseFloat(w.total_credited),
    totalDebited:      parseFloat(w.total_debited),
    lastTransactionAt: w.last_transaction_at,
    createdAt:         w.created_at,
    updatedAt:         w.updated_at,
});

const formatTransaction = (t) => ({
    transactionNumber:   t.transaction_number,
    amount:              parseFloat(t.amount),
    type:                t.type,
    category:            t.category,
    paymentMethod:       t.payment_method,
    paymentGateway:      t.payment_gateway   || null,
    gatewayTransactionId: t.gateway_transaction_id || null,
    status:              t.status,
    description:         t.description       || null,
    rideId:              t.ride_id           || null,
    metadata:            t.metadata          || {},
    createdAt:           t.created_at,
});

// ─────────────────────────────────────────────────────────────────────────────
//  1. Get or auto-create wallet
// ─────────────────────────────────────────────────────────────────────────────

export const getOrCreateWallet = async (userId) => {
    let wallet = await findWalletByUserId(userId);
    if (!wallet) {
        wallet = await createWallet(userId);
        logger.info(`[Wallet] Created new wallet for user ${userId}`);
    }
    return wallet;
};

// ─────────────────────────────────────────────────────────────────────────────
//  2. Get wallet details
// ─────────────────────────────────────────────────────────────────────────────

export const getWalletDetails = async (userId) => {
    const wallet = await getOrCreateWallet(userId);
    return {
        success: true,
        data: formatWallet(wallet),
    };
};

// ─────────────────────────────────────────────────────────────────────────────
//  3. Get balance only (lightweight — called before ride booking)
// ─────────────────────────────────────────────────────────────────────────────

export const getWalletBalance = async (userId) => {
    const wallet = await getOrCreateWallet(userId);
    return {
        success: true,
        data: { balance: parseFloat(wallet.balance) },
    };
};

// ─────────────────────────────────────────────────────────────────────────────
//  4. Recharge wallet  (category: 'wallet_recharge')
//     Called AFTER payment gateway confirms payment via webhook
// ─────────────────────────────────────────────────────────────────────────────

export const rechargeWallet = async (userId, {
    amount,
    payment_method,
    payment_gateway,
    gateway_transaction_id,
    description,
}) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const wallet = await getOrCreateWallet(userId);

        // RBI: Max wallet balance check
        if (parseFloat(wallet.balance) + amount > MAX_WALLET_BALANCE) {
            const err = new Error(
                `Wallet balance cannot exceed ₹${MAX_WALLET_BALANCE.toLocaleString('en-IN')}. Current: ₹${wallet.balance}`
            );
            err.statusCode = 400;
            throw err;
        }

        const updatedWallet = await creditWallet(client, userId, amount);

        const txn = await createTransaction(client, {
            transactionNumber:   generateTxnNumber(),
            userId,
            walletId:            wallet.id,
            rideId:              null,
            amount,
            type:                'credit',
            category:            'wallet_recharge',
            paymentMethod:       payment_method,
            paymentGateway:      payment_gateway      || null,
            gatewayTransactionId: gateway_transaction_id || null,
            status:              'success',
            description:         description || `Wallet recharged via ${payment_method.toUpperCase()}`,
            metadata:            { payment_gateway, gateway_transaction_id },
        });

        await client.query('COMMIT');

        logger.info(`[Wallet] Recharge ₹${amount} | User: ${userId} | TXN: ${txn.transaction_number}`);

        return {
            success: true,
            message: `₹${amount} added to wallet`,
            data: {
                transaction: formatTransaction(txn),
                newBalance:  parseFloat(updatedWallet.balance),
            },
        };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`[Wallet] rechargeWallet error | User: ${userId}:`, error);
        throw error;
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  5. Pay for ride  (category: 'ride_payment')
//     Called by ride-service when ride completes
// ─────────────────────────────────────────────────────────────────────────────

export const payForRide = async (userId, { ride_id, amount, description }) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Idempotency — don't double charge the same ride
        const existing = await getTransactionByRideId(ride_id, 'debit');
        if (existing) {
            await client.query('ROLLBACK');
            logger.warn(`[Wallet] Duplicate ride payment blocked | Ride: ${ride_id}`);
            return {
                success:    true,
                message:    'Ride already paid',
                data:       { transaction: formatTransaction(existing), alreadyPaid: true },
            };
        }

        const wallet        = await getOrCreateWallet(userId);
        const updatedWallet = await debitWallet(client, userId, amount); // throws if insufficient

        const txn = await createTransaction(client, {
            transactionNumber: generateTxnNumber(),
            userId,
            walletId:          wallet.id,
            rideId:            ride_id,
            amount,
            type:              'debit',
            category:          'ride_payment',
            paymentMethod:     'wallet',
            status:            'success',
            description:       description || `Payment for ride #${ride_id}`,
            metadata:          { ride_id },
        });

        await client.query('COMMIT');

        logger.info(`[Wallet] Ride payment ₹${amount} | User: ${userId} | Ride: ${ride_id} | TXN: ${txn.transaction_number}`);

        return {
            success: true,
            message: 'Ride payment successful',
            data: {
                transaction: formatTransaction(txn),
                newBalance:  parseFloat(updatedWallet.balance),
            },
        };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`[Wallet] payForRide error | User: ${userId} | Ride: ${ride_id}:`, error);

        if (error.message === 'Insufficient balance') {
            const err = new Error('Insufficient wallet balance to pay for this ride');
            err.statusCode = 400;
            throw err;
        }
        throw error;
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  6. Refund to wallet  (category: 'ride_refund')
//     Called on ride cancellation / driver no-show / overcharge
// ─────────────────────────────────────────────────────────────────────────────

export const processRideRefund = async (userId, { ride_id, amount, reason }) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Idempotency — don't double refund
        const existingRefund = await getRefundByRideId(ride_id);
        if (existingRefund) {
            await client.query('ROLLBACK');
            logger.warn(`[Wallet] Duplicate refund blocked | Ride: ${ride_id}`);
            return {
                success: true,
                message: 'Refund already processed',
                data:    { transaction: formatTransaction(existingRefund), alreadyRefunded: true },
            };
        }

        // Validate: original payment must exist
        const originalPayment = await getTransactionByRideId(ride_id, 'debit');
        if (!originalPayment) {
            const err = new Error('No ride payment found for this ride ID');
            err.statusCode = 404;
            throw err;
        }

        // Refund cannot exceed original amount
        if (amount > parseFloat(originalPayment.amount)) {
            const err = new Error(
                `Refund amount ₹${amount} exceeds original payment ₹${originalPayment.amount}`
            );
            err.statusCode = 400;
            throw err;
        }

        const wallet        = await getOrCreateWallet(userId);
        const updatedWallet = await creditWallet(client, userId, amount);

        const txn = await createTransaction(client, {
            transactionNumber: generateTxnNumber(),
            userId,
            walletId:          wallet.id,
            rideId:            ride_id,
            amount,
            type:              'credit',
            category:          'ride_refund',
            paymentMethod:     'wallet',
            status:            'success',
            description:       reason || `Refund for ride #${ride_id}`,
            metadata:          {
                ride_id,
                reason,
                originalTxn: originalPayment.transaction_number,
            },
        });

        await client.query('COMMIT');

        logger.info(`[Wallet] Refund ₹${amount} | User: ${userId} | Ride: ${ride_id} | TXN: ${txn.transaction_number}`);

        return {
            success: true,
            message: `₹${amount} refunded to wallet`,
            data: {
                transaction: formatTransaction(txn),
                newBalance:  parseFloat(updatedWallet.balance),
            },
        };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`[Wallet] processRideRefund error | User: ${userId} | Ride: ${ride_id}:`, error);
        throw error;
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  7. Cancellation fee  (category: 'cancellation_fee')
//     Charged when rider cancels after driver arrives
// ─────────────────────────────────────────────────────────────────────────────

export const chargeCancellationFee = async (userId, { ride_id, amount, description }) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const wallet        = await getOrCreateWallet(userId);
        const updatedWallet = await debitWallet(client, userId, amount);

        const txn = await createTransaction(client, {
            transactionNumber: generateTxnNumber(),
            userId,
            walletId:          wallet.id,
            rideId:            ride_id,
            amount,
            type:              'debit',
            category:          'cancellation_fee',
            paymentMethod:     'wallet',
            status:            'success',
            description:       description || `Cancellation fee for ride #${ride_id}`,
            metadata:          { ride_id },
        });

        await client.query('COMMIT');

        logger.info(`[Wallet] Cancellation fee ₹${amount} | User: ${userId} | Ride: ${ride_id}`);

        return {
            success: true,
            message: `Cancellation fee of ₹${amount} charged`,
            data: {
                transaction: formatTransaction(txn),
                newBalance:  parseFloat(updatedWallet.balance),
            },
        };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`[Wallet] chargeCancellationFee error:`, error);
        if (error.message === 'Insufficient balance') {
            const err = new Error('Insufficient wallet balance for cancellation fee');
            err.statusCode = 400;
            throw err;
        }
        throw error;
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  8. Referral bonus  (category: 'referral_bonus')
//     Credited when referred user completes first ride
// ─────────────────────────────────────────────────────────────────────────────

export const creditReferralBonus = async (userId, { amount, description }) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const wallet        = await getOrCreateWallet(userId);
        const updatedWallet = await creditWallet(client, userId, amount);

        const txn = await createTransaction(client, {
            transactionNumber: generateTxnNumber(),
            userId,
            walletId:          wallet.id,
            rideId:            null,
            amount,
            type:              'credit',
            category:          'referral_bonus',
            paymentMethod:     'wallet',
            status:            'success',
            description:       description || `Referral bonus credited`,
            metadata:          {},
        });

        await client.query('COMMIT');

        logger.info(`[Wallet] Referral bonus ₹${amount} | User: ${userId}`);

        return {
            success: true,
            message: `₹${amount} referral bonus added to wallet`,
            data: {
                transaction: formatTransaction(txn),
                newBalance:  parseFloat(updatedWallet.balance),
            },
        };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`[Wallet] creditReferralBonus error:`, error);
        throw error;
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  9. Withdrawal  (category: 'withdrawal')
//     Rider withdraws wallet balance to bank account
// ─────────────────────────────────────────────────────────────────────────────

export const withdrawFromWallet = async (userId, { amount, bank_account_number, ifsc_code, description }) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const wallet        = await getOrCreateWallet(userId);
        const updatedWallet = await debitWallet(client, userId, amount);

        const txn = await createTransaction(client, {
            transactionNumber: generateTxnNumber(),
            userId,
            walletId:          wallet.id,
            rideId:            null,
            amount,
            type:              'debit',
            category:          'withdrawal',
            paymentMethod:     'wallet',
            status:            'pending',   // pending until bank transfer confirms
            description:       description || `Withdrawal to bank account`,
            metadata:          {
                bank_account_number: `****${bank_account_number.slice(-4)}`,  // mask for logs
                ifsc_code,
            },
        });

        await client.query('COMMIT');

        logger.info(`[Wallet] Withdrawal ₹${amount} | User: ${userId} | TXN: ${txn.transaction_number}`);

        // TODO: Call your bank payout API here and update status to 'success' or 'failed'
        //       await bankPayoutService.initiate({ txnNumber: txn.transaction_number, ... })

        return {
            success: true,
            message: `Withdrawal of ₹${amount} initiated`,
            data: {
                transaction: formatTransaction(txn),
                newBalance:  parseFloat(updatedWallet.balance),
                note:        'Bank transfer will be processed within 1-2 business days',
            },
        };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`[Wallet] withdrawFromWallet error | User: ${userId}:`, error);
        if (error.message === 'Insufficient balance') {
            const err = new Error('Insufficient wallet balance for withdrawal');
            err.statusCode = 400;
            throw err;
        }
        throw error;
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  10. Transaction history (paginated + filtered)
// ─────────────────────────────────────────────────────────────────────────────

export const getTransactionHistory = async (userId, filters) => {
    await getOrCreateWallet(userId); // ensure wallet exists

    const [transactions, total] = await Promise.all([
        getWalletTransactions(userId, filters),
        getTransactionCount(userId, filters),
    ]);

    return {
        success: true,
        data: {
            transactions: transactions.map(formatTransaction),
            pagination: {
                total,
                limit:   filters.limit,
                offset:  filters.offset,
                hasMore: filters.offset + filters.limit < total,
            },
        },
    };
};

// ─────────────────────────────────────────────────────────────────────────────
//  11. Single transaction detail
// ─────────────────────────────────────────────────────────────────────────────

export const getTransactionDetail = async (userId, transactionNumber) => {
    const txn = await getTransactionByNumber(transactionNumber, userId);
    if (!txn) {
        const err = new Error('Transaction not found');
        err.statusCode = 404;
        throw err;
    }
    return { success: true, data: formatTransaction(txn) };
};
