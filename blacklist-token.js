import redis from 'redis';
import jwt from 'jsonwebtoken';

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJiOWY4ZDc5NS01NjM5LTQyMDMtYTE0ZS1mODA5YTlkNTc1OGQiLCJpZCI6ImI5ZjhkNzk1LTU2MzktNDIwMy1hMTRlLWY4MDlhOWQ1NzU4ZCIsInBob25lIjoiOTg3NjU0MzIxMCIsInJvbGUiOiJkcml2ZXIiLCJ0eXBlIjoiYWNjZXNzIiwiaWF0IjoxNzc5MTI2MjYwLCJleHAiOjE3Nzk3MzEwNjB9.izDFKH7-ZpeVm3Z2JHTz4oXWeu1y82XNnx9mAnbeuD0';

const client = redis.createClient({
  url: 'rediss://default:mP2yCEgi6eAaeEPJBWdgG96JlvjNDGwI@redis-14630.c301.ap-south-1-1.ec2.cloud.redislabs.com:14630',
  socket: {
    tls: true,
    rejectUnauthorized: false
  }
});

client.connect().then(async () => {
  try {
    console.log('🔗 Connected to production Redis...');

    // Decode token to get expiry
    const decoded = jwt.decode(token);
    const remaining = decoded.exp - Math.floor(Date.now() / 1000);

    console.log('📋 Token Details:');
    console.log('   User ID:', decoded.userId);
    console.log('   Phone:', decoded.phone);
    console.log('   Role:', decoded.role);
    console.log('   Expires in:', remaining, 'seconds');

    // Blacklist token
    await client.setEx(`blacklist:${token}`, remaining > 0 ? remaining : 604800, '1');

    console.log('✓ Token blacklisted successfully!');
    console.log('   TTL:', remaining > 0 ? remaining + ' seconds' : '7 days');

    // Verify blacklist
    const check = await client.get(`blacklist:${token}`);
    if (check === '1') {
      console.log('✓ Verification: Token is now blacklisted in Redis');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
});
