/**
 * Seed script: Grant a subscription to passenger 9540594976
 *
 * Real wallet purchase flow ki tarah saare records create karta hai,
 * lekin wallet balance DEDUCT nahi karta (admin grant).
 *
 * Tables touched:
 *  - users                 → lookup
 *  - wallets               → lookup (NOT debited)
 *  - subscription_plans    → first active plan pick (cheapest)
 *  - transactions          → debit row (category='subscription', status='success')
 *  - user_subscriptions    → active row, transaction_id linked
 *  - subscription_payments → success row, method='wallet'
 *  - redis cache           → invalidate (best-effort)
 *
 * Idempotent: agar already active subscription hai to skip kar deta hai.
 *
 * Run: node scripts/seed-akash-passenger-subscription.js
 */

import { db } from '../src/infrastructure/database/postgres.js';

const PHONE = '9540594976';
const ROLE  = 'passenger';

const generateTxnNumber = () => {
    const ts   = Date.now();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `TXN${ts}${rand}`;
};

async function run() {
    const client = await db.connect();
    try {
        await client.query('BEGIN');

        // ── 1. user dhundo ───────────────────────────────────────────────────
        const userRes = await client.query(
            `SELECT id, full_name FROM users
             WHERE phone_number = $1 AND role = $2`,
            [PHONE, ROLE]
        );

        if (userRes.rowCount === 0) {
            throw new Error(`User not found: phone=${PHONE}, role=${ROLE}. Pehle signup karwao.`);
        }

        const userId   = userRes.rows[0].id;
        const userName = userRes.rows[0].full_name || 'Passenger';
        console.log(`✔ user → id: ${userId} (${userName})`);

        // ── 2. Already active subscription? Skip if yes ──────────────────────
        const activeRes = await client.query(
            `SELECT us.id, sp.name, us.expires_at
             FROM user_subscriptions us
             JOIN subscription_plans sp ON us.plan_id = sp.id
             WHERE us.user_id = $1
               AND us.status = 'active'
               AND us.expires_at > CURRENT_TIMESTAMP
             LIMIT 1`,
            [userId]
        );

        if (activeRes.rowCount > 0) {
            const a = activeRes.rows[0];
            console.log(`ℹ Already has active subscription "${a.name}" valid till ${a.expires_at}. Skipping.`);
            await client.query('COMMIT');
            return;
        }

        // ── 3. wallet dhundo (agar nahi hai to bana do) ──────────────────────
        let walletRes = await client.query(
            `SELECT id, balance FROM wallets WHERE user_id = $1`,
            [userId]
        );
        if (walletRes.rowCount === 0) {
            walletRes = await client.query(
                `INSERT INTO wallets (user_id, balance, total_credited, total_debited)
                 VALUES ($1, 0.00, 0.00, 0.00)
                 RETURNING id, balance`,
                [userId]
            );
            console.log(`✔ wallet created (balance unchanged, admin grant)`);
        }
        const walletId = walletRes.rows[0].id;
        console.log(`✔ wallet → id: ${walletId} | balance: ₹${walletRes.rows[0].balance} (NOT debited)`);

        // ── 4. First active plan ─────────────────────────────────────────────
        const planRes = await client.query(
            `SELECT * FROM subscription_plans
             WHERE is_active = TRUE
             ORDER BY price ASC
             LIMIT 1`
        );

        if (planRes.rowCount === 0) {
            throw new Error('Koi active subscription_plan nahi mila. Seed plans pehle.');
        }

        const plan = planRes.rows[0];
        console.log(`✔ plan → ${plan.name} (id: ${plan.id}, ₹${plan.price}, ${plan.duration_days}d)`);

        // ── 5. transactions row (debit / subscription / success) ─────────────
        const txnRes = await client.query(
            `INSERT INTO transactions (
                transaction_number, user_id, wallet_id, ride_id,
                amount, type, category,
                payment_method, payment_gateway, gateway_transaction_id,
                status, description, metadata,
                created_at, updated_at
             ) VALUES (
                $1, $2, $3, NULL,
                $4, 'debit', 'subscription',
                'wallet', NULL, NULL,
                'success', $5, $6::jsonb,
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
             ) RETURNING id`,
            [
                generateTxnNumber(),
                userId,
                walletId,
                plan.price,
                `Subscription: ${plan.name} (admin grant)`,
                JSON.stringify({ plan_id: plan.id, plan_slug: plan.slug, granted_by: 'seed-script', wallet_debited: false }),
            ]
        );
        const transactionId = txnRes.rows[0].id;
        console.log(`✔ transactions → id: ${transactionId}`);

        // ── 6. Dates ─────────────────────────────────────────────────────────
        const startedAt        = new Date();
        const expiresAt        = new Date();
        expiresAt.setDate(expiresAt.getDate() + plan.duration_days);
        const freeRidesResetAt = new Date();
        freeRidesResetAt.setDate(freeRidesResetAt.getDate() + 30);

        // ── 7. user_subscriptions row ────────────────────────────────────────
        const subRes = await client.query(
            `INSERT INTO user_subscriptions (
                user_id, plan_id, status, started_at, expires_at,
                auto_renew, payment_method, transaction_id,
                free_rides_used, free_rides_reset_at, razorpay_subscription_id,
                created_at, updated_at
             ) VALUES ($1,$2,'active',$3,$4,FALSE,'wallet',$5,0,$6,NULL,
                       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             RETURNING id`,
            [userId, plan.id, startedAt, expiresAt, transactionId, freeRidesResetAt]
        );
        const subscriptionId = subRes.rows[0].id;
        console.log(`✔ user_subscriptions → id: ${subscriptionId} (transaction_id: ${transactionId})`);

        // ── 8. subscription_payments row ─────────────────────────────────────
        const payRes = await client.query(
            `INSERT INTO subscription_payments (
                user_id, subscription_id, plan_id, amount,
                payment_method, payment_gateway, gateway_transaction_id,
                status, description, metadata,
                created_at, updated_at
             ) VALUES ($1,$2,$3,$4,'wallet',NULL,NULL,'success',$5,$6::jsonb,
                       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             RETURNING id`,
            [
                userId, subscriptionId, plan.id, plan.price,
                `Subscription to ${plan.name}`,
                JSON.stringify({ plan_slug: plan.slug, transaction_id: transactionId, granted_by: 'seed-script' }),
            ]
        );
        console.log(`✔ subscription_payments → id: ${payRes.rows[0].id}`);

        await client.query('COMMIT');

        // ── 9. Redis cache invalidate (best-effort) ──────────────────────────
        try {
            const redisMod = await import('../src/config/redis.config.js');
            const redis    = redisMod.default;
            await redis.del(`subscription:active:${userId}`);
            console.log(`✔ redis cache invalidated`);
        } catch (e) {
            console.log(`ℹ Redis cache invalidate skipped: ${e.message}`);
        }

        console.log(`\n✅ Done! Subscription granted.`);
        console.log(`   user_id         : ${userId}`);
        console.log(`   transaction_id  : ${transactionId}`);
        console.log(`   subscription_id : ${subscriptionId}`);
        console.log(`   plan            : ${plan.name} (${plan.slug})`);
        console.log(`   started_at      : ${startedAt.toISOString()}`);
        console.log(`   expires_at      : ${expiresAt.toISOString()}`);
        console.log(`   wallet          : NOT debited (admin grant)`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Seed failed, rolled back:', err.message);
        process.exitCode = 1;
    } finally {
        client.release();
        process.exit(process.exitCode || 0);
    }
}

run();
