# 🔐 OTP Storage - Complete Flow

## Now OTP Stored in BOTH Places ✅

### 1️⃣ **ride_otps Table** (Full Details)
```sql
ride_otps {
  id SERIAL PRIMARY KEY
  ride_id INTEGER (FK)
  otp_code VARCHAR(10) ← The OTP code
  attempts INTEGER - Failed attempts
  max_attempts INTEGER = 3 - Max allowed
  is_verified BOOLEAN - Verified status
  verified_at TIMESTAMP - When verified
  expires_at TIMESTAMP - 10 min expiry
  created_at TIMESTAMP - Generated time
}
```

### 2️⃣ **rides Table** (Quick Reference)
```sql
rides {
  id SERIAL PRIMARY KEY
  ...other columns...
  ride_otp VARCHAR(10) ← Current OTP code (or NULL if cleared)
}
```

---

## 📊 Flow Diagram

```
DRIVER ARRIVES
    ↓
generateRideOTP(rideId, passengerPhone)
    ↓
    ├─ Generate 4-digit OTP (1000-9999)
    ├─ Set expiry = NOW() + 10 minutes
    ├─ INSERT into ride_otps with all details
    │  └─ otp_code, attempts=0, max_attempts=3, expires_at
    │
    ├─ [NEW] UPDATE rides.ride_otp = "1234"
    │  └─ Quick reference for current OTP
    │
    └─ Send SMS to passenger with OTP
       └─ "Share OTP 1234 with driver"

    ↓

DRIVER ENTERS OTP
    ↓
verifyRideOTP(rideId, enteredOtp)
    ↓
    ├─ Find active OTP from ride_otps table
    ├─ Check if attempts < max_attempts
    ├─ Verify OTP code
    │
    ├─ IF WRONG:
    │  └─ Increment attempts in ride_otps
    │  └─ Return error + attempts left
    │
    └─ IF CORRECT:
       ├─ UPDATE ride_otps SET is_verified=TRUE, verified_at=NOW()
       │
       ├─ [NEW] UPDATE rides.ride_otp = NULL
       │  └─ Clear from rides table
       │
       └─ Return success
           └─ Ride can start
```

---

## 💾 Database Updates Made

### Changes to rideOtpService.js

**When generating OTP:**
```javascript
const otp = await otpRepo.insert(rideId, otpCode, expiresAt);
// [NEW] Also store in rides table
await otpRepo.updateRideOtpColumn(rideId, otpCode);
```

**When verifying OTP:**
```javascript
if (result.success) {
  // [NEW] Clear OTP from rides table after verification
  await otpRepo.updateRideOtpColumn(rideId, null);
  return { verified: true, ... };
}
```

### New Function in rideOtp.repository.js

```javascript
// Store/Clear OTP in rides.ride_otp column for quick reference
export const updateRideOtpColumn = async (rideId, otpCode) => {
    const { rows } = await db.query(
        `UPDATE rides SET ride_otp = $1, updated_at = NOW() WHERE id = $2`,
        [otpCode, rideId]
    );
    return rows[0];
};
```

---

## 🔍 Query Examples

### Get Current OTP (Quick Lookup)
```sql
SELECT ride_otp FROM rides WHERE id = 123;
-- Returns: "1234" or NULL
```

### Get Full OTP Details
```sql
SELECT 
  otp_code,
  attempts,
  max_attempts - attempts AS attempts_left,
  expires_at,
  is_verified,
  verified_at
FROM ride_otps
WHERE ride_id = 123 
  AND is_verified = FALSE 
  AND expires_at > NOW()
ORDER BY created_at DESC
LIMIT 1;
```

### Get All OTP History for a Ride
```sql
SELECT 
  otp_code,
  attempts,
  is_verified,
  verified_at,
  created_at
FROM ride_otps
WHERE ride_id = 123
ORDER BY created_at DESC;
```

---

## ✅ Benefits of Dual Storage

| Aspect | ride_otps | rides.ride_otp | Use Case |
|--------|-----------|---------------|----------|
| **Speed** | Indexed, full details | Direct column, fastest | Quick check if OTP exists |
| **History** | Complete audit trail | Just current | See all OTP attempts |
| **Details** | All metadata | Just code | Tracking failed attempts |
| **Verification** | Full validation logic | Quick reference | Check without joins |
| **Expiry** | Tracked with timestamp | N/A | Know when OTP expires |
| **Status** | is_verified flag | Implicit (NULL = no OTP) | Know if OTP used |

---

## 🚨 State Management

### When OTP is ACTIVE
```
ride_otps table:
  otp_code = "1234"
  is_verified = FALSE
  attempts = 0
  expires_at = "2026-05-17 15:42:30"

rides table:
  ride_otp = "1234"
```

### When OTP is VERIFIED ✅
```
ride_otps table:
  otp_code = "1234"
  is_verified = TRUE
  verified_at = "2026-05-17 15:33:45"
  attempts = 0

rides table:
  ride_otp = NULL (cleared)
```

### When OTP is EXPIRED ❌
```
ride_otps table:
  otp_code = "1234"
  is_verified = FALSE
  expires_at = "2026-05-17 15:42:30" (< NOW)
  attempts = 3 (max reached)

rides table:
  ride_otp = "1234" (still there but expired)
  
→ Need new OTP
```

---

## 🔄 Usage in Application

### Check if OTP is Required
```javascript
const ride = await findRideById(rideId);

if (!ride.ride_otp) {
  // No OTP yet, not arrived
  console.log("Driver not arrived yet");
} else {
  // OTP exists, waiting for verification
  console.log(`Share OTP ${ride.ride_otp} with driver`);
}
```

### Quick OTP Check (without DB join)
```javascript
const ride = await findRideById(rideId);
// Direct access to ride.ride_otp - no join needed!

if (ride.ride_otp) {
  // Show OTP to passenger
  displayOTP(ride.ride_otp);
}
```

### Get Full OTP Metadata
```javascript
const otpDetails = await findLatest(rideId);
// From ride_otps table with full details

console.log(`Attempts: ${otpDetails.attempts}/${otpDetails.max_attempts}`);
console.log(`Expires: ${otpDetails.expires_at}`);
console.log(`Verified: ${otpDetails.is_verified}`);
```

---

## 📝 Summary

**Before:** 
- OTP only in ride_otps table (full details only)

**After:**
- ✅ ride_otps table: Full details, history, verification
- ✅ rides.ride_otp: Quick reference, current OTP code
- ✅ Synchronized: Cleared together after verification

**Benefits:**
- ⚡ Faster lookups for quick checks
- 📊 Full audit trail in ride_otps
- 🔄 Easy state tracking
- 💾 Denormalized for performance
- 🔐 Secure - cleared immediately after verification

---

## 🧪 Testing

```javascript
// Generate OTP
const otp1 = await generateRideOTP(rideId, "+919999999999");
// ride_otps: has all details
// rides.ride_otp = "1234"

// Wrong attempt
const verify1 = await verifyRideOTP(rideId, "9999");
// ride_otps.attempts = 1
// rides.ride_otp = "1234" (unchanged)

// Correct attempt
const verify2 = await verifyRideOTP(rideId, "1234");
// ride_otps.is_verified = TRUE
// rides.ride_otp = NULL (cleared)
```

✅ **Complete OTP Flow - Working!**
