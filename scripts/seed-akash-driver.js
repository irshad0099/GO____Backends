/**
 * Seed script: Akash Gupta — Driver (phone: 9540594976)
 *
 * Kya karta hai:
 *  - users, drivers, driver_vehicle, driver_score, driver_metrics_daily
 *  - driver_cash_balance, driver_penalty_summary
 *  - driver_kyc_status, kyc_documents (aadhaar + license — verified)
 *  - wallets
 *
 * Kya NAHI karta:
 *  - Koi ride create nahi karta (active ya completed)
 *  - Existing data delete nahi karta
 *
 * Run: node scripts/seed-akash-driver.js
 */

import { db } from '../src/infrastructure/database/postgres.js';

const PHONE  = '9540594976';
const NAME   = 'Akash Gupta';
const EMAIL  = 'akash.gupta@gomobility.dev';
const CITY   = 'Delhi';

async function run() {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // ── 1. users ──────────────────────────────────────────────────────────────
    const userRes = await client.query(
      `INSERT INTO users (phone_number, email, full_name, role, is_verified, is_active, last_login)
       VALUES ($1, $2, $3, 'driver', TRUE, TRUE, NOW())
       ON CONFLICT (phone_number, role) DO UPDATE
         SET full_name   = EXCLUDED.full_name,
             is_verified = TRUE,
             is_active   = TRUE,
             updated_at  = NOW()
       RETURNING id`,
      [PHONE, EMAIL, NAME]
    );
    const userId = userRes.rows[0].id;
    console.log(`✔ users  → id: ${userId}`);

    // ── 2. drivers ────────────────────────────────────────────────────────────
    const driverRes = await client.query(
      `INSERT INTO drivers (user_id, is_verified, is_available, is_on_duty,
         current_latitude, current_longitude, total_rides, rating,
         total_earnings, city, subscription_status, verified_at)
       VALUES ($1, TRUE, TRUE, FALSE,
         28.6139, 77.2090, 0, 4.80,
         0.00, $2, 'inactive', NOW())
       ON CONFLICT (user_id) DO UPDATE
         SET is_verified   = TRUE,
             city          = EXCLUDED.city,
             updated_at    = NOW()
       RETURNING id`,
      [userId, CITY]
    );
    const driverId = driverRes.rows[0].id;
    console.log(`✔ drivers → id: ${driverId}`);

    // ── 3. driver_vehicle ─────────────────────────────────────────────────────
    await client.query(
      `INSERT INTO driver_vehicle
         (driver_id, vehicle_type, vehicle_model, vehicle_color,
          rc_number, vehicle_number, owner_name,
          rc_front, rc_back, verification_status, verified_at)
       VALUES ($1, 'auto', 'Bajaj RE Compact', 'Yellow-Green',
         'DL-RC-9540594976', 'DL01AB9540', $2,
         'https://placeholder.gomobility.dev/rc_front.jpg',
         'https://placeholder.gomobility.dev/rc_back.jpg',
         'verified', NOW())
       ON CONFLICT (driver_id) DO UPDATE
         SET vehicle_type        = EXCLUDED.vehicle_type,
             verification_status = 'verified',
             verified_at         = NOW()`,
      [driverId, NAME]
    );
    console.log(`✔ driver_vehicle`);

    // ── 4. driver_score ───────────────────────────────────────────────────────
    await client.query(
      `INSERT INTO driver_score
         (driver_id, avg_rating, acceptance_rate, completion_rate,
          ontime_rate, cancel_rate, complaint_penalty, score_total, tier, last_updated)
       VALUES ($1, 4.80, 92.00, 96.00, 88.00, 4.00, 0, 88, 'GOLD', NOW())
       ON CONFLICT (driver_id) DO NOTHING`,
      [driverId]
    );
    console.log(`✔ driver_score`);

    // ── 5. driver_metrics_daily (aaj ka) ─────────────────────────────────────
    await client.query(
      `INSERT INTO driver_metrics_daily
         (driver_id, date, rides_assigned, rides_accepted, rides_completed,
          rides_cancelled_driver, rides_cancelled_user)
       VALUES ($1, CURRENT_DATE, 0, 0, 0, 0, 0)
       ON CONFLICT (driver_id, date) DO NOTHING`,
      [driverId]
    );
    console.log(`✔ driver_metrics_daily`);

    // ── 6. driver_cash_balance ────────────────────────────────────────────────
    await client.query(
      `INSERT INTO driver_cash_balance
         (driver_id, pending_amount, total_cash_collected, total_deposited,
          total_platform_share, is_limit_exceeded, cash_limit)
       VALUES ($1, 0.00, 0.00, 0.00, 0.00, FALSE, 2000.00)
       ON CONFLICT (driver_id) DO NOTHING`,
      [driverId]
    );
    console.log(`✔ driver_cash_balance`);

    // ── 7. driver_penalty_summary ─────────────────────────────────────────────
    await client.query(
      `INSERT INTO driver_penalty_summary
         (driver_id, total_points, total_warnings, total_fines,
          total_fine_amount, total_bans, is_banned)
       VALUES ($1, 0, 0, 0, 0.00, 0, FALSE)
       ON CONFLICT (driver_id) DO NOTHING`,
      [driverId]
    );
    console.log(`✔ driver_penalty_summary`);

    // ── 8. wallets ────────────────────────────────────────────────────────────
    await client.query(
      `INSERT INTO wallets (user_id, balance, total_credited, total_debited)
       VALUES ($1, 0.00, 0.00, 0.00)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );
    console.log(`✔ wallets`);

    // ── 9. driver_kyc_status ──────────────────────────────────────────────────
    await client.query(
      `INSERT INTO driver_kyc_status
         (user_id, overall_status, submitted_docs_count, verified_docs_count,
          last_activity_at, verified_at)
       VALUES ($1, 'verified', 2, 2, NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE
         SET overall_status      = 'verified',
             submitted_docs_count = 2,
             verified_docs_count  = 2,
             verified_at          = NOW()`,
      [userId]
    );
    console.log(`✔ driver_kyc_status`);

    // ── 10. kyc_documents (Aadhaar + Driving License) ────────────────────────
    // Aadhaar
    await client.query(
      `INSERT INTO kyc_documents
         (user_id, document_type, method, status, document_number,
          extracted_data, confidence_score, fraud_score, verified_at)
       VALUES ($1, 'aadhaar', 'manual', 'verified', 'XXXX-XXXX-9540',
         '{"name":"Akash Gupta","dob":"1995-01-01","address":"Delhi, India"}',
         95, 0, NOW())
       ON CONFLICT (user_id, document_type) DO UPDATE
         SET status      = 'verified',
             verified_at = NOW()`,
      [userId]
    );
    // Driving License
    await client.query(
      `INSERT INTO kyc_documents
         (user_id, document_type, method, status, document_number,
          extracted_data, confidence_score, fraud_score, verified_at)
       VALUES ($1, 'driving_license', 'manual', 'verified', 'DL-9540594976',
         '{"name":"Akash Gupta","vehicle_class":"LMV","valid_till":"2030-12-31"}',
         95, 0, NOW())
       ON CONFLICT (user_id, document_type) DO UPDATE
         SET status      = 'verified',
             verified_at = NOW()`,
      [userId]
    );
    console.log(`✔ kyc_documents (aadhaar + driving_license)`);

    await client.query('COMMIT');
    console.log(`\n✅ Done! Akash Gupta driver seed complete.`);
    console.log(`   user_id   : ${userId}`);
    console.log(`   driver_id : ${driverId}`);
    console.log(`   phone     : ${PHONE}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed, rolled back:', err.message);
    throw err;
  } finally {
    client.release();
    process.exit(0);
  }
}

run();
