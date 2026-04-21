# Driver KYC Status in Login Response (Manual KYC)

⚠️ **Note:** This implementation uses **Manual KYC** from `/src/modules/drivers/routes/driverRoutes.js`

**KYC System Architecture:**
- **Smart OCR (Cashfree):** `/src/modules/kyc/routes/kycRoutes.js` ← Real smart OCR (future)
- **Deprecated Wrapper:** `/src/modules/drivers/routes/driverKycRoutes.js` ← NOT integrated (ignore)
- **Manual KYC:** `/src/modules/drivers/routes/driverRoutes.js` ← Current (using NOW)

## What was implemented

When a **driver** logs in (via `/auth/verify-signin` or `/auth/verify-signup`), the response now includes a `kyc` object with **simple true/false status** for manual KYC documents.

## Login Response Structure

```json
{
  "kyc": {
    "kycStatus": "in_progress" | "not_started" | "complete",
    "documentStatus": {
      "aadhaar": true/false,
      "pan": true/false,
      "bank": true/false,
      "license": true/false,
      "vehicle": true/false
    },
    "allDocumentsSubmitted": true/false,
    "isDriverVerified": true/false
  }
}
```

**KYC Status Values:**
- `not_started` — Koi document verify nahi hua
- `in_progress` — Kuch documents verify ho gaye, baki pending hain
- `complete` — Sabhi 5 documents verified

**documentStatus:** Each boolean field:
- `aadhaar`: true if driver_aadhaar.verification_status === 'verified'
- `pan`: true if driver_pan.verification_status === 'verified'
- `bank`: true if driver_bank.verification_status === 'verified'
- `license`: true if driver_license.verification_status === 'verified'
- `vehicle`: true if driver_vehicle.verification_status === 'verified'

## Files Modified

### 1. `src/modules/drivers/services/driverKycService.js`
- **Added:** `getKycStatusForLogin(userId)` function
- Queries all 5 manual KYC tables (driver_aadhaar, driver_pan, driver_bank, driver_license, driver_vehicle)
- Returns simple boolean status for each document
- No smart OCR / Cashfree integration (manual only)

### 2. `src/modules/auth/services/authService.js`
- **Updated:** `verifySignin()` function
  - Fetches KYC status for driver role users
  - Includes kyc object in response
  
- **Updated:** `verifySignup()` function
  - Same KYC status fetch for driver signups

### 3. `API_INTEGRATION.md`
- **Updated:** Driver auth section with new response format
- Explained all documentStatus boolean fields

## How Frontend Should Use This

```javascript
const response = await loginDriver({ phone, otp, role: 'driver' });

const { kyc } = response.data;

if (kyc.kycStatus === 'complete') {
  // All documents verified — driver ready for rides
  navigateTo('/driver/dashboard');
} else if (kyc.allDocumentsSubmitted) {
  // All submitted but maybe under admin review
  showMessage('Your documents are being reviewed');
  navigateTo('/driver/dashboard'); // can still see pending status
} else {
  // Show which docs are missing
  if (!kyc.documentStatus.aadhaar) {
    navigateTo('/driver/kyc/aadhaar');
  } else if (!kyc.documentStatus.pan) {
    navigateTo('/driver/kyc/pan');
  } // ... etc
}
```

## Database Tables

Manual KYC uses these tables:
| Table | Field | Status Values |
|-------|-------|---|
| driver_aadhaar | verification_status | pending \| verified \| rejected \| not_submitted |
| driver_pan | verification_status | pending \| verified \| rejected \| not_submitted |
| driver_bank | verification_status | pending \| verified \| rejected \| not_submitted |
| driver_license | verification_status | pending \| verified \| rejected \| not_submitted |
| driver_vehicle | verification_status | pending \| verified \| rejected \| not_submitted |

All submissions go via:
- POST `/api/v1/drivers/add-aadhar` → driver_aadhaar
- POST `/api/v1/drivers/add-pancard` → driver_pan
- POST `/api/v1/drivers/add-bankdetail` → driver_bank
- POST `/api/v1/drivers/add-license` → driver_license
- POST `/api/v1/drivers/add-vehicle-details` → driver_vehicle

Admin approves via:
- PATCH `/api/v1/drivers/document/verify` body: `{ driver_id, document_type, status, rejected_reason }`

## Error Handling

If KYC fetch fails:
- Login still succeeds
- `kyc.kycStatus` = 'not_started' (safe default)
- A warning is logged
- Frontend sees all documents as false
