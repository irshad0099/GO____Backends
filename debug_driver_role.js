import { db } from './src/infrastructure/database/postgres.js';
import { verifyToken } from './src/modules/auth/services/tokenService.js';

async function debugDriverRole() {
  try {
    await db.connect();
    
    // Test the latest token from our previous check
    const testToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjM2Q0ZTVmNi1hN2I4LTkwMTItY2RlZi0xMjM0NTY3ODkwMTIiLCJwaG9uZSI6Ijk4NzY1NDMyMTIiLCJyb2xlIjoiZHJpdmVyIiwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTc3ODUwMDg4NCwiZXhwIjoxNzc4NTAxNzg0fQ.T9zqKRACf8kl_Wd95W9pIAQduFJgkZ-vxMzRrF6TLjM";
    
    console.log('Testing driver role and permissions...');
    
    // Verify token
    let decoded;
    try {
      decoded = verifyToken(testToken);
      console.log('✅ Token is valid');
      console.log('User ID:', decoded.userId);
      console.log('Phone:', decoded.phone);
      console.log('Role:', decoded.role);
      console.log('Type:', decoded.type);
    } catch (err) {
      console.log('❌ Token invalid:', err.message);
      return;
    }
    
    // Get user details from database
    const userResult = await db.query(
      'SELECT id, phone_number, full_name, role, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );
    
    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      console.log('\n✅ User found in database:');
      console.log('ID:', user.id);
      console.log('Phone:', user.phone_number);
      console.log('Name:', user.full_name);
      console.log('Role:', user.role);
      console.log('Active:', user.is_active);
      
      // Check if user has driver profile
      const driverResult = await db.query(
        'SELECT id, user_id, status FROM drivers WHERE user_id = $1',
        [decoded.userId]
      );
      
      if (driverResult.rows.length > 0) {
        const driver = driverResult.rows[0];
        console.log('\n✅ Driver profile found:');
        console.log('Driver ID:', driver.id);
        console.log('Status:', driver.status);
      } else {
        console.log('\n❌ No driver profile found');
      }
      
      // Test role matching
      console.log('\n🔍 Role Authorization Test:');
      console.log('Token role:', decoded.role);
      console.log('Required role: driver');
      console.log('Match:', decoded.role === 'driver');
      
    } else {
      console.log('❌ User not found in database');
    }
    
    await db.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugDriverRole();
