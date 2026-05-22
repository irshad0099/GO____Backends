import { db } from '../src/infrastructure/database/postgres.js';

const PHONE  = '9876543210';
const NAME   = 'Test Driver';
const EMAIL  = 'testdriver@example.com';
const CITY   = 'Mumbai';

async function run() {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // 1. Create user
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

    // 2. Create driver (verified, available)
    const driverRes = await client.query(
      `INSERT INTO drivers (user_id, is_verified, is_available, is_on_duty,
         current_latitude, current_longitude, total_rides, rating,
         total_earnings, city, subscription_status, verified_at)
       VALUES ($1, TRUE, TRUE, FALSE,
         19.0760, 72.8777, 0, 0.0,
         0.00, $2, 'inactive', NOW())
       ON CONFLICT (user_id) DO UPDATE
         SET is_verified   = TRUE,
             verified_at   = NOW(),
             city          = EXCLUDED.city,
             updated_at    = NOW()
       RETURNING id`,
      [userId, CITY]
    );
    const driverId = driverRes.rows[0].id;

    // 3. Create vehicle
    await client.query(
      `INSERT INTO driver_vehicle
         (driver_id, vehicle_type, vehicle_model, vehicle_color,
          rc_number, vehicle_number, owner_name,
          rc_front, rc_back, verification_status, verified_at)
       VALUES ($1, 'bike', 'Hero Splendor', 'Black',
         'MH-RC-TEST-001', 'MH01AB9999', $2,
         'https://placeholder.example.com/rc_front.jpg',
         'https://placeholder.example.com/rc_back.jpg',
         'verified', NOW())
       ON CONFLICT (driver_id) DO UPDATE
         SET vehicle_type        = EXCLUDED.vehicle_type,
             verification_status = 'verified',
             verified_at         = NOW()`,
      [driverId, NAME]
    );

    // 4. Create wallet with ₹100 balance
    await client.query(
      `INSERT INTO wallets (user_id, balance, total_credited, total_debited)
       VALUES ($1, 100.00, 100.00, 0.00)
       ON CONFLICT (user_id) DO UPDATE
         SET balance = 100.00,
             total_credited = 100.00,
             updated_at = NOW()`,
      [userId]
    );

    // 5. Mark KYC as verified (bypass)
    await client.query(
      `INSERT INTO driver_kyc_status
         (user_id, overall_status, submitted_docs_count, verified_docs_count,
          last_activity_at, verified_at)
       VALUES ($1, 'approved', 0, 0, NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE
         SET overall_status      = 'approved',
             verified_at         = NOW(),
             updated_at          = NOW()`,
      [userId]
    );

    await client.query('COMMIT');

    console.log(`\n✅ Test Driver Ready!`);
    console.log(`   User ID   : ${userId}`);
    console.log(`   Driver ID : ${driverId}`);
    console.log(`   Phone     : ${PHONE}`);
    console.log(`   Wallet    : ₹100.00`);
    console.log(`   KYC       : APPROVED ✓`);
    console.log(`   Verified  : YES ✓`);
    console.log(`\n🚀 Ready to create rides and test!`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', err.message);
    throw err;
  } finally {
    client.release();
    process.exit(0);
  }
}

run();
