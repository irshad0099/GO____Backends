import logger from '../../../core/logger/logger.js';
import { pool } from '../../../infrastructure/database/postgres.js';
import {
    updatePayoutRequest,
    findPayoutByTransferId,
} from '../repositories/payment.Repository.js';
import { creditWallet } from '../../wallet/repositories/wallet.repository.js';
import { verifyPayoutWebhookSignature } from '../../kyc/services/cashfreeService.js';

// ═════════════════════════════════════════════════════════════════════════════
//  POST /api/v1/payments/payout/webhook
//
//  Cashfree → our server. Final SUCCESS/FAILED status here.
//  No auth — verified via x-webhook-signature HMAC.
//
//  IMPORTANT: route must use express.raw() (raw body needed for signature)
//
//  Always returns 200 — Cashfree retries on non-200, we never want retries
//  for our own internal bugs (we log + alert separately).
// ═════════════════════════════════════════════════════════════════════════════

export const handlePayoutWebhook = async (req, res) => {
    const ack = () => res.status(200).json({ success: true });

    try {
        const signature = req.headers['x-webhook-signature'];
        const timestamp = req.headers['x-webhook-timestamp'];
        const rawBody   = req.rawBody
            ? req.rawBody.toString('utf8')
            : JSON.stringify(req.body);

        // ─── 1. Cashfree dashboard "Test Webhook" ko allow karo ─────────────
        // Test webhooks me proper signature nahi hota — sirf endpoint reachability check karta hai
        // Real webhooks pe signature strict verify hoti hai
        const isTestPing =
            !signature ||                                  // signature header nahi hai
            !rawBody || rawBody.trim() === '' ||           // empty body
            (req.body?.type && /test/i.test(req.body.type)) ||  // type: TEST
            req.body?.test === true;                       // test: true flag

        if (isTestPing) {
            logger.info('[PayoutWebhook] Test ping received — ACK 200');
            return ack();
        }

        // ─── 2. Signature verification (real webhooks ke liye) ──────────────
        if (!verifyPayoutWebhookSignature({ signature, timestamp, rawBody })) {
            logger.warn('[PayoutWebhook] Invalid signature — rejected');
            return res.status(401).json({ error: 'Invalid signature' });
        }

        // ─── 3. Parse Cashfree payload ──────────────────────────────────────
        // Cashfree payload structure:
        // { type: "TRANSFER_SUCCESS" | "TRANSFER_FAILED" | "TRANSFER_REVERSED",
        //   data: { transfer: { transfer_id, cf_transfer_id, status, status_code,
        //                       status_description, transfer_amount } } }
        const event    = JSON.parse(rawBody);
        const transfer = event?.data?.transfer || event;     // tolerate flat payloads too

        const transferId     = transfer.transfer_id;
        const cfTransferId   = transfer.cf_transfer_id  || null;
        const status         = transfer.status;              // SUCCESS | FAILED | REVERSED
        const statusCode     = transfer.status_code     || '';
        const failureReason  = transfer.status_description || transfer.reason || '';
        const transferAmount = transfer.transfer_amount;

        if (!transferId) {
            logger.warn('[PayoutWebhook] Missing transfer_id in payload');
            return ack();
        }

        logger.info(`[PayoutWebhook] ${event?.type || status} | transfer_id: ${transferId}`);

        // ─── 3. Lookup payout record ────────────────────────────────────────
        const payoutRecord = await findPayoutByTransferId(transferId);
        if (!payoutRecord) {
            logger.warn(`[PayoutWebhook] Payout record not found | transfer_id: ${transferId}`);
            return ack();
        }

        // Idempotency — already terminal, skip
        if (['success', 'failed'].includes(payoutRecord.status)) {
            logger.info(`[PayoutWebhook] Already ${payoutRecord.status} | payout: ${payoutRecord.id}`);
            return ack();
        }

        // ─── 4. Process status ──────────────────────────────────────────────
        if (status === 'SUCCESS') {
            await updatePayoutRequest(payoutRecord.id, {
                status:       'success',
                cfTransferId,
                completedAt:  new Date(),
            });
            logger.info(`[PayoutWebhook] SUCCESS | Payout: ${payoutRecord.id} | ₹${transferAmount}`);

        } else if (status === 'FAILED' || status === 'REVERSED') {
            await updatePayoutRequest(payoutRecord.id, {
                status:        'failed',
                cfTransferId,
                failureReason: `${statusCode}: ${failureReason}`.trim().replace(/^:\s*/, ''),
                completedAt:   new Date(),
            });

            // Refund wallet
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                await creditWallet(client, payoutRecord.driver_user_id, parseFloat(payoutRecord.amount));
                await client.query('COMMIT');
                logger.info(`[PayoutWebhook] Wallet refunded ₹${payoutRecord.amount} | Driver: ${payoutRecord.driver_user_id}`);
            } catch (e) {
                await client.query('ROLLBACK');
                logger.error(`[PayoutWebhook] CRITICAL: refund failed | Driver: ${payoutRecord.driver_user_id} | ${e.message}`);
            } finally {
                client.release();
            }

            logger.warn(`[PayoutWebhook] ${status} | Payout: ${payoutRecord.id} | Reason: ${failureReason}`);
        } else {
            logger.info(`[PayoutWebhook] Intermediate status "${status}" | Payout: ${payoutRecord.id} — no action`);
        }

        return ack();
    } catch (error) {
        logger.error(`[PayoutWebhook] Error: ${error.message}`);
        return ack();
    }
};
