import { db } from '../src/infrastructure/database/postgres.js';

// ─── Test credentials ─────────────────────────────────────────────────────────
// Login flow: POST /api/v1/auth/send-otp  { phone, role }
//             → response.data.otp  (OTP directly milega)
//             POST /api/v1/auth/verify-otp { phone, otp, role }
//             → accessToken + refreshToken
//
// Passengers  (role: "passenger")
//   9100000001 — Rahul Sharma
//   9100000002 — Priya Verma
//   9100000003 — Amit Singh
//
// Drivers  (role: "driver")  — fully KYC verified, can go online
//   9200000001 — Suresh Kumar
//   9200000002 — Ramesh Yadav
//   9200000003 — Vikram Patel

const PASSENGERS = [
    { phone: '9100000001', name: 'Rahul Sharma',  email: 'rahul.test@gomobility.dev' },
    { phone: '9100000002', name: 'Priya Verma',   email: 'priya.test@gomobility.dev' },
    { phone: '9100000003', name: 'Amit Singh',    email: 'amit.test@gomobility.dev' },
];

const DRIVERS = [
    { phone: '9200000001', name: 'Suresh Kumar',  email: 'suresh.driver@gomobility.dev' },
    { phone: '9200000002', name: 'Ramesh Yadav',  email: 'ramesh.driver@gomobility.dev' },
    { phone: '9200000003', name: 'Vikram Patel',  email: 'vikram.driver@gomobility.dev' },
];

// ─── KYC extracted_data templates ────────────────────────────────────────────

const kycData = (name, index) => {
    const pan    = ['ABCDE1234F', 'FGHIJ5678K', 'KLMNO9012P'][index];
    const aadhaarLast = ['5678', '1234', '9012'][index];
    const dlNum  = ['DL0120200123456', 'MH0220210234567', 'UP3220220345678'][index];
    const rcNum  = ['DL01CA1234', 'MH02CB5678', 'UP32CC9012'][index];
    const acct   = ['001234567890', '009876543210', '005555666677'][index];
    const ifsc   = ['SBIN0001234', 'HDFC0005678', 'ICIC0009012'][index];

    return {
        AADHAAR: {
            name,
            dob:     '1995-06-15',
            gender:  'M',
            state:   'Delhi',
            address: '123, Test Colony, New Delhi - 110001',
            pin_code: '110001',
            district: 'New Delhi',
            masked:  `XXXX XXXX ${aadhaarLast}`,
        },
        PAN: {
            name,
            father:              'Test Father Name',
            dob:                 '1995-06-15',
            masked:              `${pan.slice(0,3)}XXXXX${pan.slice(-1)}`,
            govt_verified:       true,
            pan_status:          'E',
            name_match:          'Y',
            dob_match:           'Y',
            aadhaar_linked:      true,
            aadhaar_seeding_desc:'Aadhaar is linked to PAN',
        },
        DRIVING_LICENCE: {
            name,
            dob:               '1995-06-15',
            blood_group:       'B+',
            address:           '123, Test Colony, New Delhi - 110001',
            issue_date:        '2018-01-10',
            expiry_date:       '2038-01-09',
            masked:            `XXXX${dlNum.slice(-4)}`,
            govt_verified:     true,
            dl_status:         'ACTIVE',
            issuing_authority: 'DTO New Delhi',
        },
        VEHICLE_RC: {
            owner:                 name,
            vehicle_model:         'BAJAJ PULSAR NS 200',
            vehicle_type:          'M-Cycle/Scooter',
            manufacturer:          'BAJAJ AUTO LTD',
            manufacturing_date:    '2023-04',
            registration_date:     '2023-05-10',
            registration_validity: '2038-05-09',
            chassis_number:        `CHASSIS${index}TEST12345`,
            engine_number:         `ENGINE${index}TEST678`,
            address:               '123, Test Colony, New Delhi - 110001',
            insurance_expiry:      null,
            fitness_expiry:        null,
            permit_expiry:         null,
            vahan_verified:        false,
            masked:                rcNum,
        },
        BANK_ACCOUNT: {
            account_masked:      `XXXX${acct.slice(-4)}`,
            ifsc:                ifsc,
            holder_name:         name,
            bank_name:           ['State Bank of India', 'HDFC Bank', 'ICICI Bank'][index],
            branch:              'Main Branch',
            city:                'New Delhi',
            account_status:      'VALID',
            name_match_result:   'MATCH',
            name_match_score:    95,
        },
        SELFIE: {
            similarity_score: 92,
        },
    };
};

// ─── Main seed ────────────────────────────────────────────────────────────────

async function seed() {
    await db.connect();
    console.log('🌱 Starting seed...\n');

    // ── Passengers ────────────────────────────────────────────────────────────
    console.log('👤 Creating passengers...');
    for (const p of PASSENGERS) {
        const { rows } = await db.query(
            `INSERT INTO users (phone_number, email, full_name, role, is_verified, is_active)
             VALUES ($1, $2, $3, 'passenger', true, true)
             ON CONFLICT (phone_number, role) DO UPDATE
               SET full_name = EXCLUDED.full_name, is_verified = true
             RETURNING id`,
            [p.phone, p.email, p.name]
        );
        const userId = rows[0].id;

        await db.query(
            `INSERT INTO wallets (user_id, balance, total_credited)
             VALUES ($1, 500.00, 500.00)
             ON CONFLICT (user_id) DO NOTHING`,
            [userId]
        );
        console.log(`  ✅ ${p.name} (${p.phone}) — id: ${userId}`);
    }

    // ── Drivers ───────────────────────────────────────────────────────────────
    console.log('\n🚗 Creating drivers...');
    for (let i = 0; i < DRIVERS.length; i++) {
        const d = DRIVERS[i];

        const { rows: uRows } = await db.query(
            `INSERT INTO users (phone_number, email, full_name, role, is_verified, is_active)
             VALUES ($1, $2, $3, 'driver', true, true)
             ON CONFLICT (phone_number, role) DO UPDATE
               SET full_name = EXCLUDED.full_name, is_verified = true
             RETURNING id`,
            [d.phone, d.email, d.name]
        );
        const userId = uRows[0].id;

        // Driver profile
        await db.query(
            `INSERT INTO drivers (user_id, is_verified, is_available, current_latitude, current_longitude, rating)
             VALUES ($1, true, true, 28.6139, 77.2090, 4.5)
             ON CONFLICT (user_id) DO UPDATE
               SET is_verified = true, is_available = true`,
            [userId]
        );

        // Wallet
        await db.query(
            `INSERT INTO wallets (user_id, balance, total_credited)
             VALUES ($1, 1000.00, 1000.00)
             ON CONFLICT (user_id) DO NOTHING`,
            [userId]
        );

        // KYC documents — all auto_verified
        const data = kycData(d.name, i);
        const docTypes = [
            { type: 'AADHAAR',          method: 'OCR',        hash: `hash_aadhaar_${i}` },
            { type: 'PAN',              method: 'OCR',        hash: `hash_pan_${i}` },
            { type: 'DRIVING_LICENCE',  method: 'OCR',        hash: `hash_dl_${i}` },
            { type: 'VEHICLE_RC',       method: 'OCR',        hash: `hash_rc_${i}` },
            { type: 'BANK_ACCOUNT',     method: 'PENNY_DROP', hash: `hash_bank_${i}` },
            { type: 'SELFIE',           method: 'FACE_MATCH', hash: null },
        ];

        for (const doc of docTypes) {
            await db.query(
                `INSERT INTO kyc_documents
                   (user_id, document_type, method, status, extracted_data,
                    confidence_score, fraud_score, document_number, document_hash,
                    file_url, attempt_count, verified_at)
                 VALUES ($1,$2,$3,'auto_verified',$4,100,0,$5,$6,
                         'https://go-mobility-kyc.s3.ap-south-1.amazonaws.com/seed/placeholder.jpg',
                         1, NOW())
                 ON CONFLICT (user_id, document_type) DO UPDATE
                   SET status = 'auto_verified', verified_at = NOW()`,
                [
                    userId,
                    doc.type,
                    doc.method,
                    JSON.stringify(data[doc.type]),
                    doc.type.slice(0, 4).toLowerCase() + '_seed',
                    doc.hash,
                ]
            );
        }

        // driver_kyc_status — verified
        await db.query(
            `INSERT INTO driver_kyc_status
               (user_id, overall_status, submitted_docs_count, verified_docs_count,
                last_activity_at, verified_at)
             VALUES ($1, 'verified', 6, 6, NOW(), NOW())
             ON CONFLICT (user_id) DO UPDATE
               SET overall_status = 'verified', verified_docs_count = 6,
                   submitted_docs_count = 6, verified_at = NOW()`,
            [userId]
        );

        console.log(`  ✅ ${d.name} (${d.phone}) — id: ${userId}`);
    }

    console.log('\n─────────────────────────────────────────────');
    console.log('✅ Seed complete!\n');
    console.log('📱 LOGIN CREDENTIALS\n');
    console.log('PASSENGERS (role: passenger)');
    PASSENGERS.forEach(p => console.log(`  ${p.phone}  —  ${p.name}`));
    console.log('\nDRIVERS (role: driver) — KYC fully verified');
    DRIVERS.forEach(d => console.log(`  ${d.phone}  —  ${d.name}`));
    console.log('\n📋 HOW TO LOGIN:');
    console.log('  1. POST /api/v1/auth/send-otp    body: { phone, role }');
    console.log('  2. Check response.data.otp       (OTP directly milega)');
    console.log('  3. POST /api/v1/auth/verify-otp  body: { phone, otp, role }');
    console.log('  4. Use accessToken in header:    Authorization: Bearer <token>');
    console.log('─────────────────────────────────────────────\n');
}

seed()
    .then(() => { db.disconnect?.(); process.exit(0); })
    .catch(err => { console.error('❌ Seed failed:', err); process.exit(1); });
