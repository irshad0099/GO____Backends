import { db } from '../src/infrastructure/database/postgres.js';

async function seedAdmins() {
    await db.connect();
    console.log('🔐 Seeding admin accounts...\n');

    // Step 1: Add super_admin to role CHECK constraint
    await db.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
    await db.query(`
        ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN ('passenger', 'driver', 'admin', 'super_admin'))
    `);
    console.log('✅ Role constraint updated (super_admin added)\n');

    // Step 2: Super Admin — ag244834@gmail.com
    const { rows: saRows } = await db.query(`
        INSERT INTO users (phone_number, email, full_name, role, is_verified, is_active)
        VALUES ('0000000001', 'ag244834@gmail.com', 'GoMobility Super Admin', 'super_admin', true, true)
        ON CONFLICT (email, role) DO UPDATE
            SET full_name = EXCLUDED.full_name, is_active = true, is_verified = true
        RETURNING id, email, full_name, role
    `);
    console.log('✅ Super Admin created:');
    console.log(`   ID    : ${saRows[0].id}`);
    console.log(`   Name  : ${saRows[0].full_name}`);
    console.log(`   Email : ${saRows[0].email}`);
    console.log(`   Role  : ${saRows[0].role}\n`);

    // Step 3: Admin — admin@gomobility.co.in
    const { rows: aRows } = await db.query(`
        INSERT INTO users (phone_number, email, full_name, role, is_verified, is_active)
        VALUES ('0000000002', 'admin@gomobility.co.in', 'GoMobility Admin', 'admin', true, true)
        ON CONFLICT (email, role) DO UPDATE
            SET full_name = EXCLUDED.full_name, is_active = true, is_verified = true
        RETURNING id, email, full_name, role
    `);
    console.log('✅ Admin created:');
    console.log(`   ID    : ${aRows[0].id}`);
    console.log(`   Name  : ${aRows[0].full_name}`);
    console.log(`   Email : ${aRows[0].email}`);
    console.log(`   Role  : ${aRows[0].role}\n`);

    console.log('─────────────────────────────────────────────');
    console.log('✅ Admin seeding complete!\n');
    console.log('📋 LOGIN (OTP-based — use phone number):');
    console.log('  Super Admin phone : 0000000001');
    console.log('  Admin phone       : 0000000002');
    console.log('  POST /api/v1/auth/send-otp   { phone, role }');
    console.log('  POST /api/v1/auth/verify-otp { phone, otp, role }');
    console.log('─────────────────────────────────────────────\n');
}

seedAdmins()
    .then(() => { db.disconnect?.(); process.exit(0); })
    .catch(err => { console.error('❌ Failed:', err.message); process.exit(1); });
