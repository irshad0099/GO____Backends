# PRD — KYC System (OCR-First, Manual Fallback)

**Status:** Ready for implementation  
**Est. effort:** 1 day core backend + 1–2 days Redis queue + admin approval UI  
**Owner:** Backend team → Frontend team → Admin panel team

---

## 1. Why This PRD Exists

Current KYC is split across 3 parallel implementations (`drivers/` legacy, `kyc/` Cashfree+DigiLocker, `drivers/driverKycRoutes` digital KYC), with duplicate upload endpoints, 6 different tables, triple-redundant status tracking. See Section 16 below for full inventory of what exists today. This PRD replaces the whole thing with **one clean pipeline**: OCR-first, fraud-checked, manual-reviewed only when needed.

**Out of scope:** DigiLocker is removed entirely — OCR + manual admin review covers all cases.

---

## 2. The Pipeline (One Path, Always)

```
Driver uploads document
         │
         ▼
┌──────────────────┐
│  POST /kyc/submit│   (synchronous response to driver)
└──────────────────┘
         │
         ▼
┌──────────────────────────┐
│  Smart OCR API call      │
│  → extract fields        │
│  → confidence score      │
│  → tampering detection   │
└──────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  Scoring Engine (in-memory, fast)        │
│  • OCR confidence (weight 40)            │
│  • Name match vs profile (weight 20)     │
│  • Duplicate hash check (hard-fail 100)  │
│  • Velocity check (weight 20)            │
│  • Document expiry (hard-fail if past)   │
│  → final score 0–100                     │
└──────────────────────────────────────────┘
         │
         ▼
    ┌────┴────┐
    │ Decide  │
    └────┬────┘
         │
   ┌─────┼─────┬──────────────┐
   ▼     ▼     ▼              ▼
 auto  manual  reject    queue Redis
 verif review  (retry)  (background:
              allowed)   face-match +
                         cross-check)
```

**Driver waits only for the OCR call (~2–4 seconds).** Everything else is background.

---

## 3. 6 Required Documents

| # | Type | Method | Auto-approve threshold |
|---|------|--------|-----------------------|
| 1 | `AADHAAR` | OCR | score ≥ 85 |
| 2 | `PAN` | OCR | score ≥ 85 |
| 3 | `DRIVING_LICENCE` | OCR + expiry check | score ≥ 85 AND expiry > 90 days |
| 4 | `VEHICLE_RC` | OCR | score ≥ 85 |
| 5 | `BANK_ACCOUNT` | Penny-drop API | name match ≥ 80% |
| 6 | `SELFIE_FACE_MATCH` | Face match vs Aadhaar photo | similarity ≥ 75% |

**Driver is fully verified only when all 6 are in success state.**

---

## 4. State Machine (per document)

```
           ┌──────────────┐
           │   pending    │  (record created on upload)
           └──────┬───────┘
                  │ scoring engine runs
     ┌────────────┼────────────┬───────────────┐
     ▼            ▼            ▼               ▼
┌──────────┐ ┌──────────┐ ┌──────────┐   (queued for
│   auto_  │ │  manual_ │ │ rejected │    background:
│ verified │ │  review  │ │ (retry)  │    face-match etc)
└──────────┘ └────┬─────┘ └────┬─────┘
                  │            │
           admin decides       │ driver retry (max 3)
                  │            ▼
          ┌───────┴──┐   ┌──────────┐
          ▼          ▼   │ pending  │
      approved   rejected└──────────┘
```

**Success states:** `auto_verified`, `approved`  
**Terminal fail:** `rejected` + `attempt_count >= 3` → driver account goes to `suspended`

---

## 5. Driver-level Overall Status (computed)

| Status | Condition |
|--------|-----------|
| `not_started` | 0 docs submitted |
| `in_progress` | 1–5 docs submitted |
| `pending_review` | All 6 submitted, at least 1 in `manual_review` |
| `verified` | All 6 in success state |
| `rejected` | Any doc `rejected` with `attempt_count < 3` (retry possible) |
| `suspended` | Any doc `rejected` with `attempt_count >= 3`, OR hard fraud flag |

**Gate:** Driver can go online (toggle availability) **only when `overall_status = verified`**.

---

## 6. Database Schema

### Migration `044_create_kyc_documents.sql`

```sql
-- Main document records
CREATE TABLE kyc_documents (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type       VARCHAR(30) NOT NULL,
                        -- AADHAAR | PAN | DRIVING_LICENCE | VEHICLE_RC | BANK_ACCOUNT | SELFIE
    method              VARCHAR(20) NOT NULL,
                        -- OCR | PENNY_DROP | FACE_MATCH
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',
                        -- pending | auto_verified | manual_review | approved | rejected
    extracted_data      JSONB,
    confidence_score    INTEGER,      -- 0–100
    fraud_score         INTEGER DEFAULT 0,
    document_number     VARCHAR(50),  -- last 4 visible in UI
    document_hash       VARCHAR(64),  -- SHA-256 of full number — for dedup
    file_url            TEXT,
    rejection_reason    TEXT,
    attempt_count       INTEGER DEFAULT 1,
    reviewed_by         INTEGER REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    verified_at         TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Critical: prevent same doc being used by multiple drivers
CREATE UNIQUE INDEX ux_kyc_doc_type_hash
    ON kyc_documents(document_type, document_hash)
    WHERE document_hash IS NOT NULL;

CREATE INDEX idx_kyc_user_status ON kyc_documents(user_id, status);
CREATE INDEX idx_kyc_review_queue ON kyc_documents(status, created_at)
    WHERE status = 'manual_review';

-- Driver-level aggregate (denormalized for fast login)
CREATE TABLE driver_kyc_status (
    user_id                 INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    overall_status          VARCHAR(20) NOT NULL DEFAULT 'not_started',
                            -- not_started | in_progress | pending_review | verified | rejected | suspended
    submitted_docs_count    INTEGER DEFAULT 0,
    verified_docs_count     INTEGER DEFAULT 0,
    last_activity_at        TIMESTAMPTZ,
    verified_at             TIMESTAMPTZ,
    suspended_at            TIMESTAMPTZ,
    suspension_reason       TEXT
);

-- Fraud flag log (append-only)
CREATE TABLE kyc_fraud_flags (
    id           SERIAL PRIMARY KEY,
    document_id  INTEGER NOT NULL REFERENCES kyc_documents(id) ON DELETE CASCADE,
    flag_type    VARCHAR(40) NOT NULL,
                 -- DUPLICATE_NUMBER | NAME_MISMATCH | VELOCITY | TEMPLATE_TAMPERING
                 -- | FACE_MISMATCH | EXPIRED_DOC | LOW_CONFIDENCE
    severity     VARCHAR(10) NOT NULL,  -- LOW | MEDIUM | HIGH
    details      JSONB,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log (append-only, regulator-friendly)
CREATE TABLE kyc_audit_log (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER,
    document_id  INTEGER,
    action       VARCHAR(40) NOT NULL,
                 -- SUBMITTED | AUTO_VERIFIED | MANUAL_REVIEW_ASSIGNED
                 -- | APPROVED | REJECTED | SUSPENDED | FRAUD_FLAGGED
    actor_type   VARCHAR(20),     -- driver | admin | system
    actor_id     INTEGER,
    before_state JSONB,
    after_state  JSONB,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### Drop (in a separate migration, after cutover)
Old tables still used: `driver_aadhaar`, `driver_pan`, `driver_bank`, `driver_license`, `driver_vehicle` — deprecate after migration.

---

## 7. API Contracts

All endpoints under `/api/v1/kyc`. 🔒 = auth required.

### 7.1 Status (for driver app home)
```http
GET /api/v1/kyc/status  🔒
```
Response:
```json
{
  "success": true,
  "data": {
    "overallStatus": "in_progress",
    "submittedDocsCount": 3,
    "verifiedDocsCount": 2,
    "canGoOnline": false,
    "documents": [
      { "type": "AADHAAR",          "status": "auto_verified",  "canRetry": false },
      { "type": "PAN",              "status": "auto_verified",  "canRetry": false },
      { "type": "DRIVING_LICENCE",  "status": "manual_review",  "canRetry": false },
      { "type": "VEHICLE_RC",       "status": "not_submitted",  "canRetry": true  },
      { "type": "BANK_ACCOUNT",     "status": "rejected",       "canRetry": true, "rejectionReason": "Account number mismatch", "attemptsLeft": 2 },
      { "type": "SELFIE",           "status": "not_submitted",  "canRetry": true  }
    ],
    "nextAction": "Please upload Vehicle RC"
  }
}
```

### 7.2 Submit Document (OCR path)
```http
POST /api/v1/kyc/submit  🔒
Content-Type: multipart/form-data

document_type: AADHAAR
file: <binary>
```
Response — success (auto-verified):
```json
{
  "success": true,
  "data": {
    "documentId": 42,
    "status": "auto_verified",
    "confidenceScore": 92,
    "nextStep": "Upload PAN"
  }
}
```
Response — sent to manual review:
```json
{
  "success": true,
  "data": {
    "documentId": 42,
    "status": "manual_review",
    "confidenceScore": 72,
    "message": "Document under review. You'll be notified within 24 hours.",
    "nextStep": "Upload PAN"
  }
}
```
Response — rejected (retry allowed):
```json
{
  "success": false,
  "message": "Document rejected",
  "data": {
    "documentId": 42,
    "status": "rejected",
    "confidenceScore": 45,
    "rejectionReason": "Document is blurry or tampered",
    "attemptsLeft": 2
  }
}
```
Response — duplicate (409):
```json
{
  "success": false,
  "message": "This document is already registered with another account"
}
```

### 7.3 Retry
```http
POST /api/v1/kyc/documents/:id/retry  🔒
Content-Type: multipart/form-data

file: <binary>
```
Same response shape as 7.2. Fails if `attempt_count >= 3`.

### 7.4 Bank Verification (penny-drop)
```http
POST /api/v1/kyc/bank  🔒
Body: { "account_number": "12345678", "ifsc": "HDFC0001234", "name": "Rahul Sharma" }
```

### 7.5 Face Match
```http
POST /api/v1/kyc/face-match  🔒
Content-Type: multipart/form-data

selfie: <binary>
```
Requires Aadhaar to already be verified (uses Aadhaar photo as reference).

### 7.6 Admin Endpoints (role=admin)

```http
GET  /api/v1/kyc/admin/queue?type=AADHAAR&page=1&limit=20  🔒
GET  /api/v1/kyc/admin/documents/:id                        🔒
POST /api/v1/kyc/admin/documents/:id/approve                🔒
     Body: { "notes": "verified manually" }
POST /api/v1/kyc/admin/documents/:id/reject                 🔒
     Body: { "reason": "photo blurry", "allowRetry": true }
GET  /api/v1/kyc/admin/fraud-alerts?severity=HIGH           🔒
POST /api/v1/kyc/admin/drivers/:userId/suspend              🔒
     Body: { "reason": "fraud_multiple_attempts" }
```

---

## 8. Redis Queue — Background Processing

**Why:** Driver shouldn't wait for heavy checks (face match, cross-document verification). Do these in background, update status when done.

### Queue name: `kyc-processing`
Redis BullMQ (already in project). Each submission creates a job:

```js
// in POST /kyc/submit, after DB row created:
await kycQueue.add('process-document', {
  documentId,
  userId,
  documentType,
  extractedData
}, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 }
});
```

### Worker responsibilities (background)
1. **Cross-document name match** — compare with other verified docs of same user
2. **Face chain validation** — selfie ↔ Aadhaar ↔ DL photo match
3. **Velocity check** — same IP/device count in last 24h
4. **Update `driver_kyc_status` aggregate** (so login is fast)
5. **Emit FCM notification** if status changes to `auto_verified` / `rejected`
6. **Write to `kyc_audit_log`**

### Admin review SLA queue: `kyc-manual-review`
When a doc enters `manual_review`:
- Auto-assigned to admin pool (round-robin)
- 24-hour SLA alert if not resolved
- Driver gets FCM "under review" push immediately
- After admin decides, FCM goes to driver

---

## 9. Scoring Engine (the decision function)

```js
// Pseudocode — implement in src/modules/kyc/services/kycScoringService.js
function decideDocumentStatus({ ocrResult, user, existingDocs, deviceMeta }) {
  let score = 0;
  const flags = [];

  // Hard fails first (short-circuit)
  if (ocrResult.tamperingDetected) {
    flags.push({ type: 'TEMPLATE_TAMPERING', severity: 'HIGH' });
    return { status: 'rejected', score: 0, reason: 'Document appears tampered', flags };
  }

  if (existingDocs.duplicateHashFound) {
    flags.push({ type: 'DUPLICATE_NUMBER', severity: 'HIGH' });
    return { status: 'rejected', score: 0, reason: 'Document registered with another account', flags };
  }

  if (ocrResult.expiryDate && daysUntil(ocrResult.expiryDate) < 90) {
    flags.push({ type: 'EXPIRED_DOC', severity: 'HIGH' });
    return { status: 'rejected', score: 0, reason: 'Document expires within 90 days', flags };
  }

  // Soft signals — contribute to score
  score += ocrResult.confidence * 0.4;                          // 0–40
  score += nameMatch(user.fullName, ocrResult.name) * 0.2;      // 0–20
  score += velocityOk(user.id, deviceMeta) ? 20 : 0;            // 0 or 20
  score += crossDocConsistency(existingDocs, ocrResult) * 0.2;  // 0–20

  if (score >= 85) return { status: 'auto_verified', score, flags };
  if (score >= 60) return { status: 'manual_review', score, flags };
  return { status: 'rejected', score, reason: 'Low confidence', flags };
}
```

Thresholds (85 / 60) are config values in `ENV.KYC_AUTO_THRESHOLD` / `ENV.KYC_REVIEW_THRESHOLD` so they can be tuned without deploy.

---

## 10. Login Flow Integration

### Current behavior (to replace)
`src/modules/auth/services/authService.js:109-122` calls `driverKycService.getKycStatusForLogin(userId)` which queries 5 legacy tables.

### New behavior
Replace with single read from `driver_kyc_status`:

```js
// In authService.verifySignin / verifySignup, for driver role:
const kycRow = await db.query(
  `SELECT overall_status, submitted_docs_count, verified_docs_count, verified_at
   FROM driver_kyc_status WHERE user_id = $1`,
  [user.id]
);

response.kyc = {
  overallStatus:   kycRow?.overall_status || 'not_started',
  submittedDocs:   kycRow?.submitted_docs_count || 0,
  verifiedDocs:    kycRow?.verified_docs_count || 0,
  canGoOnline:     kycRow?.overall_status === 'verified',
  verifiedAt:      kycRow?.verified_at
};
```

**Benefits:** 1 query instead of 5 JOINs, aggregate kept fresh by background worker.

---

## 11. Files To Delete (post-cutover)

### Driver module duplicates
- `src/modules/drivers/routes/driverRoutes.js` — remove:
  - `POST /add-aadhar`, `/add-pancard`, `/add-bankdetail`, `/add-license`, `/add-vehicle-details`
  - `PATCH /document/verify`
  - `GET /document/:driver_id`
  - `POST /kyc-upload`
- Corresponding controllers and services

### KYC module cleanup
- Delete all DigiLocker routes, controllers, services, validators
- `POST /kyc/digilocker/webhook`, `/verify`, `/url`, `/status`, `/document/:type` — all gone
- Delete `kyc_digilocker_sessions` table (migration)

### Keep + refactor
- `POST /kyc/ocr` → rename endpoint to `POST /kyc/submit` (same controller, refactor internals)
- `POST /kyc/bank`, `POST /kyc/face` → stays, internal service refactor
- Admin review endpoints → expand

---

## 12. Frontend Flow (Driver App)

```
1. Login → authResponse.kyc.overallStatus
     ├─ 'verified'         → home screen, toggle available
     ├─ 'pending_review'   → "Under review" screen, disable online toggle
     ├─ 'rejected'         → KYC screen with retry CTA on failed docs
     └─ anything else      → KYC onboarding screen

2. KYC onboarding screen
   - GET /kyc/status → render 6-doc checklist
   - Tap any unsubmitted doc → camera → upload
   - POST /kyc/submit
       - auto_verified  → ✓ animate, next doc
       - manual_review  → "Under review" toast, next doc
       - rejected       → show reason + Retry button

3. When all 6 are in success state
   - POST /drivers/availability → true
   - GO TIME
```

---

## 13. Implementation Checklist (1 day core)

**Morning (4 hours)**
- [ ] Migration `044_create_kyc_documents.sql`
- [ ] `kyc.repository.js` — CRUD on `kyc_documents`, `driver_kyc_status`, fraud flags, audit log
- [ ] `kycScoringService.js` — scoring engine with thresholds from ENV

**Afternoon (4 hours)**
- [ ] `kycService.submitDocument()` — orchestrate: OCR call → scoring → state transition → queue job
- [ ] `kycService.retryDocument()` — validate attempt count, re-submit
- [ ] `kycController` + `kycRoutes` for 6 driver endpoints + 6 admin endpoints
- [ ] Integrate with `authService.verifySignin` — use new `driver_kyc_status` table
- [ ] Delete duplicate routes from `driverRoutes.js`

**Day 2 — Redis queue**
- [ ] BullMQ worker `kyc.worker.js` — cross-doc checks, aggregate updates, FCM
- [ ] `kyc-manual-review` queue for admin SLA alerts
- [ ] Admin approve/reject endpoints wired

**Day 3 — Admin UI + testing**
- [ ] Admin review queue page (list + filter + doc viewer)
- [ ] Approve/Reject actions
- [ ] E2E test: submit → score → manual review → admin approve → driver goes online

---

## 14. Fraud Handling (built-in from day 1)

| Signal | Detection | Action |
|--------|-----------|--------|
| Duplicate Aadhaar/PAN | UNIQUE index on `(type, document_hash)` | Auto-reject 409, admin alert |
| Tampered document | Smart OCR flag | Auto-reject, fraud_flag HIGH |
| Name mismatch (OCR vs profile) | Fuzzy match < 70% | Score penalty, maybe manual review |
| Face mismatch (selfie vs Aadhaar) | Similarity < 75% | Manual review |
| Velocity abuse | Same device/IP, 3+ drivers/24h | All new submissions → manual |
| Expired DL/RC | Expiry date check | Auto-reject with retry blocked |
| Cross-doc name mismatch | Background worker | Downgrade to manual review |
| Repeated rejections | `attempt_count >= 3` | Account suspended |

---

## 15. Success Metrics (measure after launch)

- **Auto-approval rate** — target 80%+ of submissions finish without admin
- **Admin review turnaround** — target <24h median
- **Driver KYC completion rate** — target 70% from start to verified
- **Fraud catch rate** — track duplicate detection hits
- **Retry exhaustion rate** — if >5% drivers suspend, loosen thresholds

---

## 16. Current State Inventory — What Exists Today (and must be removed/refactored)

### 16.1 Database Tables Currently in Use

| Table | Migration | Purpose Today | Action |
|-------|-----------|---------------|--------|
| `driver_aadhaar` | `011_create_driver_aadhar.sql` | Legacy Aadhaar data + Cashfree columns added in 034 | **Drop after backfill** |
| `driver_pan` | `012_create_driver_pan.sql` | Legacy PAN data + Cashfree columns | **Drop after backfill** |
| `driver_bank` | `013_create_driver_bank.sql` | Legacy Bank + Cashfree columns | **Drop after backfill** |
| `driver_license` | `014_create_driver_license.sql` | Legacy DL + Cashfree columns | **Drop after backfill** |
| `driver_vehicle` | `014_create_vehicle_detail.sql` | Legacy RC + vehicle info | **Split:** vehicle info stays, RC fields migrate to `kyc_documents` |
| `rider_kyc` | `033_create_rider_kyc.sql` | Newer all-in-one KYC table (rider+driver), Cashfree-based | **Drop entirely** |
| `driver_document_expiry` | `032_create_driver_document_expiry.sql` | Expiry tracking for docs | **Drop** — replaced by `kyc_documents.extracted_data.expiry_date` |
| `driver_documents` (legacy refactor) | `015_refactor_driver_core_and_vehicle_kyc.sql` | Old document refactor | **Drop** |

Modified/altered in these migrations (must review before dropping):
- `034_add_driver_digital_kyc_columns.sql` — adds Cashfree/DigiLocker columns to all 5 driver tables
- `035_add_driver_license_and_rc_to_rider_kyc.sql` — adds DL+RC to `rider_kyc`

### 16.2 Files That Currently Exist (with line counts)

#### `src/modules/kyc/` (whole module — 1,381 lines)
| File | Lines | What it does | Action |
|------|-------|--------------|--------|
| `controllers/kycController.js` | 146 | Smart OCR endpoint, Bank, Face, DigiLocker (5 endpoints), admin reviews | **Refactor** — keep only `submit`, `bank`, `faceMatch`, `adminReview` handlers. Delete DigiLocker methods. |
| `services/kycService.js` | 574 | Mixes OCR, DigiLocker webhook, Cashfree wrappers, manual review | **Rewrite** — split into `kycSubmitService`, `kycScoringService`, `kycAdminService`. Delete DigiLocker logic. |
| `services/cashfreeService.js` | 206 | Cashfree API client (OCR, bank, face, DigiLocker calls) | **Refactor** — keep `smartOcr`, `verifyBankAccount`, `matchFace`. Delete `getDigilockerDocument`, `getDigilockerStatus`, `createDigilockerUrl`, `verifyDigilockerAccount`. |
| `repositories/kyc.repository.js` | 335 | CRUD on `rider_kyc` table + manual review | **Rewrite** — new repo for `kyc_documents`, `driver_kyc_status`, `kyc_fraud_flags`, `kyc_audit_log` tables. |
| `routes/kycRoutes.js` | ~65 | 11 routes (5 are DigiLocker) | **Rewrite** per Section 7. |
| `middleware/kycUpload.middleware.js` | — | Multer config | **Keep** — reuse for new `/submit` endpoint. |

#### `src/modules/drivers/` — KYC-related files
| File | Lines | What it does | Action |
|------|-------|--------------|--------|
| `controllers/driverKycController.js` | 110 | Digital KYC (Aadhaar OTP, PAN, Bank, DL, RC) separate flow | **Delete entirely** — duplicates `/kyc/submit` flow |
| `services/driverKycService.js` | 395 | Digital KYC orchestration via Cashfree, writes to `driver_*` tables + `rider_kyc` | **Delete entirely** |
| `repositories/driverKyc.repository.js` | 258 | CRUD on legacy `driver_aadhaar/pan/bank/license` + `rider_kyc` | **Delete entirely** |
| `routes/driverKycRoutes.js` | 42 | 9 routes: `/status`, `/aadhaar/otp`, `/aadhaar/verify`, `/pan`, `/bank`, `/license`, `/rc`, admin review × 2 | **Delete entirely** |
| `controllers/documentExpiryController.js` | — | Doc expiry checks | **Delete** — superseded by `kyc_documents.extracted_data.expiry_date` |
| `services/documentExpiryService.js` | — | Expiry logic | **Delete** |
| `repositories/documentExpiry.repository.js` | — | Expiry table access | **Delete** |

#### `src/modules/drivers/routes/driverRoutes.js` — delete these lines only
Lines to remove (keep rest of file):
- `POST /register` (lines ~37–42) — merge registration into KYC flow
- `POST /add-aadhar` (lines ~45–50)
- `POST /add-pancard` (lines ~54–59)
- `POST /add-bankdetail` (lines ~64–69)
- `POST /add-license` (lines ~73–79)
- `POST /add-vehicle-details` (lines ~82–87)
- `PATCH /document/verify` (lines ~91–94)
- `GET /document/:driver_id` (lines ~97–100)
- `POST /kyc-upload` (lines ~134–138)
- `GET /documents/status` (line 298) — replaced by `GET /kyc/status`

**Keep:** profile, location, availability, earnings, incentives, penalties, cash collection, destination mode, ride rejection, acceptance rate, score, badge, daily metrics.

### 16.3 Endpoints Currently Exposed (that must be killed)

| Method | Endpoint | In Route File | Replacement |
|--------|----------|---------------|-------------|
| POST | `/drivers/add-aadhar` | `driverRoutes.js` | `POST /kyc/submit` with `document_type=AADHAAR` |
| POST | `/drivers/add-pancard` | `driverRoutes.js` | `POST /kyc/submit` with `document_type=PAN` |
| POST | `/drivers/add-bankdetail` | `driverRoutes.js` | `POST /kyc/bank` |
| POST | `/drivers/add-license` | `driverRoutes.js` | `POST /kyc/submit` with `document_type=DRIVING_LICENCE` |
| POST | `/drivers/add-vehicle-details` | `driverRoutes.js` | `POST /kyc/submit` with `document_type=VEHICLE_RC` |
| PATCH | `/drivers/document/verify` | `driverRoutes.js` | — (admin does this via `POST /kyc/admin/documents/:id/approve`) |
| GET | `/drivers/document/:driver_id` | `driverRoutes.js` | `GET /kyc/status` |
| POST | `/drivers/kyc-upload` | `driverRoutes.js` | `POST /kyc/submit` |
| GET | `/drivers/documents/status` | `driverRoutes.js` | `GET /kyc/status` |
| GET | `/driver-kyc/status` | `driverKycRoutes.js` | `GET /kyc/status` |
| POST | `/driver-kyc/aadhaar/otp` | `driverKycRoutes.js` | **REMOVED** (no OTP flow in new design) |
| POST | `/driver-kyc/aadhaar/verify` | `driverKycRoutes.js` | `POST /kyc/submit` (document upload, not OTP) |
| POST | `/driver-kyc/pan` | `driverKycRoutes.js` | `POST /kyc/submit` |
| POST | `/driver-kyc/bank` | `driverKycRoutes.js` | `POST /kyc/bank` |
| POST | `/driver-kyc/license` | `driverKycRoutes.js` | `POST /kyc/submit` |
| POST | `/driver-kyc/rc` | `driverKycRoutes.js` | `POST /kyc/submit` |
| GET | `/driver-kyc/admin/manual-reviews` | `driverKycRoutes.js` | `GET /kyc/admin/queue` |
| POST | `/driver-kyc/admin/manual-reviews/:driver_id/resolve` | `driverKycRoutes.js` | `POST /kyc/admin/documents/:id/approve` (or `/reject`) |
| POST | `/kyc/digilocker/webhook` | `kycRoutes.js` | **REMOVED — no DigiLocker** |
| POST | `/kyc/digilocker/verify` | `kycRoutes.js` | **REMOVED** |
| POST | `/kyc/digilocker/url` | `kycRoutes.js` | **REMOVED** |
| GET | `/kyc/digilocker/status` | `kycRoutes.js` | **REMOVED** |
| GET | `/kyc/digilocker/document/:document_type` | `kycRoutes.js` | **REMOVED** |
| POST | `/kyc/ocr` | `kycRoutes.js` | **Rename to** `POST /kyc/submit` |
| POST | `/kyc/bank` | `kycRoutes.js` | Keep — refactor internals |
| POST | `/kyc/face` | `kycRoutes.js` | Rename to `POST /kyc/face-match` |

### 16.4 External SDK / Service Currently Integrated

- **Cashfree Verification Suite** — used via `src/modules/kyc/services/cashfreeService.js`
  - ✅ Keep: `smartOcr`, `verifyBankAccount`, `matchFace`
  - ❌ Delete: `getDigilockerDocument`, `getDigilockerStatus`, `createDigilockerUrl`, `verifyDigilockerAccount`, `getCashfreeAccessToken`

- **Cashfree env vars** in `src/config/envConfig.js`:
  - Keep: `CASHFREE_CLIENT_ID`, `CASHFREE_CLIENT_SECRET`, `CASHFREE_BASE_URL`
  - Remove any: `CASHFREE_DIGILOCKER_WEBHOOK_SECRET`, `CASHFREE_DIGILOCKER_REDIRECT_URL`

### 16.5 Login Flow — Current vs New

**Currently in `src/modules/auth/services/authService.js:109–122`:**
```js
// 5-table JOIN query in driverKycService.getKycStatusForLogin(user.id)
response.kyc = {
  kycStatus: 'in_progress',
  currentStep: 'aadhaar',
  completedSteps: [...],
  pendingSteps: ['aadhaar', 'pan', 'bank', 'license', 'vehicle']
};
```

**Replace with (single-table read from new `driver_kyc_status`):**
```js
response.kyc = {
  overallStatus: 'in_progress',   // or: not_started | pending_review | verified | rejected | suspended
  submittedDocs: 3,
  verifiedDocs: 2,
  canGoOnline: false,
  verifiedAt: null
};
```

Files to change for login integration:
- `src/modules/auth/services/authService.js` — 2 locations (verifySignup + verifySignin) referenced in lines 109–122 and similar block for signin
- Drop import: `import * as driverKycService from '...'`
- Add: direct DB query to `driver_kyc_status` table

### 16.6 Data Migration Plan

**Migration `045_kyc_schema_cleanup.sql`** (runs after new tables live + backfill):

```sql
-- Backfill: walk each driver_* table, create kyc_documents rows with method='MANUAL_LEGACY'
-- Run as one-off script, NOT in migration, to preserve error handling
-- Script location: scripts/migrate-legacy-kyc.js

-- After backfill verification:
DROP TABLE IF EXISTS driver_aadhaar CASCADE;
DROP TABLE IF EXISTS driver_pan CASCADE;
DROP TABLE IF EXISTS driver_bank CASCADE;
DROP TABLE IF EXISTS driver_license CASCADE;
DROP TABLE IF EXISTS rider_kyc CASCADE;
DROP TABLE IF EXISTS driver_document_expiry CASCADE;

-- driver_vehicle: drop KYC columns only, keep vehicle info
ALTER TABLE driver_vehicle
  DROP COLUMN IF EXISTS rc_front_url,
  DROP COLUMN IF EXISTS rc_back_url,
  DROP COLUMN IF EXISTS verification_status,
  DROP COLUMN IF EXISTS cf_reference_id;
```

Backfill script (`scripts/migrate-legacy-kyc.js`) should:
1. Read all rows from `driver_aadhaar`, `driver_pan`, `driver_bank`, `driver_license`, `driver_vehicle`
2. For each, INSERT into `kyc_documents` with:
   - `method = 'MANUAL_LEGACY'`
   - `status` mapped from legacy `verification_status`
   - `document_number` / `document_hash` preserved
   - `extracted_data` as JSON with legacy columns
3. Compute `driver_kyc_status` aggregate for each driver
4. Log any rows that fail (e.g., missing hash → orphaned)

### 16.7 Order of Operations (do NOT reorder)

1. ✅ Deploy new `044_create_kyc_documents.sql` migration (additive, safe)
2. ✅ Deploy new `/kyc/*` endpoints (new module, zero impact on existing)
3. ✅ Run backfill script in staging → prod
4. ✅ Verify aggregate counts match between old and new
5. ✅ Deploy frontend cutover (app version check)
6. ✅ Freeze old endpoints (return 410 Gone with `X-Migration-Hint: Use /api/v1/kyc/submit`)
7. ✅ Monitor for 14 days — no old endpoint hits
8. ✅ Run `045_kyc_schema_cleanup.sql` to drop legacy tables
9. ✅ Delete deprecated files from codebase
