#!/usr/bin/env node
/**
 * Quick script to query rides from database
 * Usage: node scripts/queryRides.js
 */

import { db } from '../src/infrastructure/database/postgres.js';

async function queryRides() {
  try {
    // Initialize database connection
    await db.connect();
    const client = await db.getClient();
    
    console.log('🚗 Querying Rides from Database');
    console.log('=====================================\n');
    
    // Query rides with basic info
    const result = await client.query(`
      SELECT 
        id,
        ride_number,
        passenger_id,
        driver_id,
        vehicle_type,
        status,
        payment_status,
        payment_method,
        final_fare,
        created_at,
        requested_at,
        completed_at
      FROM rides 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No rides found in database');
      console.log('\n💡 Run seed script first:');
      console.log('   npm run seed');
      console.log('   node scripts/seedTestData.js');
    } else {
      console.log('📋 Recent Rides:');
      console.table(result.rows);
      
      console.log('\n🎯 Ride IDs for Testing:');
      result.rows.forEach((ride, index) => {
        console.log(`   ${index + 1}. Ride ID: ${ride.id} | ${ride.ride_number} | ${ride.status} | ${ride.final_fare ? '₹' + ride.final_fare : 'N/A'}`);
      });
      
      console.log('\n📝 Quick Copy:');
      console.log('   Rahul\'s completed ride ID:', result.rows.find(r => r.ride_number === 'RD202401010001')?.id);
      console.log('   Priya\'s completed ride ID:', result.rows.find(r => r.ride_number === 'RD202401010002')?.id);
      console.log('   Rahul\'s active ride ID:', result.rows.find(r => r.ride_number === 'RD202401010003')?.id);
      console.log('   Priya\'s requested ride ID:', result.rows.find(r => r.ride_number === 'RD202401010004')?.id);
    }
    
    console.log('\n✅ Query completed');
    
  } catch (error) {
    console.error('❌ Database query failed:', error.message);
  } finally {
    process.exit(0);
  }
}

// Run the query
queryRides();
