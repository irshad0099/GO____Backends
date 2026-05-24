/**
 * Test Driver Seed Script
 * ─────────────────────────────────────────────────────────────────────────────
 * Ek naya driver create karta hai jiska poora KYC complete ho.
 * JWT token bhi print karta hai taaki seedha Postman/app mein use kar sako.
 *
 * Usage:
 *   node scripts/seed-test-driver.js
 *
 *   Custom phone/name ke liye:
 *   DRIVER_PHONE=9876543210 DRIVER_NAME="Rahul Kumar" VEHICLE_TYPE=car node scripts/seed-test-driver.js
 *
 * Vehicle types: bike | auto | car
 */

import { db } from '../src/infrastructure/database/postgres.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

// ─── Config — yahan change karo ──────────────────────────────────────────────
const PHONE        = process.env.DRIVER_PHONE   || '9999988888';
const NAME         = process.env.DRIVER_NAME    || 'Test Driver';
const EMAIL        = `test.driver.${PHONE}@gomobility.dev`;
const CITY         = process.env.DRIVER_CITY    || 'Delhi';
const VEHICLE_TYPE = process.env.VEHICLE_TYPE   || 'auto'; // bike | auto | car
const JWT_SECRET   = process.env.JWT_SECRET     || 'gomobility_super_secret_key';

// Vehicle type ke hisaab se model/color
const VEHICLE_META = {
    bike: { model: 'Honda Activa 6G',    color: 'Matt Axis Grey' },
    auto: { model: 'Bajaj RE Compact',   color: 'Yellow-Green'   },
    car:  { model: 'Maruti Suzuki Swift', color: 'Pearl Arctic White' },
};
const vehicle = VEHICLE_META[VEHICLE_TYPE] || VEHICLE_META.auto;

// Unique suffix for RC/vehicle number (phone ke last 6 digits)
const suffix = PHONE.slice(-6);

async function run() {
    await db.connect();                // pool initialize karo
    const client = await db.getClient(); // transaction client lo
    try {
        await client.query('BEGIN');
        console.log('\n🚀 Creating test driver...\n');

        // ── 1. users ──────────────────────────────────────────────────────────
        const { rows: [user] } = await client.query(
            `INSERT INTO users (phone_number, email, full_name, role, is_verified, is_active, last_login)
             VALUES ($1, $2, $3, 'driver', TRUE, TRUE, NOW())
             ON CONFLICT (phone_number, role) DO UPDATE
               SET full_name   = EXCLUDED.full_name,
                   is_verified = TRUE,
                   is_active   = TRUE,
                   updated_at  = NOW()
             RETURNING *`,
            [PHONE, EMAIL, NAME]
        );
        console.log(`✔  users          → id: ${user.id}`);

        // ── 2. drivers ────────────────────────────────────────────────────────
        const { rows: [driver] } = await client.query(
            `INSERT INTO drivers
               (user_id, is_verified, is_available, is_on_duty,
                current_latitude, current_longitude, total_rides, rating,
                total_earnings, city, subscription_status, verified_at)
             VALUES ($1, TRUE, TRUE, FALSE,
               28.6139, 77.2090, 0, 5.00,
               0.00, $2, 'inactive', NOW())
             ON CONFLICT (user_id) DO UPDATE
               SET is_verified = TRUE,
                   city        = EXCLUDED.city,
                   updated_at  = NOW()
             RETURNING *`,
            [user.id, CITY]
        );
        console.log(`✔  drivers        → id: ${driver.id}`);

        // ── 3. driver_vehicle ─────────────────────────────────────────────────
        await client.query(
            `INSERT INTO driver_vehicle
               (driver_id, vehicle_type, vehicle_model, vehicle_color,
                rc_number, vehicle_number, owner_name,
                rc_front, rc_back,
                policy_number, insurance_provider, insurance_front, insurance_back,
                insurance_valid_until,
                permit_number, permit_type, permit_document, permit_valid_until,
                verification_status, verified_at)
             VALUES ($1, $2, $3, $4,
               $5, $6, $7,
               'https://placeholder.gomobility.dev/rc_front.jpg',
               'https://placeholder.gomobility.dev/rc_back.jpg',
               'INS-${suffix}', 'New India Assurance',
               'https://placeholder.gomobility.dev/ins_front.jpg',
               'https://placeholder.gomobility.dev/ins_back.jpg',
               CURRENT_DATE + INTERVAL '1 year',
               'PERMIT-${suffix}', 'All India Tourist Permit',
               'https://placeholder.gomobility.dev/permit.jpg',
               CURRENT_DATE + INTERVAL '1 year',
               'verified', NOW())
             ON CONFLICT (driver_id) DO UPDATE
               SET vehicle_type        = EXCLUDED.vehicle_type,
                   vehicle_model       = EXCLUDED.vehicle_model,
                   verification_status = 'verified',
                   verified_at         = NOW()`,
            [
                driver.id,
                VEHICLE_TYPE,
                vehicle.model,
                vehicle.color,
                `RC-DL-${suffix}`,
                `DL01${VEHICLE_TYPE.toUpperCase().slice(0,2)}${suffix}`,
                NAME,
            ]
        );
        console.log(`✔  driver_vehicle → ${VEHICLE_TYPE} | ${vehicle.model}`);

        // ── 4. driver_score ───────────────────────────────────────────────────
        await client.query(
            `INSERT INTO driver_score
               (driver_id, avg_rating, acceptance_rate, completion_rate,
                ontime_rate, cancel_rate, complaint_penalty, score_total, tier)
             VALUES ($1, 5.00, 95.00, 98.00, 90.00, 2.00, 0, 92, 'GOLD')
             ON CONFLICT (driver_id) DO NOTHING`,
            [driver.id]
        );
        console.log(`✔  driver_score   → GOLD tier`);

        // ── 5. driver_metrics_daily (aaj ka) ─────────────────────────────────
        await client.query(
            `INSERT INTO driver_metrics_daily
               (driver_id, date, rides_assigned, rides_accepted, rides_completed,
                rides_cancelled_driver, rides_cancelled_user)
             VALUES ($1, CURRENT_DATE, 0, 0, 0, 0, 0)
             ON CONFLICT (driver_id, date) DO NOTHING`,
            [driver.id]
        );
        console.log(`✔  driver_metrics_daily`);

        // ── 6. driver_cash_balance ────────────────────────────────────────────
        await client.query(
            `INSERT INTO driver_cash_balance
               (driver_id, pending_amount, total_cash_collected, total_deposited,
                total_platform_share, is_limit_exceeded, cash_limit)
             VALUES ($1, 0.00, 0.00, 0.00, 0.00, FALSE, 2000.00)
             ON CONFLICT (driver_id) DO NOTHING`,
            [driver.id]
        );
        console.log(`✔  driver_cash_balance`);

        // ── 7. driver_penalty_summary ─────────────────────────────────────────
        await client.query(
            `INSERT INTO driver_penalty_summary
               (driver_id, total_points, total_warnings, total_fines,
                total_fine_amount, total_bans, is_banned)
             VALUES ($1, 0, 0, 0, 0.00, 0, FALSE)
             ON CONFLICT (driver_id) DO NOTHING`,
            [driver.id]
        );
        console.log(`✔  driver_penalty_summary`);

        // ── 8. wallets ────────────────────────────────────────────────────────
        await client.query(
            `INSERT INTO wallets (user_id, balance, total_credited, total_debited)
             VALUES ($1, 500.00, 500.00, 0.00)
             ON CONFLICT (user_id) DO NOTHING`,
            [user.id]
        );
        console.log(`✔  wallets        → ₹500 starting balance`);

        // ── 9. driver_kyc_status ──────────────────────────────────────────────
        await client.query(
            `INSERT INTO driver_kyc_status
               (user_id, overall_status, submitted_docs_count, verified_docs_count,
                last_activity_at, verified_at)
             VALUES ($1, 'verified', 6, 6, NOW(), NOW())
             ON CONFLICT (user_id) DO UPDATE
               SET overall_status       = 'verified',
                   submitted_docs_count = 6,
                   verified_docs_count  = 6,
                   verified_at          = NOW()`,
            [user.id]
        );
        console.log(`✔  driver_kyc_status → verified (6/6 docs)`);

        // ── 10. kyc_documents — saare 6 types ────────────────────────────────
        const kycDocs = [
            {
                type: 'AADHAAR',
                number: `${suffix.slice(0,4)}-${suffix.slice(0,4)}-${suffix}`,
                data: { name: NAME, dob: '1993-05-15', address: `${CITY}, India`, gender: 'M' },
            },
            {
                type: 'PAN',
                number: `ABCDE${suffix.slice(0,4)}F`,
                data: { name: NAME, dob: '1993-05-15', pan: `ABCDE${suffix.slice(0,4)}F` },
            },
            {
                type: 'DRIVING_LICENCE',
                number: `DL-${CITY.slice(0,2).toUpperCase()}-${suffix}`,
                data: { name: NAME, vehicle_class: VEHICLE_TYPE === 'bike' ? 'MCWG' : 'LMV', valid_till: '2033-12-31' },
            },
            {
                type: 'VEHICLE_RC',
                number: `RC-DL-${suffix}`,
                data: { owner_name: NAME, vehicle_type: VEHICLE_TYPE, model: vehicle.model, reg_date: '2022-01-01' },
            },
            {
                type: 'BANK_ACCOUNT',
                number: `HDFC00${suffix}`,
                data: { account_holder: NAME, bank: 'HDFC Bank', ifsc: `HDFC0${suffix.slice(0,5)}`, account_type: 'savings' },
            },
            {
                type: 'SELFIE',
                number: null,
                data: { face_match_score: 92, liveness_check: 'passed' },
            },
        ];

        for (const doc of kycDocs) {
            await client.query(
                `INSERT INTO kyc_documents
                   (user_id, document_type, method, status, document_number,
                    extracted_data, confidence_score, fraud_score, verified_at)
                 VALUES ($1, $2, 'manual', 'verified', $3, $4, 95, 0, NOW())
                 ON CONFLICT (user_id, document_type) DO UPDATE
                   SET status      = 'verified',
                       verified_at = NOW()`,
                [user.id, doc.type, doc.number, JSON.stringify(doc.data)]
            );
            console.log(`✔  kyc_documents  → ${doc.type}`);
        }

        await client.query('COMMIT');

        // ── JWT token generate karo ───────────────────────────────────────────
        const token = jwt.sign(
            { userId: user.id, id: user.id, phone: user.phone_number, role: 'driver', type: 'access' },
            JWT_SECRET,
            { expiresIn: '7d', algorithm: 'HS256' }
        );
        const refreshToken = jwt.sign(
            { userId: user.id, id: user.id, phone: user.phone_number, role: 'driver', type: 'refresh' },
            JWT_SECRET,
            { expiresIn: '30d', algorithm: 'HS256' }
        );

        // ── Session DB mein store karo ────────────────────────────────────────
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await db.query(
            `INSERT INTO sessions
               (user_id, refresh_token, access_token, ip_address, user_agent, device_id, device_type, expires_at)
             VALUES ($1, $2, $3, '127.0.0.1', 'SeedScript/1.0', 'seed-device', 'android', $4)`,
            [user.id, refreshToken, token, expiresAt]
        );

        // ── Final output ──────────────────────────────────────────────────────
        console.log('\n' + '═'.repeat(60));
        console.log('✅  TEST DRIVER READY');
        console.log('═'.repeat(60));
        console.log(`  Name        : ${NAME}`);
        console.log(`  Phone       : ${PHONE}`);
        console.log(`  Email       : ${EMAIL}`);
        console.log(`  user_id     : ${user.id}`);
        console.log(`  driver_id   : ${driver.id}`);
        console.log(`  Vehicle     : ${VEHICLE_TYPE} — ${vehicle.model} (${vehicle.color})`);
        console.log(`  KYC         : verified (6/6)`);
        console.log(`  Wallet      : ₹500`);
        console.log(`  Location    : 28.6139, 77.2090 (Delhi)`);
        console.log('─'.repeat(60));
        console.log('  JWT TOKEN (valid 7 days):');
        console.log(`\n${token}\n`);
        console.log('─'.repeat(60));
        console.log('  LOGIN kaise karo (OTP bypass):');
        console.log(`  POST /api/v1/auth/send-otp   → phone: "${PHONE}", role: "driver"`);
        console.log(`  POST /api/v1/auth/verify-otp → otp: "1234" (dev mode mein)`);
        console.log('  Ya seedha upar wala JWT token Authorization header mein lagao.');
        console.log('═'.repeat(60) + '\n');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\n❌ Seed failed, rolled back:', err.message);
        throw err;
    } finally {
        client.release();
        process.exit(0);
    }
}

run();