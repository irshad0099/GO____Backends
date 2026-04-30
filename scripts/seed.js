import { db } from '../src/infrastructure/database/postgres.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────
let _seq = 0;
const next  = () => String(++_seq).padStart(4, '0');
const rNum  = () => `SEED-R${next()}`;
const tNum  = () => `SEED-T${next()}`;
const iNum  = () => `SEED-INV${next()}`;
const tktNum = () => `SEED-TKT${next()}`;
const ago   = (d, h = 0) => new Date(Date.now() - d * 86_400_000 - h * 3_600_000);

// ─── Static master data ───────────────────────────────────────────────────────
const PASSENGERS = [
    { phone: '9100000001', name: 'Rahul Sharma', email: 'rahul.test@gomobility.dev' },
    { phone: '9100000002', name: 'Priya Verma',  email: 'priya.test@gomobility.dev' },
    { phone: '9100000003', name: 'Amit Singh',   email: 'amit.test@gomobility.dev' },
];

const DRIVERS = [
    { phone: '9200000001', name: 'Suresh Kumar', email: 'suresh.driver@gomobility.dev' },
    { phone: '9200000002', name: 'Ramesh Yadav', email: 'ramesh.driver@gomobility.dev' },
    { phone: '9200000003', name: 'Vikram Patel', email: 'vikram.driver@gomobility.dev' },
];

// ─── KYC extracted_data templates ─────────────────────────────────────────────
const kycData = (name, index) => {
    const pan         = ['ABCDE1234F', 'FGHIJ5678K', 'KLMNO9012P'][index];
    const aadhaarLast = ['5678', '1234', '9012'][index];
    const dlNum       = ['DL0120200123456', 'MH0220210234567', 'UP3220220345678'][index];
    const rcNum       = ['DL01CA1234', 'MH02CB5678', 'UP32CC9012'][index];
    const acct        = ['001234567890', '009876543210', '005555666677'][index];
    const ifsc        = ['SBIN0001234', 'HDFC0005678', 'ICIC0009012'][index];
    return {
        AADHAAR: { name, dob: '1995-06-15', gender: 'M', state: 'Delhi', address: '123, Test Colony, New Delhi - 110001', pin_code: '110001', district: 'New Delhi', masked: `XXXX XXXX ${aadhaarLast}` },
        PAN: { name, father: 'Test Father Name', dob: '1995-06-15', masked: `${pan.slice(0,3)}XXXXX${pan.slice(-1)}`, govt_verified: true, pan_status: 'E', name_match: 'Y', dob_match: 'Y', aadhaar_linked: true, aadhaar_seeding_desc: 'Aadhaar is linked to PAN' },
        DRIVING_LICENCE: { name, dob: '1995-06-15', blood_group: 'B+', address: '123, Test Colony, New Delhi - 110001', issue_date: '2018-01-10', expiry_date: '2038-01-09', masked: `XXXX${dlNum.slice(-4)}`, govt_verified: true, dl_status: 'ACTIVE', issuing_authority: 'DTO New Delhi' },
        VEHICLE_RC: { owner: name, vehicle_model: 'BAJAJ PULSAR NS 200', vehicle_type: 'M-Cycle/Scooter', manufacturer: 'BAJAJ AUTO LTD', manufacturing_date: '2023-04', registration_date: '2023-05-10', registration_validity: '2038-05-09', chassis_number: `CHASSIS${index}TEST12345`, engine_number: `ENGINE${index}TEST678`, address: '123, Test Colony, New Delhi - 110001', insurance_expiry: null, fitness_expiry: null, permit_expiry: null, vahan_verified: false, masked: rcNum },
        BANK_ACCOUNT: { account_masked: `XXXX${acct.slice(-4)}`, ifsc, holder_name: name, bank_name: ['State Bank of India', 'HDFC Bank', 'ICICI Bank'][index], branch: 'Main Branch', city: 'New Delhi', account_status: 'VALID', name_match_result: 'MATCH', name_match_score: 95 },
        SELFIE: { similarity_score: 92 },
    };
};

// ─── Delhi locations ──────────────────────────────────────────────────────────
const L = [
    { name: 'Connaught Place',  lat: 28.6315, lng: 77.2167, addr: 'Connaught Place, New Delhi 110001' },
    { name: 'Karol Bagh',       lat: 28.6519, lng: 77.1892, addr: 'Karol Bagh, New Delhi 110005' },
    { name: 'Lajpat Nagar',     lat: 28.5672, lng: 77.2431, addr: 'Lajpat Nagar, New Delhi 110024' },
    { name: 'Saket',            lat: 28.5244, lng: 77.2066, addr: 'Saket, New Delhi 110017' },
    { name: 'Dwarka Sector 10', lat: 28.5796, lng: 77.0491, addr: 'Dwarka Sector 10, New Delhi 110075' },
    { name: 'India Gate',       lat: 28.6129, lng: 77.2295, addr: 'India Gate, New Delhi 110001' },
    { name: 'AIIMS',            lat: 28.5672, lng: 77.2100, addr: 'AIIMS Ansari Nagar, New Delhi 110029' },
    { name: 'Nehru Place',      lat: 28.5477, lng: 77.2519, addr: 'Nehru Place, New Delhi 110019' },
    { name: 'Rohini Sector 3',  lat: 28.7275, lng: 77.1110, addr: 'Rohini Sector 3, New Delhi 110085' },
    { name: 'Vasant Kunj',      lat: 28.5190, lng: 77.1587, addr: 'Vasant Kunj, New Delhi 110070' },
    { name: 'Greater Kailash',  lat: 28.5358, lng: 77.2507, addr: 'Greater Kailash I, New Delhi 110048' },
    { name: 'Janakpuri',        lat: 28.6300, lng: 77.0827, addr: 'Janakpuri, New Delhi 110058' },
];

// ─── Main seed ────────────────────────────────────────────────────────────────
async function seed() {
    await db.connect();
    console.log('🌱 Starting comprehensive seed…\n');

    // ── 0. Clean previous seed data ───────────────────────────────────────────
    console.log('🧹 Cleaning old seed data…');
    await db.query(`DELETE FROM notifications          WHERE title LIKE '[SEED]%'`);
    await db.query(`DELETE FROM support_messages       WHERE message LIKE '%[SEED]%'`);
    await db.query(`DELETE FROM support_tickets        WHERE ticket_number LIKE 'SEED-%'`);
    await db.query(`DELETE FROM coupon_usages          WHERE coupon_id IN (SELECT id FROM coupons WHERE code LIKE 'SEED%')`);
    await db.query(`DELETE FROM reviews                WHERE ride_id IN (SELECT id FROM rides WHERE ride_number LIKE 'SEED-%')`);
    await db.query(`DELETE FROM ride_invoices          WHERE ride_id IN (SELECT id FROM rides WHERE ride_number LIKE 'SEED-%')`);
    await db.query(`DELETE FROM ride_cancellations     WHERE ride_id IN (SELECT id FROM rides WHERE ride_number LIKE 'SEED-%')`);
    await db.query(`DELETE FROM transactions           WHERE transaction_number LIKE 'SEED-%'`);
    await db.query(`DELETE FROM rides                  WHERE ride_number LIKE 'SEED-%'`);
    await db.query(`DELETE FROM coupons                WHERE code LIKE 'SEED%'`);
    await db.query(`DELETE FROM saved_addresses        WHERE landmark = 'SEED'`);
    await db.query(`DELETE FROM emergency_contacts     WHERE phone LIKE '9911%' OR phone LIKE '9922%'`);
    await db.query(`DELETE FROM referral_codes         WHERE code LIKE 'SEED%'`);
    await db.query(`DELETE FROM subscription_payments  WHERE user_id IN (SELECT id FROM users WHERE phone_number LIKE '910000000%')`);
    await db.query(`DELETE FROM user_subscriptions     WHERE user_id IN (SELECT id FROM users WHERE phone_number LIKE '910000000%')`);
    await db.query(`DELETE FROM driver_incentive_progress WHERE incentive_plan_id IN (SELECT id FROM incentive_plans WHERE title LIKE '[SEED]%')`);
    await db.query(`DELETE FROM incentive_plans        WHERE title LIKE '[SEED]%'`);
    console.log('  ✅ Done\n');

    // ── 1. Passengers ──────────────────────────────────────────────────────────
    console.log('👤 Creating passengers…');
    const pIds = [];   // UUID
    const pWalletIds = [];
    for (const p of PASSENGERS) {
        const { rows } = await db.query(
            `INSERT INTO users (phone_number, email, full_name, role, is_verified, is_active)
             VALUES ($1, $2, $3, 'passenger', true, true)
             ON CONFLICT (phone_number, role) DO UPDATE SET full_name = EXCLUDED.full_name, is_verified = true
             RETURNING id`,
            [p.phone, p.email, p.name]
        );
        const uid = rows[0].id;
        pIds.push(uid);

        const { rows: wRows } = await db.query(
            `INSERT INTO wallets (user_id, balance, total_credited)
             VALUES ($1, 2000.00, 2000.00)
             ON CONFLICT (user_id) DO UPDATE SET balance = GREATEST(wallets.balance, 2000.00), total_credited = GREATEST(wallets.total_credited, 2000.00)
             RETURNING id`,
            [uid]
        );
        pWalletIds.push(wRows[0].id);
        console.log(`  ✅ ${p.name} — ${uid}`);
    }

    // ── 2. Drivers ────────────────────────────────────────────────────────────
    console.log('\n🚗 Creating drivers…');
    const dUids   = [];   // UUID (users.id)
    const dIds    = [];   // INTEGER (drivers.id)
    const dWalletIds = [];
    const driverLats = [28.6150, 28.6300, 28.5900];
    const driverLngs = [77.2100, 77.2250, 77.2050];

    for (let i = 0; i < DRIVERS.length; i++) {
        const d = DRIVERS[i];

        const { rows: uRows } = await db.query(
            `INSERT INTO users (phone_number, email, full_name, role, is_verified, is_active)
             VALUES ($1, $2, $3, 'driver', true, true)
             ON CONFLICT (phone_number, role) DO UPDATE SET full_name = EXCLUDED.full_name, is_verified = true
             RETURNING id`,
            [d.phone, d.email, d.name]
        );
        const uid = uRows[0].id;
        dUids.push(uid);

        const { rows: dRows } = await db.query(
            `INSERT INTO drivers (user_id, is_verified, is_available, current_latitude, current_longitude, rating, total_rides, total_earnings, city, subscription_status)
             VALUES ($1, true, true, $2, $3, 4.5, 0, 0, 'Delhi', 'inactive')
             ON CONFLICT (user_id) DO UPDATE
               SET is_verified = true, is_available = true, current_latitude = $2, current_longitude = $3
             RETURNING id`,
            [uid, driverLats[i], driverLngs[i]]
        );
        dIds.push(dRows[0].id);

        const { rows: wRows } = await db.query(
            `INSERT INTO wallets (user_id, balance, total_credited)
             VALUES ($1, 5000.00, 5000.00)
             ON CONFLICT (user_id) DO UPDATE SET balance = GREATEST(wallets.balance, 5000.00), total_credited = GREATEST(wallets.total_credited, 5000.00)
             RETURNING id`,
            [uid]
        );
        dWalletIds.push(wRows[0].id);

        // KYC documents
        const data = kycData(d.name, i);
        const docTypes = [
            { type: 'AADHAAR',         method: 'OCR',        hash: `hash_aadhaar_${i}` },
            { type: 'PAN',             method: 'OCR',        hash: `hash_pan_${i}` },
            { type: 'DRIVING_LICENCE', method: 'OCR',        hash: `hash_dl_${i}` },
            { type: 'VEHICLE_RC',      method: 'OCR',        hash: `hash_rc_${i}` },
            { type: 'BANK_ACCOUNT',    method: 'PENNY_DROP', hash: `hash_bank_${i}` },
            { type: 'SELFIE',          method: 'FACE_MATCH', hash: null },
        ];
        for (const doc of docTypes) {
            await db.query(
                `INSERT INTO kyc_documents
                   (user_id, document_type, method, status, extracted_data, confidence_score, fraud_score, document_number, document_hash, file_url, attempt_count, verified_at)
                 VALUES ($1,$2,$3,'auto_verified',$4,100,0,$5,$6,
                         'https://go-mobility-kyc.s3.ap-south-1.amazonaws.com/seed/placeholder.jpg',
                         1, NOW())
                 ON CONFLICT (user_id, document_type) DO UPDATE SET status = 'auto_verified', verified_at = NOW()`,
                [uid, doc.type, doc.method, JSON.stringify(data[doc.type]),
                 doc.type.slice(0, 4).toLowerCase() + '_seed', doc.hash]
            );
        }

        await db.query(
            `INSERT INTO driver_kyc_status (user_id, overall_status, submitted_docs_count, verified_docs_count, last_activity_at, verified_at)
             VALUES ($1, 'verified', 6, 6, NOW(), NOW())
             ON CONFLICT (user_id) DO UPDATE SET overall_status = 'verified', verified_docs_count = 6, submitted_docs_count = 6, verified_at = NOW()`,
            [uid]
        );
        console.log(`  ✅ ${d.name} — uid:${uid}  driver_id:${dIds[i]}`);
    }

    // ── 3. Driver vehicles ────────────────────────────────────────────────────
    console.log('\n🏍️  Creating driver vehicles…');
    const vehicles = [
        { type: 'bike', model: 'Honda Activa 6G',     color: 'Pearl Igneous Black', rc: 'DL5SBZ1234',  num: 'DL 5S BZ 1234',  owner: DRIVERS[0].name, policy: 'POL00123456', provider: 'ICICI Lombard',       ins_until: '2026-05-31' },
        { type: 'auto', model: 'Bajaj RE 4S CNG',     color: 'Yellow',              rc: 'DL1RT9876',   num: 'DL 1R T 9876',   owner: DRIVERS[1].name, policy: 'POL00789012', provider: 'New India Assurance', ins_until: '2026-08-15' },
        { type: 'car',  model: 'Maruti Suzuki Swift',  color: 'Solid White',         rc: 'DL3CAB5678',  num: 'DL 3C AB 5678',  owner: DRIVERS[2].name, policy: 'POL00345678', provider: 'HDFC ERGO',           ins_until: '2026-11-30' },
    ];
    const PLACEHOLDER = 'https://go-mobility-kyc.s3.ap-south-1.amazonaws.com/seed/placeholder.jpg';
    for (let i = 0; i < DRIVERS.length; i++) {
        const v = vehicles[i];
        await db.query(
            `INSERT INTO driver_vehicle
               (driver_id, vehicle_type, vehicle_model, vehicle_color, rc_number, vehicle_number, owner_name,
                rc_front, rc_back, policy_number, insurance_provider, insurance_valid_until,
                insurance_front, insurance_back, verification_status, verified_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$10,$11,$8,$8,'verified',NOW())
             ON CONFLICT (driver_id) DO UPDATE
               SET vehicle_type = EXCLUDED.vehicle_type, vehicle_model = EXCLUDED.vehicle_model, verification_status = 'verified'`,
            [dIds[i], v.type, v.model, v.color, v.rc, v.num, v.owner,
             PLACEHOLDER, v.policy, v.provider, v.ins_until]
        );
        console.log(`  ✅ ${DRIVERS[i].name} → ${v.model} (${v.num})`);
    }

    // ── 4. Completed rides ────────────────────────────────────────────────────
    console.log('\n🛣️  Creating rides…');

    /*
      Ride plan:
        R01–R08: completed  (varied passengers, drivers, vehicle types, payment methods)
        R09–R10: cancelled
        R11:     in_progress
        R12:     driver_arrived
        R13:     driver_assigned
        R14:     requested (no driver)
    */

    // [pIdx, dIdx, vType, pickLoc, dropLoc, km, min, baseFare, distFare, timeFare, finalFare, surgeMulti, method, daysAgo, hoursAgo, tip, coupon]
    const completedPlan = [
        [0, 0, 'bike', 0, 6, 5.2,  18, 25, 41.6,  9.0,  82,   1.0,  'wallet',  7, 0, 0,   null],
        [0, 1, 'auto', 1, 7, 7.8,  26, 40, 93.6,  13.0, 152,  1.0,  'cash',    5, 0, 10,  null],
        [1, 0, 'car',  2, 8, 11.5, 35, 50, 161.0, 17.5, 278,  1.2,  'upi',     4, 0, 20,  null],
        [1, 2, 'bike', 3, 0, 3.8,  14, 25, 30.4,  7.0,  68,   1.0,  'wallet',  3, 0, 0,   null],
        [2, 1, 'auto', 4, 5, 6.2,  22, 40, 74.4,  11.0, 132,  1.0,  'cash',    2, 0, 5,   null],
        [2, 2, 'car',  5, 9, 14.2, 42, 50, 198.8, 21.0, 328,  1.1,  'upi',     1, 0, 30,  null],
        [0, 2, 'bike', 6, 2, 4.1,  15, 25, 32.8,  7.5,  74,   1.0,  'wallet',  0, 12, 0,  null],
        [1, 0, 'auto', 7, 3, 9.5,  31, 40, 114.0, 15.5, 185,  1.0,  'cash',    0, 6,  15, null],
    ];

    const completedRideIds = [];
    const completedRideData = [];

    for (const r of completedPlan) {
        const [pI, dI, vType, pickI, dropI, km, min, base, dist, timeFare, final, surge, method, dAgo, hAgo, tip] = r;
        const reqAt    = ago(dAgo, hAgo + 0.5);
        const asgnAt   = ago(dAgo, hAgo + 0.4);
        const arrivedAt = ago(dAgo, hAgo + 0.3);
        const startAt  = ago(dAgo, hAgo + 0.2);
        const compAt   = ago(dAgo, hAgo);
        const rn = rNum();

        const { rows } = await db.query(
            `INSERT INTO rides
               (ride_number, passenger_id, driver_id, vehicle_type,
                pickup_latitude, pickup_longitude, pickup_address, pickup_location_name,
                dropoff_latitude, dropoff_longitude, dropoff_address, dropoff_location_name,
                distance_km, duration_minutes,
                base_fare, distance_fare, time_fare, surge_multiplier,
                estimated_fare, actual_fare, final_fare, tip_amount,
                status, payment_status, payment_method,
                requested_at, driver_assigned_at, driver_arrived_at, started_at, completed_at,
                ride_otp, invoice_generated, is_peak, convenience_fee)
             VALUES ($1,$2,$3,$4, $5,$6,$7,$8, $9,$10,$11,$12, $13,$14, $15,$16,$17,$18,
                     $19,$20,$21,$22, 'completed','paid',$23, $24,$25,$26,$27,$28,
                     $29, true, false, 10)
             RETURNING id`,
            [rn, pIds[pI], dIds[dI], vType,
             L[pickI].lat, L[pickI].lng, L[pickI].addr, L[pickI].name,
             L[dropI].lat, L[dropI].lng, L[dropI].addr, L[dropI].name,
             km, min, base, dist, timeFare, surge,
             final, final, final, tip,
             method, reqAt, asgnAt, arrivedAt, startAt, compAt,
             String(Math.floor(1000 + Math.random() * 9000))]
        );
        const rideId = rows[0].id;
        completedRideIds.push(rideId);
        completedRideData.push({ rideId, pI, dI, vType, km, min, final, tip, method, compAt, pickI, dropI });
        console.log(`  ✅ [completed] ${rn} — ${PASSENGERS[pI].name} → ${DRIVERS[dI].name} | ${vType} | ₹${final} | ${method}`);
    }

    // ── 5. Cancelled rides ────────────────────────────────────────────────────
    const cancelledPlan = [
        [0, 0, 'bike', 0, 6, 'passenger', 'changed_plan',          3, 0],
        [2, 1, 'auto', 4, 5, 'driver',    'vehicle_issue',         1, 4],
    ];
    const cancelledRideIds = [];
    for (const r of cancelledPlan) {
        const [pI, dI, vType, pickI, dropI, cancelBy, reason, dAgo, hAgo] = r;
        const reqAt    = ago(dAgo, hAgo + 0.5);
        const asgnAt   = ago(dAgo, hAgo + 0.3);
        const cancelAt = ago(dAgo, hAgo);
        const rn = rNum();
        const { rows } = await db.query(
            `INSERT INTO rides
               (ride_number, passenger_id, driver_id, vehicle_type,
                pickup_latitude, pickup_longitude, pickup_address, pickup_location_name,
                dropoff_latitude, dropoff_longitude, dropoff_address, dropoff_location_name,
                distance_km, duration_minutes,
                base_fare, distance_fare, time_fare,
                estimated_fare, final_fare,
                status, payment_status, payment_method,
                requested_at, driver_assigned_at, cancelled_at, cancelled_by, cancellation_reason)
             VALUES ($1,$2,$3,$4, $5,$6,$7,$8, $9,$10,$11,$12, $13,$14,
                     30,40,10,$15,$15,
                     'cancelled','pending','cash', $16,$17,$18,$19,$20)
             RETURNING id`,
            [rn, pIds[pI], dIds[dI], vType,
             L[pickI].lat, L[pickI].lng, L[pickI].addr, L[pickI].name,
             L[dropI].lat, L[dropI].lng, L[dropI].addr, L[dropI].name,
             5, 15, 80,
             reqAt, asgnAt, cancelAt, cancelBy, reason]
        );
        cancelledRideIds.push(rows[0].id);
        console.log(`  ✅ [cancelled]  ${rn} — cancelled_by:${cancelBy}`);
    }

    // ── 6. Active rides ───────────────────────────────────────────────────────
    // in_progress: P0 + D1
    const ipRn = rNum();
    const { rows: ipRows } = await db.query(
        `INSERT INTO rides
           (ride_number, passenger_id, driver_id, vehicle_type,
            pickup_latitude, pickup_longitude, pickup_address, pickup_location_name,
            dropoff_latitude, dropoff_longitude, dropoff_address, dropoff_location_name,
            distance_km, duration_minutes,
            base_fare, distance_fare, time_fare,
            estimated_fare, final_fare, surge_multiplier,
            status, payment_status, payment_method,
            requested_at, driver_assigned_at, driver_arrived_at, started_at,
            ride_otp, driver_current_latitude, driver_current_longitude)
         VALUES ($1,$2,$3,'auto', $4,$5,$6,$7, $8,$9,$10,$11, 8,25,
                 40,96,13,145,145,1.0,
                 'in_progress','pending','cash',
                 $12,$13,$14,$15,$16,$17,$18)
         RETURNING id`,
        [ipRn, pIds[0], dIds[1],
         L[0].lat, L[0].lng, L[0].addr, L[0].name,
         L[7].lat, L[7].lng, L[7].addr, L[7].name,
         ago(0,1), ago(0,0.8), ago(0,0.6), ago(0,0.5),
         '7823', 28.6200, 77.2130]
    );
    console.log(`  ✅ [in_progress] ${ipRn}`);

    // driver_arrived: P1 + D2
    const daRn = rNum();
    await db.query(
        `INSERT INTO rides
           (ride_number, passenger_id, driver_id, vehicle_type,
            pickup_latitude, pickup_longitude, pickup_address, pickup_location_name,
            dropoff_latitude, dropoff_longitude, dropoff_address, dropoff_location_name,
            distance_km, duration_minutes,
            base_fare, distance_fare, time_fare,
            estimated_fare, final_fare, surge_multiplier,
            status, payment_status, payment_method,
            requested_at, driver_assigned_at, driver_arrived_at,
            ride_otp, driver_current_latitude, driver_current_longitude)
         VALUES ($1,$2,$3,'car', $4,$5,$6,$7, $8,$9,$10,$11, 12,38,
                 50,168,19,290,290,1.0,
                 'driver_arrived','pending','wallet',
                 $12,$13,$14,$15,$16,$17)`,
        [daRn, pIds[1], dIds[2],
         L[3].lat, L[3].lng, L[3].addr, L[3].name,
         L[10].lat, L[10].lng, L[10].addr, L[10].name,
         ago(0,0.4), ago(0,0.25), ago(0,0.17),
         '3456', L[3].lat + 0.001, L[3].lng + 0.001]
    );
    console.log(`  ✅ [driver_arrived] ${daRn}`);

    // driver_assigned: P2 + D0
    const asnRn = rNum();
    await db.query(
        `INSERT INTO rides
           (ride_number, passenger_id, driver_id, vehicle_type,
            pickup_latitude, pickup_longitude, pickup_address, pickup_location_name,
            dropoff_latitude, dropoff_longitude, dropoff_address, dropoff_location_name,
            distance_km, duration_minutes,
            base_fare, distance_fare, time_fare,
            estimated_fare, final_fare, surge_multiplier,
            status, payment_status, payment_method,
            requested_at, driver_assigned_at,
            ride_otp, driver_current_latitude, driver_current_longitude)
         VALUES ($1,$2,$3,'bike', $4,$5,$6,$7, $8,$9,$10,$11, 4,14,
                 25,32,7,72,72,1.0,
                 'driver_assigned','pending','upi',
                 $12,$13,$14,$15,$16)`,
        [asnRn, pIds[2], dIds[0],
         L[1].lat, L[1].lng, L[1].addr, L[1].name,
         L[4].lat, L[4].lng, L[4].addr, L[4].name,
         ago(0, 0.1), ago(0, 0.08),
         '9241', driverLats[0], driverLngs[0]]
    );
    console.log(`  ✅ [driver_assigned] ${asnRn}`);

    // requested: P0, no driver
    const reqRn = rNum();
    await db.query(
        `INSERT INTO rides
           (ride_number, passenger_id, vehicle_type,
            pickup_latitude, pickup_longitude, pickup_address, pickup_location_name,
            dropoff_latitude, dropoff_longitude, dropoff_address, dropoff_location_name,
            distance_km, duration_minutes,
            base_fare, distance_fare, time_fare,
            estimated_fare, final_fare, surge_multiplier,
            status, payment_status, payment_method, requested_at)
         VALUES ($1,$2,'car', $3,$4,$5,$6, $7,$8,$9,$10, 10,32,
                 50,140,16,230,230,1.0,
                 'requested','pending','wallet',$11)`,
        [reqRn, pIds[0],
         L[8].lat, L[8].lng, L[8].addr, L[8].name,
         L[11].lat, L[11].lng, L[11].addr, L[11].name,
         ago(0, 0.03)]
    );
    console.log(`  ✅ [requested] ${reqRn}`);

    // ── 7. Ride cancellation records ──────────────────────────────────────────
    console.log('\n📋 Creating cancellation records…');
    const cancelDetails = [
        { cancelBy: 'passenger', reason: 'changed_plan',  statusAtCancel: 'driver_assigned', dist: 850 },
        { cancelBy: 'driver',    reason: 'vehicle_issue', statusAtCancel: 'driver_assigned', dist: 0 },
    ];
    for (let i = 0; i < cancelledRideIds.length; i++) {
        const cd = cancelDetails[i];
        const rideRow = await db.query(`SELECT passenger_id, driver_id FROM rides WHERE id = $1`, [cancelledRideIds[i]]);
        const cancellerUid = cd.cancelBy === 'passenger'
            ? rideRow.rows[0].passenger_id
            : dUids[cancelledPlan[i][1]];
        await db.query(
            `INSERT INTO ride_cancellations
               (ride_id, cancelled_by_user, cancelled_by_role, reason_code, reason_text, driver_distance_meters, penalty_applied, penalty_amount, ride_status_at_cancel)
             VALUES ($1,$2,$3,$4,$5,$6, false, 0, $7)
             ON CONFLICT (ride_id) DO NOTHING`,
            [cancelledRideIds[i], cancellerUid, cd.cancelBy, cd.reason, cd.reason.replace(/_/g, ' '), cd.dist, cd.statusAtCancel]
        );
    }
    console.log('  ✅ Cancellation records created');

    // ── 8. Ride invoices (completed rides) ────────────────────────────────────
    console.log('\n🧾 Creating ride invoices…');
    for (const rd of completedRideData) {
        const pFee = rd.final * 0.15;
        const subtotal = rd.final + rd.tip;
        await db.query(
            `INSERT INTO ride_invoices
               (ride_id, invoice_number, base_fare, distance_fare, time_fare, platform_fee,
                tip_amount, subtotal, total_amount, currency,
                payment_method, payment_status, paid_at,
                vehicle_type, distance_km, duration_minutes, ride_date,
                pickup_address, dropoff_address)
             VALUES ($1,$2, 30,50,12,$3, $4,$5,$6,'INR',
                     $7,'paid',$8,$9,$10,$11,$8,$12,$13)
             ON CONFLICT (ride_id) DO NOTHING`,
            [rd.rideId, iNum(), parseFloat(pFee.toFixed(2)),
             rd.tip, parseFloat(subtotal.toFixed(2)), parseFloat(subtotal.toFixed(2)),
             rd.method, rd.compAt, rd.vType, rd.km, rd.min,
             L[rd.pickI].addr, L[rd.dropI].addr]
        );
    }
    console.log('  ✅ Invoices created');

    // ── 9. Transactions ───────────────────────────────────────────────────────
    console.log('\n💸 Creating transactions…');

    // wallet debit per passenger for wallet-paid completed rides
    const passengerWalletDebits = [0, 0, 0];
    const driverWalletCredits   = [0, 0, 0];

    for (const rd of completedRideData) {
        const earnAmt = parseFloat((rd.final * 0.80).toFixed(2));

        if (rd.method === 'wallet') {
            // passenger debit
            passengerWalletDebits[rd.pI] += rd.final;
            await db.query(
                `INSERT INTO transactions (transaction_number, user_id, wallet_id, ride_id, amount, type, category, payment_method, status, description)
                 VALUES ($1,$2,$3,$4,$5,'debit','ride_payment','wallet','success',$6)`,
                [tNum(), pIds[rd.pI], pWalletIds[rd.pI], rd.rideId, rd.final,
                 `Ride payment — ${L[rd.pickI].name} to ${L[rd.dropI].name}`]
            );
            // driver credit
            driverWalletCredits[rd.dI] += earnAmt;
            await db.query(
                `INSERT INTO transactions (transaction_number, user_id, wallet_id, ride_id, amount, type, category, payment_method, status, description)
                 VALUES ($1,$2,$3,$4,$5,'credit','ride_earnings','wallet','success',$6)`,
                [tNum(), dUids[rd.dI], dWalletIds[rd.dI], rd.rideId, earnAmt, `Ride earnings credited`]
            );
        } else if (rd.method === 'upi') {
            // passenger UPI (no wallet change for passenger)
            // driver credit via platform settlement
            driverWalletCredits[rd.dI] += earnAmt;
            await db.query(
                `INSERT INTO transactions (transaction_number, user_id, wallet_id, ride_id, amount, type, category, payment_method, status, description)
                 VALUES ($1,$2,$3,$4,$5,'credit','ride_earnings','upi','success','Ride earnings credited')`,
                [tNum(), dUids[rd.dI], dWalletIds[rd.dI], rd.rideId, earnAmt]
            );
        }
        // cash rides: no wallet transaction

        // tip transaction if any
        if (rd.tip > 0) {
            await db.query(
                `INSERT INTO transactions (transaction_number, user_id, wallet_id, ride_id, amount, type, category, payment_method, status, description)
                 VALUES ($1,$2,$3,$4,$5,'credit','tip','cash','success','Tip from passenger')`,
                [tNum(), dUids[rd.dI], dWalletIds[rd.dI], rd.rideId, rd.tip]
            );
        }
    }

    // wallet recharge transactions for passengers
    for (let i = 0; i < pIds.length; i++) {
        await db.query(
            `INSERT INTO transactions (transaction_number, user_id, wallet_id, amount, type, category, payment_method, status, description)
             VALUES ($1,$2,$3,2000.00,'credit','wallet_recharge','upi','success','Wallet recharge')`,
            [tNum(), pIds[i], pWalletIds[i]]
        );
    }
    console.log('  ✅ Transactions created');

    // Update wallet balances
    for (let i = 0; i < pIds.length; i++) {
        const debits = parseFloat(passengerWalletDebits[i].toFixed(2));
        await db.query(
            `UPDATE wallets SET balance = 2000.00 - $1, total_debited = $1, last_transaction_at = NOW() WHERE user_id = $2`,
            [debits, pIds[i]]
        );
    }
    for (let i = 0; i < dUids.length; i++) {
        const credits = parseFloat(driverWalletCredits[i].toFixed(2));
        await db.query(
            `UPDATE wallets SET balance = 5000.00 + $1, total_credited = 5000.00 + $1, last_transaction_at = NOW() WHERE user_id = $2`,
            [credits, dUids[i]]
        );
    }
    console.log('  ✅ Wallet balances updated');

    // ── 10. Reviews ───────────────────────────────────────────────────────────
    console.log('\n⭐ Creating reviews…');
    const reviewPairs = [
        // [rideIdx, pRating, dRating, pComment, dComment, pTags, dTags]
        [0, 5, 4, 'Smooth and fast ride!', 'Good passenger, polite', ['clean_vehicle','good_driving'], ['on_time']],
        [1, 4, 5, 'Driver was friendly',  'Very cooperative',        ['friendly_driver'],             ['respectful']],
        [2, 5, 5, 'Excellent car, AC was great', 'Great rider!',      ['ac_working','clean_vehicle'],  ['on_time','good_tipper']],
        [3, 4, 4, 'Quick pickup',         'Decent passenger',         ['good_driving'],                ['respectful']],
        [4, 3, 5, 'Took longer route',    'Lovely passenger',         [],                              ['on_time']],
        [5, 5, 4, 'Very comfortable ride','Well-behaved passenger',   ['ac_working','clean_vehicle'],  ['respectful','good_tipper']],
        [6, 5, 5, 'Superfast delivery!',  'Perfect 5-star customer',  ['good_driving'],                ['on_time','good_tipper']],
        [7, 4, 4, 'Fine ride overall',    'Regular passenger',        [],                              []],
    ];
    for (const [idx, pRat, dRat, pCom, dCom, pTags, dTags] of reviewPairs) {
        const rd = completedRideData[idx];
        // passenger reviews driver
        await db.query(
            `INSERT INTO reviews (ride_id, reviewer_id, reviewee_id, reviewer_type, reviewee_type, rating, comment, tags, tip_amount)
             VALUES ($1,$2,$3,'passenger','driver',$4,$5,$6,$7)
             ON CONFLICT (ride_id, reviewer_id, reviewee_id) DO NOTHING`,
            [rd.rideId, pIds[rd.pI], dUids[rd.dI], pRat, pCom, pTags, rd.tip]
        );
        // driver reviews passenger
        await db.query(
            `INSERT INTO reviews (ride_id, reviewer_id, reviewee_id, reviewer_type, reviewee_type, rating, comment, tags)
             VALUES ($1,$2,$3,'driver','passenger',$4,$5,$6)
             ON CONFLICT (ride_id, reviewer_id, reviewee_id) DO NOTHING`,
            [rd.rideId, dUids[rd.dI], pIds[rd.pI], dRat, dCom, dTags]
        );
    }
    console.log('  ✅ Reviews created');

    // ── 11. Rating summaries ──────────────────────────────────────────────────
    console.log('\n📊 Creating rating summaries…');
    // Passenger summaries
    const pRatings = [[4,5,4,3,5,4],[4,4,5,5],[3,5]];
    for (let i = 0; i < pIds.length; i++) {
        const rats = pRatings[i];
        const avg = rats.reduce((a,b)=>a+b,0)/rats.length;
        const counts = [0,0,0,0,0,0];
        rats.forEach(r => counts[r]++);
        await db.query(
            `INSERT INTO rating_summaries (user_id, user_type, average_rating, total_reviews, five_star, four_star, three_star, two_star, one_star)
             VALUES ($1,'passenger',$2,$3,$4,$5,$6,$7,$8)
             ON CONFLICT (user_id) DO UPDATE SET average_rating=$2, total_reviews=$3, five_star=$4, four_star=$5, three_star=$6, two_star=$7, one_star=$8, updated_at=NOW()`,
            [pIds[i], parseFloat(avg.toFixed(2)), rats.length, counts[5], counts[4], counts[3], counts[2], counts[1]]
        );
    }
    // Driver summaries
    const dRatings = [[5,5,4],[5,4,4],[4,5,4,5]];
    const dAvgRatings = dRatings.map(rats => rats.reduce((a,b)=>a+b,0)/rats.length);
    for (let i = 0; i < dIds.length; i++) {
        const rats = dRatings[i];
        const avg = dAvgRatings[i];
        const counts = [0,0,0,0,0,0];
        rats.forEach(r => counts[r]++);
        await db.query(
            `INSERT INTO rating_summaries (user_id, user_type, average_rating, total_reviews, five_star, four_star, three_star, two_star, one_star)
             VALUES ($1,'driver',$2,$3,$4,$5,$6,$7,$8)
             ON CONFLICT (user_id) DO UPDATE SET average_rating=$2, total_reviews=$3, five_star=$4, four_star=$5, three_star=$6, two_star=$7, one_star=$8, updated_at=NOW()`,
            [dUids[i], parseFloat(avg.toFixed(2)), rats.length, counts[5], counts[4], counts[3], counts[2], counts[1]]
        );
        // update drivers.rating
        await db.query(`UPDATE drivers SET rating = $1, total_rides = $2 WHERE id = $3`,
            [parseFloat(avg.toFixed(2)), rats.length + 2, dIds[i]]);
    }
    console.log('  ✅ Rating summaries created');

    // ── 12. Driver scores ─────────────────────────────────────────────────────
    console.log('\n🏅 Creating driver scores…');
    const scoreData = [
        { acc: 88, comp: 95, ontime: 90, cancel: 5, penalty: 0, tier: 'GOLD' },
        { acc: 75, comp: 88, ontime: 82, cancel: 12, penalty: 2, tier: 'SILVER' },
        { acc: 95, comp: 98, ontime: 96, cancel: 2, penalty: 0, tier: 'PLATINUM' },
    ];
    for (let i = 0; i < dIds.length; i++) {
        const s = scoreData[i];
        const total = Math.round(dAvgRatings[i]*20 + s.acc*0.3 + s.comp*0.2 + s.ontime*0.1 - s.penalty*5);
        await db.query(
            `INSERT INTO driver_score (driver_id, avg_rating, acceptance_rate, completion_rate, ontime_rate, cancel_rate, complaint_penalty, score_total, tier, last_updated)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
             ON CONFLICT (driver_id) DO UPDATE SET avg_rating=$2, acceptance_rate=$3, completion_rate=$4, ontime_rate=$5, cancel_rate=$6, complaint_penalty=$7, score_total=$8, tier=$9, last_updated=NOW()`,
            [dIds[i], parseFloat(dAvgRatings[i].toFixed(2)), s.acc, s.comp, s.ontime, s.cancel, s.penalty, total, s.tier]
        );
    }
    console.log('  ✅ Driver scores created');

    // ── 13. Driver daily metrics (last 7 days) ────────────────────────────────
    console.log('\n📅 Creating driver daily metrics…');
    for (let i = 0; i < dIds.length; i++) {
        for (let d = 6; d >= 0; d--) {
            const date = new Date(); date.setDate(date.getDate() - d);
            const dateStr = date.toISOString().slice(0, 10);
            const assigned   = 8 + Math.floor(Math.random() * 5);
            const accepted   = Math.floor(assigned * (scoreData[i].acc / 100));
            const completed  = Math.floor(accepted * 0.95);
            const cancelDrv  = Math.floor(accepted * 0.03);
            const cancelUsr  = Math.floor(accepted * 0.02);
            const ontime     = Math.floor(completed * 0.92);
            await db.query(
                `INSERT INTO driver_metrics_daily (driver_id, date, rides_assigned, rides_accepted, rides_completed, rides_cancelled_driver, rides_cancelled_user, complaints_count, ontime_arrival_count, late_arrival_count)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,$9)
                 ON CONFLICT (driver_id, date) DO UPDATE SET rides_assigned=$3, rides_accepted=$4, rides_completed=$5, rides_cancelled_driver=$6, rides_cancelled_user=$7, ontime_arrival_count=$8, late_arrival_count=$9`,
                [dIds[i], dateStr, assigned, accepted, completed, cancelDrv, cancelUsr, ontime, completed - ontime]
            );
        }
    }
    console.log('  ✅ Daily metrics created (7 days)');

    // ── 14. Driver weekly & monthly earnings ──────────────────────────────────
    console.log('\n💰 Creating driver earnings…');
    const today = new Date();
    const weekStart = new Date(today); weekStart.setDate(today.getDate() - today.getDay());
    const weekEnd   = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
    const weekStartStr = weekStart.toISOString().slice(0,10);
    const weekEndStr   = weekEnd.toISOString().slice(0,10);

    const weeklyEarnings = [
        { rides: 38, completed: 36, cancelled: 2, ride_earn: 2850, tip: 230, incentive: 300, platform: 510, gross: 3380, deduct: 510, net: 2870, cash: 1200, online: 1650, hours: 42 },
        { rides: 28, completed: 25, cancelled: 3, ride_earn: 2100, tip: 120, incentive: 0,   platform: 378, gross: 2220, deduct: 378, net: 1842, cash: 1500, online: 600,  hours: 32 },
        { rides: 45, completed: 44, cancelled: 1, ride_earn: 3900, tip: 320, incentive: 500, platform: 702, gross: 4720, deduct: 702, net: 4018, cash: 900,  online: 3000, hours: 52 },
    ];
    for (let i = 0; i < dIds.length; i++) {
        const w = weeklyEarnings[i];
        await db.query(
            `INSERT INTO driver_earnings_weekly
               (driver_id, week_start, week_end, total_rides, completed_rides, cancelled_rides,
                ride_earnings, tip_earnings, incentive_earnings, referral_earnings,
                platform_fee_total, penalty_deductions, cancellation_deductions,
                gross_earnings, total_deductions, net_earnings,
                cash_collected, online_earnings, total_online_hours, avg_earning_per_ride)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$10,0,0,$11,$12,$13,$14,$15,$16,$17)
             ON CONFLICT (driver_id, week_start) DO UPDATE SET
               completed_rides=$5, net_earnings=$13, cash_collected=$14, online_earnings=$15, avg_earning_per_ride=$17`,
            [dIds[i], weekStartStr, weekEndStr, w.rides, w.completed, w.cancelled,
             w.ride_earn, w.tip, w.incentive, w.platform,
             w.gross, w.deduct, w.net, w.cash, w.online, w.hours,
             parseFloat((w.net / w.completed).toFixed(2))]
        );

        // Monthly earnings
        const month = today.getMonth() + 1;
        const year  = today.getFullYear();
        const mEarn = w.ride_earn * 4;
        const mNet  = w.net * 4;
        await db.query(
            `INSERT INTO driver_earnings_monthly
               (driver_id, month, year, total_rides, completed_rides, cancelled_rides,
                ride_earnings, tip_earnings, incentive_earnings, referral_earnings,
                platform_fee_total, penalty_deductions, cancellation_deductions,
                gross_earnings, total_deductions, net_earnings,
                cash_collected, online_earnings, total_online_hours,
                avg_earning_per_ride, avg_rating, acceptance_rate)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$10,0,0,$11,$12,$13,$14,$15,$16,$17,$18,$19)
             ON CONFLICT (driver_id, year, month) DO UPDATE SET
               net_earnings=$13, avg_rating=$18, acceptance_rate=$19`,
            [dIds[i], month, year, w.rides*4, w.completed*4, w.cancelled*4,
             mEarn, w.tip*4, w.incentive*4, w.platform*4,
             mEarn*1.1, w.deduct*4, mNet, w.cash*4, w.online*4, w.hours*4,
             parseFloat((mNet / (w.completed*4)).toFixed(2)),
             parseFloat(dAvgRatings[i].toFixed(2)), scoreData[i].acc]
        );
    }
    console.log('  ✅ Driver earnings (weekly + monthly) created');

    // ── 15. Driver cash balance & penalty summary ─────────────────────────────
    console.log('\n🏦 Creating driver cash balance & penalty summary…');
    const cashBalData = [
        { pending: 480, collected: 1800, deposited: 1320, platform_share: 360 },
        { pending: 750, collected: 3000, deposited: 2250, platform_share: 600 },
        { pending: 180, collected: 900,  deposited: 720,  platform_share: 180 },
    ];
    for (let i = 0; i < dIds.length; i++) {
        const cb = cashBalData[i];
        await db.query(
            `INSERT INTO driver_cash_balance (driver_id, pending_amount, total_cash_collected, total_deposited, total_platform_share, is_limit_exceeded, cash_limit)
             VALUES ($1,$2,$3,$4,$5,false,2000)
             ON CONFLICT (driver_id) DO UPDATE SET pending_amount=$2, total_cash_collected=$3, total_deposited=$4, total_platform_share=$5`,
            [dIds[i], cb.pending, cb.collected, cb.deposited, cb.platform_share]
        );
        await db.query(
            `INSERT INTO driver_penalty_summary (driver_id, total_points, total_warnings, total_fines, total_fine_amount, total_bans, is_banned)
             VALUES ($1,0,0,0,0.00,0,false)
             ON CONFLICT (driver_id) DO NOTHING`,
            [dIds[i]]
        );
    }
    // Update total_earnings on drivers
    for (let i = 0; i < dIds.length; i++) {
        await db.query(`UPDATE drivers SET total_earnings = $1 WHERE id = $2`,
            [weeklyEarnings[i].net * 4, dIds[i]]);
    }
    console.log('  ✅ Cash balance & penalty summary created');

    // ── 16. Subscription plans + user subscriptions ───────────────────────────
    console.log('\n📦 Creating subscriptions…');
    await db.query(
        `INSERT INTO subscription_plans (name, slug, description, price, duration_days, ride_discount_percent, free_rides_per_month, priority_booking, cancellation_waiver, surge_protection, is_active)
         VALUES
           ('Basic Pass',  'basic-pass',  'Save on short rides',        99,  30,  5,  2,  false, false, false, true),
           ('Prime Pass',  'prime-pass',  'Best value for daily commute',199, 30,  10, 5,  true,  true,  false, true),
           ('Elite Pass',  'elite-pass',  'Premium ride experience',     399, 30,  15, 10, true,  true,  true,  true),
           ('Annual Pass', 'annual-pass', 'Best annual savings',         999, 365, 20, 15, true,  true,  true,  true)
         ON CONFLICT (slug) DO NOTHING`
    );

    const { rows: planRows } = await db.query(`SELECT id, slug FROM subscription_plans WHERE slug IN ('prime-pass','basic-pass')`);
    const planMap = Object.fromEntries(planRows.map(r => [r.slug, r.id]));

    // Passenger 0 (Rahul) → prime-pass active
    if (planMap['prime-pass']) {
        const { rows: subRows } = await db.query(
            `INSERT INTO user_subscriptions (user_id, plan_id, status, started_at, expires_at, auto_renew, payment_method, free_rides_used)
             VALUES ($1,$2,'active', NOW() - INTERVAL '10 days', NOW() + INTERVAL '20 days', true, 'upi', 1)
             ON CONFLICT DO NOTHING RETURNING id`,
            [pIds[0], planMap['prime-pass']]
        );
        if (subRows.length) {
            await db.query(
                `INSERT INTO subscription_payments (user_id, subscription_id, plan_id, amount, payment_method, status, description)
                 VALUES ($1,$2,$3,199.00,'upi','success','Prime Pass subscription')
                 ON CONFLICT DO NOTHING`,
                [pIds[0], subRows[0].id, planMap['prime-pass']]
            );
            await db.query(
                `INSERT INTO transactions (transaction_number, user_id, wallet_id, amount, type, category, payment_method, status, description)
                 VALUES ($1,$2,$3,199.00,'debit','subscription','upi','success','Prime Pass — monthly subscription')`,
                [tNum(), pIds[0], pWalletIds[0]]
            );
        }
    }
    // Passenger 1 (Priya) → basic-pass active
    if (planMap['basic-pass']) {
        const { rows: subRows } = await db.query(
            `INSERT INTO user_subscriptions (user_id, plan_id, status, started_at, expires_at, auto_renew, payment_method, free_rides_used)
             VALUES ($1,$2,'active', NOW() - INTERVAL '5 days', NOW() + INTERVAL '25 days', true, 'wallet', 0)
             ON CONFLICT DO NOTHING RETURNING id`,
            [pIds[1], planMap['basic-pass']]
        );
        if (subRows.length) {
            await db.query(
                `INSERT INTO subscription_payments (user_id, subscription_id, plan_id, amount, payment_method, status, description)
                 VALUES ($1,$2,$3,99.00,'wallet','success','Basic Pass subscription')
                 ON CONFLICT DO NOTHING`,
                [pIds[1], subRows[0].id, planMap['basic-pass']]
            );
        }
    }
    console.log('  ✅ Subscriptions created');

    // ── 17. Coupons ───────────────────────────────────────────────────────────
    console.log('\n🎟️  Creating coupons…');
    const coupons = [
        ['SEEDWELCOME', 'Welcome Offer',      'percentage', 20, 50,  0,    30, true,  100, 1],
        ['SEEDFLAT50',  'Flat ₹50 Off',       'flat',       50, 50,  150,  null, false, 200, 3],
        ['SEEDWEEKEND', 'Weekend Special 15%','percentage', 15, 80,  100,  null, false, 500, 2],
    ];
    const couponIds = [];
    for (const [code, title, dtype, dval, maxDisc, minRide, maxUses, firstOnly, maxTotal, maxPerUser] of coupons) {
        const { rows } = await db.query(
            `INSERT INTO coupons (code, title, discount_type, discount_value, max_discount, min_ride_amount, first_ride_only, max_uses_total, max_uses_per_user, valid_from, valid_until, is_active)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, NOW() - INTERVAL '7 days', NOW() + INTERVAL '30 days', true)
             ON CONFLICT (code) DO UPDATE SET is_active = true
             RETURNING id`,
            [code, title, dtype, dval, maxDisc, minRide, firstOnly, maxTotal, maxPerUser]
        );
        couponIds.push(rows[0].id);
    }

    // Apply SEEDFLAT50 to one completed ride
    if (completedRideData.length > 2) {
        const rd = completedRideData[2];
        await db.query(
            `INSERT INTO coupon_usages (coupon_id, user_id, ride_id, discount_applied, ride_amount, used_at)
             VALUES ($1,$2,$3,50.00,$4, NOW() - INTERVAL '4 days')
             ON CONFLICT (coupon_id, user_id, ride_id) DO NOTHING`,
            [couponIds[1], pIds[rd.pI], rd.rideId, rd.final]
        );
        await db.query(`UPDATE coupons SET current_uses = current_uses + 1 WHERE id = $1`, [couponIds[1]]);
    }
    console.log('  ✅ Coupons created');

    // ── 18. Saved addresses ───────────────────────────────────────────────────
    console.log('\n📍 Creating saved addresses…');
    const addrData = [
        // [pIdx, label, type, lat, lng, addr, landmark]
        [0, 'Home',   'home',  28.6519, 77.1892, 'A-12, Karol Bagh, New Delhi 110005',   'SEED'],
        [0, 'Office', 'work',  28.6315, 77.2167, 'Floor 4, Connaught Place, Delhi 110001','SEED'],
        [1, 'Home',   'home',  28.5672, 77.2431, 'B-34, Lajpat Nagar, New Delhi 110024', 'SEED'],
        [1, 'Gym',    'other', 28.5477, 77.2519, 'FitZone Nehru Place, Delhi 110019',    'SEED'],
        [2, 'Home',   'home',  28.7275, 77.1110, 'C-78, Rohini Sector 3, Delhi 110085',  'SEED'],
        [2, 'College','work',  28.6300, 77.0827, 'Delhi University Janakpuri, Delhi 110058','SEED'],
    ];
    for (const [pI, label, type, lat, lng, addr, lm] of addrData) {
        await db.query(
            `INSERT INTO saved_addresses (user_id, label, type, latitude, longitude, address, landmark, is_default)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             ON CONFLICT (user_id, type, label) DO UPDATE SET address = EXCLUDED.address, landmark = 'SEED'`,
            [pIds[pI], label, type, lat, lng, addr, lm, type === 'home']
        );
    }
    console.log('  ✅ Saved addresses created');

    // ── 19. Emergency contacts ────────────────────────────────────────────────
    console.log('\n🆘 Creating emergency contacts…');
    const ecData = [
        [0, 'Raj Sharma',    '9911000001', 'Father',  'SEED'],
        [0, 'Meera Sharma',  '9911000002', 'Mother',  'SEED'],
        [1, 'Anil Verma',    '9911000003', 'Brother', 'SEED'],
        [2, 'Pooja Singh',   '9911000004', 'Sister',  'SEED'],
    ];
    for (const [pI, name, phone, rel] of ecData) {
        await db.query(
            `INSERT INTO emergency_contacts (user_id, name, phone, relationship)
             VALUES ($1,$2,$3,$4)
             ON CONFLICT (user_id, phone) DO UPDATE SET name = EXCLUDED.name, relationship = $4`,
            [pIds[pI], name, phone, rel]
        );
    }
    // Also for drivers
    for (let i = 0; i < dUids.length; i++) {
        await db.query(
            `INSERT INTO emergency_contacts (user_id, name, phone, relationship)
             VALUES ($1,$2,$3,'Spouse')
             ON CONFLICT (user_id, phone) DO UPDATE SET name = EXCLUDED.name`,
            [dUids[i], `${DRIVERS[i].name.split(' ')[0]} Family`, `9922${String(i).padStart(6,'0')}`]
        );
    }
    console.log('  ✅ Emergency contacts created');

    // ── 20. Support tickets ───────────────────────────────────────────────────
    console.log('\n🎫 Creating support tickets…');
    const tickets = [
        { pI: 0, rideIdx: 1, cat: 'payment_issue',    subj: 'Overcharged for ride', desc: 'I was charged extra ₹20 on my cash ride. [SEED]', priority: 'medium', status: 'resolved', resNotes: 'Amount verified, no overcharge found.' },
        { pI: 1, rideIdx: 2, cat: 'driver_behavior',  subj: 'Driver took longer route', desc: 'Driver took an unnecessarily long route. [SEED]', priority: 'high', status: 'in_progress', resNotes: null },
        { pI: 2, rideIdx: null, cat: 'app_bug',        subj: 'App crashes on payment screen', desc: 'App freezes when I tap Pay with Wallet. [SEED]', priority: 'urgent', status: 'open', resNotes: null },
    ];
    for (const t of tickets) {
        const tkNum = tktNum();
        const { rows: tkRows } = await db.query(
            `INSERT INTO support_tickets (ticket_number, user_id, ride_id, category, subject, description, priority, status, resolved_at, resolution_notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8, $9, $10)
             ON CONFLICT (ticket_number) DO NOTHING
             RETURNING id`,
            [tkNum, pIds[t.pI],
             t.rideIdx !== null ? completedRideData[t.rideIdx].rideId : null,
             t.cat, t.subj, t.desc, t.priority, t.status,
             t.status === 'resolved' ? new Date() : null, t.resNotes]
        );
        if (tkRows.length) {
            await db.query(
                `INSERT INTO support_messages (ticket_id, sender_id, sender_role, message)
                 VALUES ($1,$2,'user',$3)`,
                [tkRows[0].id, pIds[t.pI], t.desc]
            );
            if (t.status !== 'open') {
                await db.query(
                    `INSERT INTO support_messages (ticket_id, sender_id, sender_role, message)
                     VALUES ($1,$2,'admin','[SEED] Our team is reviewing your ticket. We will get back to you shortly.')`,
                    [tkRows[0].id, pIds[0]]
                );
            }
        }
        console.log(`  ✅ ${tkNum} — ${t.cat} [${t.status}]`);
    }

    // ── 21. Notifications ─────────────────────────────────────────────────────
    console.log('\n🔔 Creating notifications…');
    const notifs = [
        // [userIdx, isDriver, type, title, body, rideIdx]
        [0, false, 'ride_completed',    '[SEED] Ride Completed',          'Your ride to Nehru Place has ended. Total ₹82',  0],
        [0, false, 'wallet_credit',     '[SEED] Wallet Recharged',        '₹2000 added to your GoMobility wallet',          null],
        [0, false, 'subscription',      '[SEED] Prime Pass Activated',    'Enjoy 10% off on all rides for 30 days!',        null],
        [1, false, 'ride_completed',    '[SEED] Ride Completed',          'Your ride to India Gate has ended. Total ₹278',  2],
        [1, false, 'promo',             '[SEED] New Coupon Available',    'Use SEEDFLAT50 to get ₹50 off your next ride',   null],
        [2, false, 'ride_completed',    '[SEED] Ride Completed',          'Your ride to Vasant Kunj has ended. Total ₹132', 4],
        [2, false, 'promo',             '[SEED] Weekend Special!',        'Get 15% off rides this weekend with SEEDWEEKEND',null],
        [0, true,  'ride_assigned',     '[SEED] New Ride Request',        'Pickup at Rohini Sector 3 — ₹72 estimated',      null],
        [0, true,  'earnings_credit',   '[SEED] Earnings Credited',       '₹68 credited to your wallet for completed ride', 0],
        [1, true,  'incentive',         '[SEED] Weekly Target Achieved!', 'You completed 25 rides this week — ₹300 bonus!', null],
        [2, true,  'ride_assigned',     '[SEED] New Ride Request',        'Pickup at Saket — ₹328 estimated',               5],
    ];
    for (const [idx, isDriver, type, title, body, rideIdx] of notifs) {
        const uid = isDriver ? dUids[idx] : pIds[idx];
        const rideId = rideIdx !== null ? completedRideData[rideIdx].rideId : null;
        await db.query(
            `INSERT INTO notifications (user_id, type, title, body, ride_id, is_read)
             VALUES ($1,$2,$3,$4,$5, $6)`,
            [uid, type, title, body, rideId, Math.random() > 0.4]
        );
    }
    console.log('  ✅ Notifications created');

    // ── 22. Referral codes ────────────────────────────────────────────────────
    console.log('\n🎁 Creating referral codes…');
    const refCodes = ['SEEDRAHUL01', 'SEEDPRIYA02', 'SEEDAMIT03'];
    for (let i = 0; i < pIds.length; i++) {
        await db.query(
            `INSERT INTO referral_codes (user_id, code, total_referrals, total_earned, is_active)
             VALUES ($1,$2,0,0.00,true)
             ON CONFLICT (user_id) DO NOTHING`,
            [pIds[i], refCodes[i]]
        );
    }
    for (let i = 0; i < dUids.length; i++) {
        await db.query(
            `INSERT INTO referral_codes (user_id, code, total_referrals, total_earned, is_active)
             VALUES ($1,$2,0,0.00,true)
             ON CONFLICT (user_id) DO NOTHING`,
            [dUids[i], `SEEDDRV0${i+1}`]
        );
    }
    console.log('  ✅ Referral codes created');

    // ── 23. Incentive plans + driver progress ─────────────────────────────────
    console.log('\n🎯 Creating incentive plans…');
    const now   = new Date();
    const mStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const mEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const { rows: incRows } = await db.query(
        `INSERT INTO incentive_plans (title, description, type, target_value, bonus_amount, vehicle_type, duration_type, valid_from, valid_until, is_active)
         VALUES
           ('[SEED] Complete 30 rides this week', '₹300 bonus on completing 30 rides in a week', 'ride_count', 30, 300, null, 'weekly', $1, $2, true),
           ('[SEED] Earn ₹5000 this month',       '₹500 bonus on monthly earnings of ₹5000',    'earning_target', 5000, 500, null, 'monthly', $3, $4, true)
         RETURNING id, title`,
        [weekStart, weekEnd, mStart, mEnd]
    );

    if (incRows.length) {
        const weeklyPlanId  = incRows.find(r => r.title.includes('Complete'))?.id;
        const monthlyPlanId = incRows.find(r => r.title.includes('Earn'))?.id;
        const progressData = [
            [dIds[0], weeklyPlanId,  25, false],
            [dIds[1], weeklyPlanId,  18, false],
            [dIds[2], weeklyPlanId,  30, true],
            [dIds[0], monthlyPlanId, 2870, false],
            [dIds[2], monthlyPlanId, 4018, false],
        ];
        for (const [did, planId, cur, done] of progressData) {
            if (!planId) continue;
            const pStart = planId === weeklyPlanId ? weekStart : mStart;
            const pEnd   = planId === weeklyPlanId ? weekEnd   : mEnd;
            await db.query(
                `INSERT INTO driver_incentive_progress (driver_id, incentive_plan_id, current_value, is_completed, completed_at, period_start, period_end)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)
                 ON CONFLICT (driver_id, incentive_plan_id, period_start) DO UPDATE SET current_value=$3, is_completed=$4`,
                [did, planId, cur, done, done ? new Date() : null, pStart, pEnd]
            );
        }
    }
    console.log('  ✅ Incentive plans + progress created');

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log('\n─────────────────────────────────────────────────────────────────');
    console.log('✅ Comprehensive seed complete!\n');
    console.log('📱 LOGIN CREDENTIALS\n');
    console.log('PASSENGERS (role: passenger)');
    PASSENGERS.forEach(p => console.log(`  ${p.phone}  —  ${p.name}`));
    console.log('\nDRIVERS (role: driver) — KYC fully verified');
    DRIVERS.forEach(d => console.log(`  ${d.phone}  —  ${d.name}`));
    console.log('\n📊 DATA SEEDED:');
    console.log('  • 8 completed rides  (bike/auto/car, cash/wallet/upi)');
    console.log('  • 2 cancelled rides');
    console.log('  • 1 in_progress ride  + 1 driver_arrived + 1 driver_assigned + 1 requested');
    console.log('  • Ride invoices, transactions, wallet balances');
    console.log('  • Reviews + rating summaries (both sides)');
    console.log('  • Driver scores, daily metrics (7d), weekly + monthly earnings');
    console.log('  • Driver cash balance, penalty summary');
    console.log('  • Subscription plans + 2 active user subscriptions');
    console.log('  • 3 coupons  (SEEDWELCOME / SEEDFLAT50 / SEEDWEEKEND)');
    console.log('  • Saved addresses + emergency contacts');
    console.log('  • Support tickets (resolved / in-progress / open)');
    console.log('  • Notifications for all users');
    console.log('  • Referral codes, incentive plans + driver progress');
    console.log('\n📋 HOW TO LOGIN:');
    console.log('  1. POST /api/v1/auth/send-otp    { phone, role }');
    console.log('  2. Check response.data.otp');
    console.log('  3. POST /api/v1/auth/verify-otp  { phone, otp, role }');
    console.log('  4. Authorization: Bearer <accessToken>');
    console.log('─────────────────────────────────────────────────────────────────\n');
}

seed()
    .then(() => { db.disconnect?.(); process.exit(0); })
    .catch(err => { console.error('❌ Seed failed:', err.message, err.stack); process.exit(1); });
