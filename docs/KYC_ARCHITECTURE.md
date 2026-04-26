# KYC System v2 — Architecture & Current State

**Last updated:** 2026-04-26
**Status:** Complete — auto-verification enabled, VAHAN insurance integration live.

---

## System Overview

System automatically verifies documents using AI + government databases. If everything checks out, driver gets verified in ~60 seconds — no admin needed. Admin queue is only triggered when something looks suspicious.

```
Driver uploads doc
       │
       ▼
Cashfree OCR + Govt DB verify  (~10–20 sec, synchronous)
  PAN   → NSDL
  DL    → Sarathi
  RC    → VAHAN  (insurance + fitness + permit bhi)
       │
       ├─ Hard fail  (tampering / expired / duplicate)  → rejected
       ├─ Score < 60                                    → rejected
       ├─ Score 60–84  OR  any fraud flag               → manual_review → Admin Queue
       └─ Score ≥ 85, zero flags                        → auto_verified ✅  (instant)
       │
       ▼ (all 6 docs submitted)
Cross-Verify runs in background
  (name/DOB/RC type/insurance/fitness consistency)
       │
       ├─ All pass → overall_status = verified → driver can go online ✅
       └─ Any fail → affected doc downgraded to manual_review → Admin Queue
```

---

## All Routes

### Driver (`/api/v1/kyc/`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/status` | Full KYC status + per-doc status (6 docs) |
| POST | `/submit` | Upload OCR doc (AADHAAR / PAN / DRIVING_LICENCE / VEHICLE_RC). `file` + optional `file_back` (Aadhaar address) |
| POST | `/documents/:id/retry` | Retry system-rejected doc (max 3 attempts) |
| POST | `/bank` | Penny-drop bank verification → instant `auto_verified` on success |
| POST | `/face-match` | Selfie upload — Cashfree face match vs Aadhaar photo |

### Admin (`/api/v1/kyc/admin/`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/drivers` | Paginated driver list with KYC summary. `?status=pending_review` to filter |
| GET | `/drivers/:userId` | Full detail for one driver — all 6 docs + pre_check_report |
| GET | `/queue` | Doc-level queue. `?status=manual_review\|rejected\|all` + `?type=SELFIE` |
| GET | `/documents/:id` | Single doc detail |
| POST | `/documents/:id/approve` | Approve (hard restriction checks apply) |
| POST | `/documents/:id/reject` | Reject (`allowRetry: true/false`) |
| GET | `/fraud-alerts` | Fraud flags. `?severity=HIGH\|MEDIUM\|LOW` |
| POST | `/drivers/:userId/suspend` | Suspend driver |

---

## Login Response — KYC for Frontend Routing

Every driver login (`POST /auth/verify-signin`) includes a `kyc` object:

```json
{
  "tokens": { "accessToken": "...", "refreshToken": "..." },
  "user": { "id": "...", "fullName": "Rahul Sharma", "role": "driver" },
  "kyc": {
    "overallStatus": "in_progress",
    "submittedDocs": 3,
    "verifiedDocs": 2,
    "canGoOnline": false,
    "verifiedAt": null,
    "nextScreen": "KYC_UPLOAD"
  }
}
```

`nextScreen` values for frontend routing:

| nextScreen | When | What to show |
|---|---|---|
| `HOME` | `verified` | Main app home |
| `KYC_INTRO` | `not_started` | KYC onboarding screen |
| `KYC_UPLOAD` | `in_progress` | Upload remaining docs |
| `KYC_UNDER_REVIEW` | `pending_review` | "Docs submitted, waiting for review" |
| `KYC_RETRY` | `rejected` | "Some docs rejected, please retry" |
| `ACCOUNT_SUSPENDED` | `suspended` | "Account suspended, contact support" |

---

## Document Verification Methods

Saari verification ek hi provider ke through hoti hai — **Cashfree**. Hum directly NSDL/Sarathi/VAHAN
call nahi karte. Jab `doVerification: true` pass hota hai, Cashfree apne backend pe internally
govt DB se check karta hai aur result `verification_details` mein deta hai.

| Doc | Cashfree API | `doVerification` | Response Mein Kya Milta Hai |
|-----|-------------|-----------------|----------------------------|
| AADHAAR | `bharat-ocr` | `false` | OCR fields only (name, DOB, address) |
| PAN | `bharat-ocr` | `true` | + pan_status, name_match, aadhaar_linked |
| DRIVING_LICENCE | `bharat-ocr` | `true` | + dl_status, dl_validity, photo |
| VEHICLE_RC | `bharat-ocr` | `true` | + rc_status, insurance/fitness data (VAHAN se) |
| BANK_ACCOUNT | `bank-account/sync` | — | account_status, name_match_score |
| SELFIE | `face-match` | — | similarity score (0–1) |

---

## RC → VAHAN Integration (Insurance & Fitness)

Driver ko alag insurance document upload nahi karna — RC submit karne pe VAHAN se automatically milta hai:

| VAHAN Field | Auto Action |
|---|---|
| `insurance_expiry` expired | Hard reject — "Insurance expired, renew and resubmit" |
| `insurance_expiry` < 30 days | `INSURANCE_EXPIRING_SOON` flag (MEDIUM severity) |
| `fitness_expiry` expired | `FITNESS_EXPIRED` flag (HIGH) → manual_review |
| `registration_validity` expired | Hard reject |
| `rc_status` not active | Reject |

30-day minimum configurable via `KYC_INSURANCE_EXPIRY_MIN_DAYS` env var.

---

## Scoring Engine

```
confidence_score (40%)  — Cashfree image quality: blur / glare / partial / obscured
name_match       (20%)  — Doc name vs driver profile name (token similarity)
velocity         (20%)  — Redis: <= 5 submissions/day passes
cross_doc        (20%)  — Doc name vs already-verified Aadhaar name

Total = 0–100
```

**Decision tree:**

```
Score ≥ 85  AND  zero fraud flags  →  auto_verified  ✅
Score ≥ 85  BUT  any fraud flag    →  manual_review
Score 60–84                        →  manual_review
Score < 60                         →  rejected
```

**Hard Fails (score ignored, always immediate reject/review):**

| Condition | Result |
|---|---|
| `is_overwritten` or `is_photo_imposed` = true | `rejected` (actual tampering) |
| `is_forged` = true | `manual_review` (Cashfree false-positive on compressed images) |
| Duplicate doc hash (same doc on 2 accounts) | `rejected` |
| DL expiry < 90 days | `rejected` |
| PAN not VALID in NSDL (production only) | `rejected` |
| DL not VALID in Sarathi (production only) | `rejected` |
| Insurance expired (VAHAN, from RC) | `rejected` |

---

## Face Match — Auto Verification

```
Selfie similarity vs Aadhaar photo:

>= 75%  →  auto_verified  ✅
60–74%  →  manual_review
< 60%   →  rejected  + FACE_MISMATCH flag
```

Threshold configurable via `CASHFREE_FACE_MATCH_THRESHOLD` (default 75).

---

## Bank Account — Auto Verification

Cashfree penny-drop success (account_status = 'VALID') + no duplicate hash → **immediate `auto_verified`**.
No admin review needed for bank accounts.

---

## Document State Machine

```
              SUBMIT
                │
                ▼
           [ pending ]
                │
     ┌──────────┼──────────────┐
     ▼          ▼              ▼
Score≥85    Score 60-84    Score<60
No flags    OR any flag    OR hard fail
     │          │              │
     ▼          ▼              ▼
[auto_verified] [manual_review] [rejected]
     ✅              │          │
                ┌────┴───┐   retry?
                ▼        ▼   (max 3x)
           [approved] [rejected]
               ✅     (FINAL if
                       admin rejected)
```

**Rules:**
- `auto_verified` = same effect as `approved` — driver can go online
- Admin-approved document → cannot be rejected (final)
- Admin-rejected document → cannot be re-approved (final, supervisor escalation needed)
- System-rejected (`reviewed_by = NULL`) → admin CAN override to approved
- 3 retries exhausted → `driver_kyc_status.overall_status = suspended`

---

## Overall KYC Status (driver_kyc_status)

| Status | Meaning |
|---|---|
| `not_started` | No documents submitted |
| `in_progress` | Some submitted, some pending |
| `pending_review` | All 6 submitted, some in manual_review, none rejected |
| `verified` | All 6 are auto_verified or approved → driver can go online |
| `rejected` | At least one rejected, retries remaining |
| `suspended` | 3 retries exhausted OR admin suspended |

---

## Cross-Document Verification

Runs automatically in background (non-blocking) when all 6 docs are submitted.
Report saved to `driver_kyc_status.pre_check_report` (JSONB).

### Hard Checks (fail → doc downgraded to `manual_review` + `CROSS_DOC_MISMATCH` flag):

| Check | Docs Compared |
|---|---|
| Name similarity ≥ 70% | Aadhaar ↔ PAN |
| Name similarity ≥ 70% | Aadhaar ↔ DL |
| DOB exact match | Aadhaar ↔ PAN |
| DOB exact match | Aadhaar ↔ DL |
| PAN status = 'E' (active) | PAN extracted_data |
| DL status = 'ACTIVE' | DL extracted_data |
| RC vehicle_type matches driver's registered vehicle | RC ↔ drivers table |
| RC registration_validity not expired | RC extracted_data |
| Insurance not expired (VAHAN data) | RC extracted_data |
| Fitness certificate not expired (VAHAN data) | RC extracted_data |

### Soft Warnings (flagged in report, driver not blocked):

| Check | Note |
|---|---|
| Bank holder name ≠ driver name | Family account acceptable |
| RC owner ≠ driver name | Driving someone else's vehicle OK |
| PAN not linked to Aadhaar | Warning only |
| Insurance < 30 days remaining | Driver should renew soon |

---

## Admin Hard Restrictions (Cannot Approve)

Even admin cannot approve — system returns 400:

| Restriction | Check |
|---|---|
| Document tampering | `is_overwritten` or `is_photo_imposed` = true |
| Duplicate doc | `DUPLICATE_NUMBER` fraud flag exists |
| Driver age < 18 | DL `extracted_data.dob` → age calculation |
| DL not active | `dl_status` != `ACTIVE` |
| PAN inactive | `pan_status` != `E` |
| RC expired | `registration_validity` < today |

---

## Fraud Flag Types

| Flag | Severity | Trigger |
|---|---|---|
| `TEMPLATE_TAMPERING` | HIGH | `is_overwritten` / `is_photo_imposed` / `is_forged` |
| `DUPLICATE_NUMBER` | HIGH | Same doc hash on 2 accounts |
| `FACE_MISMATCH` | HIGH/MEDIUM | Selfie similarity < threshold |
| `EXPIRED_DOC` | HIGH | DL expiry < 90 days |
| `INSURANCE_EXPIRED` | HIGH | VAHAN insurance expired (from RC) |
| `FITNESS_EXPIRED` | HIGH | VAHAN fitness cert expired (from RC) |
| `INSURANCE_EXPIRING_SOON` | MEDIUM | Insurance < 30 days remaining |
| `NAME_MISMATCH` | MEDIUM | Doc name vs profile name below threshold |
| `CROSS_DOC_MISMATCH` | MEDIUM | Cross-verify name/DOB/RC inconsistency |
| `VELOCITY` | MEDIUM | > 5 submissions in 24hrs |

---

## Notifications

Driver gets FCM + in-app on every status change:

| Event | Notification |
|---|---|
| Doc → `auto_verified` | "{Doc} Verified" |
| Doc → `manual_review` | "{Doc} Under Review — 24hrs wait" |
| Doc → `rejected` | "{Doc} Rejected — reason + N attempts left" |
| Admin approves | "{Doc} Approved by our team" |
| Admin rejects | "{Doc} Rejected — reason + support" |
| Cross-verify flags doc | "{Doc} Under Review — flagged for manual check" |
| Cross-verify has failures | "N document(s) require manual review" |
| All 6 verified | "KYC Complete — you can now go online" |

---

## Data Stored Per Document

| Doc | Key Extracted Fields |
|-----|---------------------|
| AADHAAR | name, dob, gender, state, address (back), pin_code, district, masked UID |
| PAN | name, father, dob, pan_status, aadhaar_linked, name_match, dob_match, govt_verified |
| DRIVING_LICENCE | name, guardian, dob, blood_group, address, issue_date, expiry_date, dl_status, photo_url, govt_verified |
| VEHICLE_RC | owner, vehicle_model, vehicle_type, manufacturer, chassis_number, engine_number, registration_validity, **insurance_expiry, insurance_days_left, fitness_expiry, permit_expiry, rc_status, vahan_verified** |
| BANK_ACCOUNT | holder_name, bank_name, branch, city, micr, account_status, name_match_score, ifsc_details |
| SELFIE | similarity_score, aadhaar_doc_id, aadhaar_file_url |

---

## Database Tables

| Table | Purpose |
|---|---|
| `kyc_documents` | One row per driver per doc type. Status, extracted_data (JSONB), file_url, attempt_count, fraud_score, confidence_score |
| `driver_kyc_status` | Aggregate per driver — overall_status, doc counts, pre_check_report (cross-verify report) |
| `kyc_fraud_flags` | Fraud events per document (append-only) |
| `kyc_audit_log` | Full history of every status change with before/after state (append-only) |

### Migrations (run in order)
```bash
npm run migrate
# 043 → notifications table
# 044 → kyc_documents, driver_kyc_status, kyc_fraud_flags, kyc_audit_log
# 045 → drop legacy KYC tables
# 046 → add pre_check_report column to driver_kyc_status
```

---

## Environment Variables

```env
CASHFREE_ENV=sandbox                    # sandbox | production
CASHFREE_CLIENT_ID=...
CASHFREE_CLIENT_SECRET=...
CASHFREE_PUBLIC_KEY=...                 # RSA key for x-cf-signature

KYC_AUTO_THRESHOLD=85                   # Score >= this + no flags → auto_verified
KYC_REVIEW_THRESHOLD=60                 # Score >= this → manual_review (else reject)
CASHFREE_FACE_MATCH_THRESHOLD=75        # Selfie similarity % → auto_verified
CASHFREE_NAME_MATCH_THRESHOLD=70        # Name fuzzy match minimum %
KYC_INSURANCE_EXPIRY_MIN_DAYS=30        # Insurance < N days → EXPIRING_SOON flag

AWS_BUCKET_NAME=go-mobility-kyc
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

---

## Key Files

```
src/modules/kyc/
├── services/
│   ├── kycService.js              submitDocument, submitBankAccount, submitFaceMatch, admin actions
│   ├── kycScoringService.js       Confidence scoring (0-100), fraud checks, hash dedup, auto vs manual decision
│   ├── kycCrossVerifyService.js   Cross-doc checks (name/DOB/RC type/insurance/fitness)
│   ├── kycNotificationService.js  FCM + in-app notifications
│   └── cashfreeService.js         Cashfree API wrappers (smartOcr, verifyBankAccount, matchFace)
├── repositories/
│   └── kycDocuments.repository.js All DB queries, recomputeAggregate, cross-verify trigger
├── controllers/
│   └── kycController.js
├── routes/
│   └── kycRoutes.js
└── middleware/
    └── kycUpload.middleware.js    Multer config, PDF size limit enforcement
```
