#!/usr/bin/env node
/**
 * Seed Test Data Script
 * Creates dummy users, drivers, rides, wallets for API testing
 * 
 * Usage: node scripts/seedTestData.js
 *        npm run seed (if added to package.json)
 */

import { db } from '../src/infrastructure/database/postgres.js';
import logger from '../src/core/logger/logger.js';

// Initialize database connection
await db.connect();

const TEST_USERS = {
  passenger1: {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    phone: '9876543210',
    email: 'rahul@test.com',
    name: 'Rahul Sharma',
    role: 'passenger'
  },
  passenger2: {
    id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    phone: '9876543211',
    email: 'priya@test.com',
    name: 'Priya Patel',
    role: 'passenger'
  },
  driver1: {
    id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    phone: '9876543212',
    email: 'amit@test.com',
    name: 'Amit Kumar',
    role: 'driver'
  },
  driver2: {
    id: 'd4e5f6a7-b8c9-0123-defa-234567890123',
    phone: '9876543213',
    email: 'sunil@test.com',
    name: 'Sunil Verma',
    role: 'driver'
  }
};

async function seedUsers(client) {
  logger.info('🌱 Seeding users...');
  
  for (const [key, user] of Object.entries(TEST_USERS)) {
    // Check if user already exists
    const existing = await client.query(
      'SELECT id FROM users WHERE phone_number = $1 AND role = $2',
      [user.phone, user.role]
    );
    
    if (existing.rows.length > 0) {
      // Update the TEST_USERS object with existing ID
      user.id = existing.rows[0].id;
      logger.info(`  ⚠️  ${user.name} already exists (${user.phone}) - using existing ID`);
    } else {
      // Insert new user
      await client.query(`
        INSERT INTO users (id, phone_number, email, full_name, role, is_verified, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, true, true, NOW(), NOW())
      `, [user.id, user.phone, user.email, user.name, user.role]);
      
      logger.info(`  ✅ ${user.name} created (${user.role}) - ${user.phone}`);
    }
  }
}

async function seedDrivers(client) {
  logger.info('🚗 Seeding driver profiles...');
  
  const drivers = [
    { userId: TEST_USERS.driver1.id, available: true, onDuty: true, lat: 19.0760, lng: 72.8777, rides: 150, rating: 4.7, earnings: 45000 },
    { userId: TEST_USERS.driver2.id, available: true, onDuty: false, lat: 19.2183, lng: 72.9781, rides: 89, rating: 4.5, earnings: 28000 }
  ];
  
  for (const d of drivers) {
    await client.query(`
      INSERT INTO drivers (user_id, is_verified, is_available, is_on_duty, current_latitude, current_longitude, total_rides, rating, total_earnings, created_at, updated_at, verified_at)
      VALUES ($1, true, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), NOW())
      ON CONFLICT (user_id) DO UPDATE 
      SET is_available = EXCLUDED.is_available, is_on_duty = EXCLUDED.is_on_duty, current_latitude = EXCLUDED.current_latitude, current_longitude = EXCLUDED.current_longitude
    `, [d.userId, d.available, d.onDuty, d.lat, d.lng, d.rides, d.rating, d.earnings]);
  }
  
  logger.info('  ✅ 2 drivers created');
}

async function seedWallets(client) {
  logger.info('💰 Seeding wallets...');
  
  const wallets = [
    { userId: TEST_USERS.passenger1.id, balance: 500, credited: 1000, debited: 500 },  // Rahul - has balance
    { userId: TEST_USERS.passenger2.id, balance: 0, credited: 0, debited: 0 },        // Priya - empty
    { userId: TEST_USERS.driver1.id, balance: 5000, credited: 45000, debited: 40000 },
    { userId: TEST_USERS.driver2.id, balance: 3200, credited: 28000, debited: 24800 }
  ];
  
  for (const w of wallets) {
    const existing = await client.query('SELECT id FROM wallets WHERE user_id = $1', [w.userId]);
    
    if (existing.rows.length > 0) {
      // Update existing wallet
      await client.query(`
        UPDATE wallets 
        SET balance = $1, total_credited = $2, total_debited = $3, updated_at = NOW()
        WHERE user_id = $4
      `, [w.balance, w.credited, w.debited, w.userId]);
    } else {
      // Insert new wallet
      await client.query(`
        INSERT INTO wallets (user_id, balance, total_credited, total_debited, last_transaction_at, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW())
      `, [w.userId, w.balance, w.credited, w.debited]);
    }
  }
  
  logger.info('  ✅ 4 wallets created/updated');
}

async function seedRides(client) {
  logger.info('🚙 Seeding rides...');
  
  // Get driver IDs
  const driver1Res = await client.query('SELECT id FROM drivers WHERE user_id = $1', [TEST_USERS.driver1.id]);
  const driver2Res = await client.query('SELECT id FROM drivers WHERE user_id = $1', [TEST_USERS.driver2.id]);
  
  const driver1Id = driver1Res.rows[0]?.id;
  const driver2Id = driver2Res.rows[0]?.id;
  
  if (!driver1Id || !driver2Id) {
    throw new Error('Driver IDs not found');
  }
  
  const rides = [
    {
      number: 'RD202401010001',
      passengerId: TEST_USERS.passenger1.id,
      driverId: driver1Id,
      vehicle: 'car',
      pickup: { lat: 19.0760, lng: 72.8777, addr: 'Andheri West, Mumbai', name: 'Andheri Station' },
      drop: { lat: 19.2183, lng: 72.9781, addr: 'Powai, Mumbai', name: 'Phoenix Mall' },
      distance: 12.5, duration: 35,
      fare: { base: 50, distance: 187.50, time: 35, surge: 1.0, estimated: 272.50, final: 272.50 },
      status: 'completed', paymentStatus: 'pending', paymentMethod: 'upi',
      times: { requested: -120, assigned: -110, arrived: -100, started: -90, completed: -60 }
    },
    {
      number: 'RD202401010002',
      passengerId: TEST_USERS.passenger2.id,
      driverId: driver2Id,
      vehicle: 'auto',
      pickup: { lat: 19.1136, lng: 72.8691, addr: 'Bandra West, Mumbai', name: 'Bandra Station' },
      drop: { lat: 19.1996, lng: 72.8426, addr: 'Juhu, Mumbai', name: 'Juhu Beach' },
      distance: 8.2, duration: 22,
      fare: { base: 30, distance: 98.40, time: 22, surge: 1.2, estimated: 180.48, final: 180.48 },
      status: 'completed', paymentStatus: 'pending', paymentMethod: 'cash',
      times: { requested: -180, assigned: -170, arrived: -160, started: -150, completed: -120 }
    },
    {
      number: 'RD202401010003',
      passengerId: TEST_USERS.passenger1.id,
      driverId: driver1Id,
      vehicle: 'bike',
      pickup: { lat: 19.0760, lng: 72.8777, addr: 'Andheri East, Mumbai', name: 'Andheri East Station' },
      drop: { lat: 19.1200, lng: 72.9100, addr: 'Vile Parle, Mumbai', name: 'Domestic Airport' },
      distance: 5.5, duration: 18,
      fare: { base: 20, distance: 44, time: 18, surge: 1.0, estimated: 82, final: null },
      status: 'in_progress', paymentStatus: 'pending', paymentMethod: null,
      times: { requested: -20, assigned: -15, arrived: -10, started: -5, completed: null }
    },
    {
      number: 'RD202401010004',
      passengerId: TEST_USERS.passenger2.id,
      driverId: null,
      vehicle: 'car',
      pickup: { lat: 19.0330, lng: 72.8730, addr: 'Colaba, Mumbai', name: 'Gateway of India' },
      drop: { lat: 19.0760, lng: 72.8777, addr: 'Andheri, Mumbai', name: 'Andheri West' },
      distance: 25.0, duration: 55,
      fare: { base: 50, distance: 375, time: 55, surge: 1.5, estimated: 720, final: null },
      status: 'requested', paymentStatus: 'pending', paymentMethod: null,
      times: { requested: -5, assigned: null, arrived: null, started: null, completed: null }
    }
  ];
  
  for (const r of rides) {
    const now = new Date();
    const requestedAt = new Date(now.getTime() + r.times.requested * 60000);
    const assignedAt = r.times.assigned ? new Date(now.getTime() + r.times.assigned * 60000) : null;
    const arrivedAt = r.times.arrived ? new Date(now.getTime() + r.times.arrived * 60000) : null;
    const startedAt = r.times.started ? new Date(now.getTime() + r.times.started * 60000) : null;
    const completedAt = r.times.completed ? new Date(now.getTime() + r.times.completed * 60000) : null;
    
    await client.query(`
      INSERT INTO rides (
        ride_number, passenger_id, driver_id, vehicle_type,
        pickup_latitude, pickup_longitude, pickup_address, pickup_location_name,
        dropoff_latitude, dropoff_longitude, dropoff_address, dropoff_location_name,
        distance_km, duration_minutes,
        base_fare, distance_fare, time_fare, surge_multiplier, estimated_fare, actual_fare, discount_amount, final_fare,
        status, payment_status, payment_method,
        requested_at, driver_assigned_at, driver_arrived_at, started_at, completed_at,
        driver_current_latitude, driver_current_longitude,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, NOW(), NOW())
      ON CONFLICT (ride_number) DO UPDATE 
      SET status = EXCLUDED.status, payment_status = EXCLUDED.payment_status, driver_id = EXCLUDED.driver_id
    `, [
      r.number, r.passengerId, r.driverId, r.vehicle,
      r.pickup.lat, r.pickup.lng, r.pickup.addr, r.pickup.name,
      r.drop.lat, r.drop.lng, r.drop.addr, r.drop.name,
      r.distance, r.duration,
      r.fare.base, r.fare.distance, r.fare.time, r.fare.surge, r.fare.estimated, r.fare.final, 0, r.fare.final,
      r.status, r.paymentStatus, r.paymentMethod,
      requestedAt, assignedAt, arrivedAt, startedAt, completedAt,
      r.pickup.lat, r.pickup.lng
    ]);
    
    logger.info(`  ✅ Ride ${r.number} - ${r.status}`);
  }
}

async function seedTransactions(client) {
  logger.info('📜 Seeding transactions...');
  
  // Get wallet IDs
  const wallet1Res = await client.query('SELECT id FROM wallets WHERE user_id = $1', [TEST_USERS.passenger1.id]);
  const wallet1Id = wallet1Res.rows[0]?.id;
  
  if (wallet1Id) {
    await client.query(`
      INSERT INTO transactions (transaction_number, user_id, wallet_id, ride_id, amount, type, category, payment_method, payment_gateway, gateway_transaction_id, status, description, metadata, created_at)
      VALUES ('TXN202401010001', $1, $2, NULL, 500.00, 'credit', 'wallet_recharge', 'upi', 'razorpay', 'pay_test_001', 'success', 'Wallet recharge via Razorpay', '{"source": "razorpay"}'::jsonb, NOW() - INTERVAL '1 day')
      ON CONFLICT (transaction_number) DO NOTHING
    `, [TEST_USERS.passenger1.id, wallet1Id]);
    
    logger.info('  ✅ Sample transaction created');
  }
}

async function seedData() {
  const client = await db.getClient();
  
  try {
    logger.info('═══════════════════════════════════════════════════════════');
    logger.info('🚀 Starting Test Data Seeding');
    logger.info('═══════════════════════════════════════════════════════════');
    
    await client.query('BEGIN');
    
    await seedUsers(client);
    await seedDrivers(client);
    await seedWallets(client);
    await seedRides(client);
    await seedTransactions(client);
    
    await client.query('COMMIT');
    
    logger.info('═══════════════════════════════════════════════════════════');
    logger.info('✅ Test Data Seeding Complete!');
    logger.info('═══════════════════════════════════════════════════════════');
    
    // Print summary
    console.log('\n📋 Test Accounts:\n');
    console.log('┌─────────────┬─────────────────┬────────────┬─────────────────────────────┐');
    console.log('│ Phone       │ Name            │ Role       │ Password/Access             │');
    console.log('├─────────────┼─────────────────┼────────────┼─────────────────────────────┤');
    console.log('│ 9876543210  │ Rahul Sharma    │ Passenger  │ Use OTP: 123456 (test mode) │');
    console.log('│ 9876543211  │ Priya Patel     │ Passenger  │ Use OTP: 123456 (test mode) │');
    console.log('│ 9876543212  │ Amit Kumar      │ Driver     │ Use OTP: 123456 (test mode) │');
    console.log('│ 9876543213  │ Sunil Verma     │ Driver     │ Use OTP: 123456 (test mode) │');
    console.log('└─────────────┴─────────────────┴────────────┴─────────────────────────────┘');
    
    console.log('\n🚗 Test Rides:\n');
    console.log('┌──────────────────┬───────────┬──────────┬──────────┬───────────────┐');
    console.log('│ Ride Number      │ Passenger │ Driver   │ Vehicle  │ Status        │');
    console.log('├──────────────────┼───────────┼──────────┼──────────┼───────────────┤');
    console.log('│ RD202401010001   │ Rahul     │ Amit     │ Car      │ Completed ⏳  │');
    console.log('│ RD202401010002   │ Priya     │ Sunil    │ Auto     │ Completed ⏳  │');
    console.log('│ RD202401010003   │ Rahul     │ Amit     │ Bike     │ In Progress 🚙│');
    console.log('│ RD202401010004   │ Priya     │ -        │ Car      │ Requested ⭐  │');
    console.log('└──────────────────┴───────────┴──────────┴──────────┴───────────────┘');
    
    console.log('\n💡 Next Steps:');
    console.log('   1. Login: POST /auth/signin with phone number');
    console.log('   2. Use OTP: 123456 (in test mode)');
    console.log('   3. Test Payment APIs with seeded rides');
    console.log('   4. Rahul has ₹500 wallet balance for testing');
    console.log('   5. Priya has ₹0 balance (test wallet recharge flow)');
    console.log('');
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    client.release();
  }
}

// Run if called directly
seedData().then(() => {
  logger.info('✅ Seeding completed successfully');
  process.exit(0);
}).catch((err) => {
  logger.error('❌ Seeding failed:', err);
  process.exit(1);
});
