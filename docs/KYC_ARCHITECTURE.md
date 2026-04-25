# KYC System v2 — Architecture & Current State

**Branch:** `kyc-upgrade`  
**Last updated:** 2026-04-26  
**Status:** Complete — all phases shipped.

---

## System Overview

Admin is the final approver on all documents. The system does automated checks (OCR, fraud detection, cross-verification) and puts everything in a queue for admin review. No document auto-approves — admin clicks approve/reject.

```
Driver uploads doc
       │
       ▼
Cashfree OCR + Scoring  (~2–4 sec, synchronous)
       │
       ├─ Hard fail  (tampering / DL expiry) → rejected
       ├─ Low confidence (< 60)             → rejected  ← admin can override if system-rejected
       └─ Everything else                   → manual_review
       │
       ▼
Admin Queue  (GET /admin/kyc/drivers → click driver → see all 6 docs)
       │
       ├─ Approve → approved  (state is FINAL — cannot reject after this)
       └─ Reject  → rejected  (state is FINAL — cannot approve after admin rejects)
                               System-rejected (reviewed_by=NULL) CAN be overridden by admin
       │
       ▼
All 6 docs approved → overall_status = 'verified' → driver can go online
```

---

## All Routes

### Driver (`/api/v1/kyc/`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/status` | Full KYC status + per-doc status (6 docs) |
| POST | `/submit` | Upload OCR doc (AADHAAR/PAN/DRIVING_LICENCE/VEHICLE_RC). `file` + optional `file_back` (Aadhaar address) |
| POST | `/documents/:id/retry` | Retry system-rejected doc (max 3 attempts) |
| POST | `/bank` | Penny-drop bank verification |
| POST | `/face-match` | Selfie upload — Cashfree matchFace vs Aadhaar |

### Admin (`/api/v1/kyc/admin/`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/drivers` | Paginated driver list with KYC summary. `?status=pending_review` to filter |
| GET | `/drivers/:userId` | Full detail for one driver — all 6 docs + pre_check_report |
| GET | `/queue` | Doc-level queue. `?status=manual_review\|rejected\|all` + `?type=SELFIE` |
| GET | `/documents/:id` | Single doc detail |
| POST | `/documents/:id/approve` | Approve (with hard restriction checks) |
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
    "verifiedDocs": 0,
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

## Document Data Stored

All docs store clean extracted fields + full `cashfree_ocr` raw JSON.

| Doc | Key fields |
|-----|-----------|
| AADHAAR | name, dob, gender, state, address (back), pin_code, district, masked UID |
| PAN | name, father, dob, pan_status, aadhaar_linked, name_match, dob_match |
| DRIVING_LICENCE | name, guardian, dob, blood_group, address, issue_date, expiry_date, dl_status, photo_url |
| VEHICLE_RC | owner, relation_name, vehicle_model, vehicle_type, manufacturer, chassis_number, engine_number, registration_validity |
| BANK_ACCOUNT | holder_name, bank_name, branch, city, micr, account_status, ifsc_details |
| SELFIE | similarity_score, aadhaar_file_url (for admin side-by-side comparison) |

---

## Scoring Engine

```
confidence (40%) + name_match (20%) + velocity (20%) + cross_doc (20%) = 0–100

>= 60  → manual_review  (goes to admin queue)
< 60   → rejected       (admin can override if system-rejected)

Hard fails (always rejected, no admin override on auto path):
  is_overwritten / is_photo_imposed  → rejected (actual tampering)
  is_forged alone                    → manual_review (Cashfree WhatsApp compression false positive)
  duplicate hash                     → rejected (same doc on 2 accounts)
  DL expiry < 90 days               → rejected
```

---

## Admin Hard Restrictions (Cannot Approve)

Even admin cannot approve these — system blocks with 400:

| Restriction | Check |
|---|---|
| Document tampering | `is_overwritten` or `is_photo_imposed` = true |
| Duplicate doc | `DUPLICATE_NUMBER` fraud flag exists |
| Driver age < 18 | DL `extracted_data.dob` → age calculation |
| DL not active | `dl_status` != `ACTIVE` |
| PAN inactive | `pan_status` != `E` |
| RC expired | `registration_validity` < today |

---

## Document State Machine

```
            SUBMIT
              │
              ▼
         manual_review  ◄─── system-rejected (reviewed_by=NULL) ← admin can override
              │
       ┌──────┴──────┐
       ▼             ▼
   approved       rejected   ← admin decision is FINAL
   (FINAL)        (FINAL)
      │
      ▼ (all 6 approved)
   verified
```

---

## Cross-Document Verification

Runs automatically (background, non-blocking) when all 6 docs submitted.

**Hard checks** (fail → doc downgraded to manual_review + CROSS_DOC_MISMATCH fraud flag):
1. Aadhaar name ≈ PAN name (fuzzy >= 70%)
2. Aadhaar name ≈ DL name
3. Aadhaar DOB = PAN DOB
4. Aadhaar DOB = DL DOB
5. PAN `pan_status` = 'E'
6. DL `dl_status` = 'ACTIVE'
7. RC `vehicle_type` matches driver's registered vehicle type
8. RC `registration_validity` not expired

**Soft warnings** (flagged in report, not blocked):
- Bank holder name ≠ driver name (family account OK)
- RC owner ≠ driver name (someone else's vehicle OK)
- PAN not linked to Aadhaar

Report saved to `driver_kyc_status.pre_check_report` (JSONB) — visible to admin in driver detail.

---

## Notifications (English only)

Driver gets FCM + in-app notification on every status change:

| Event | Notification |
|---|---|
| Doc → manual_review | "Aadhaar Under Review — you'll be notified within 24 hours" |
| Doc → auto_verified (internal) | "Aadhaar Verified" |
| Admin approves | "Aadhaar Approved by our team" |
| Admin rejects | "Aadhaar Rejected — X attempts remaining" |
| Cross-verify flags a doc | "Aadhaar Under Review — flagged for manual verification" |
| Cross-verify fails | "X document(s) require manual review due to inconsistencies" |
| All 6 docs verified | "KYC Verification Complete — you can now go online" |

---

## Database Tables

| Table | Purpose |
|---|---|
| `kyc_documents` | One row per driver per doc type. Stores status, extracted_data (JSONB), file_url, attempt_count, fraud_score |
| `driver_kyc_status` | Aggregate per driver — overall_status, doc counts, pre_check_report |
| `kyc_fraud_flags` | Fraud events per document |
| `kyc_audit_log` | Full history of every status change with before/after state |
| `notifications` | In-app notifications |

### Migrations (run in order)
```bash
npm run migrate
# 042 → admin user seed
# 043 → notifications table
# 044 → kyc_documents, driver_kyc_status, kyc_fraud_flags, kyc_audit_log
# 045 → drop legacy KYC tables
# 046 → add pre_check_report column to driver_kyc_status
```

---

## Key Files

```
src/modules/kyc/
├── services/
│   ├── kycService.js              Main service — submitDocument, submitBankAccount, submitFaceMatch, admin actions
│   ├── kycScoringService.js       Confidence scoring, fraud checks, hash dedup
│   ├── kycCrossVerifyService.js   Cross-doc consistency checks (name/DOB/RC/PAN/DL)
│   ├── kycNotificationService.js  FCM + in-app notifications (English only)
│   └── cashfreeService.js         Cashfree API wrappers (smartOcr, verifyBankAccount, matchFace)
├── repositories/
│   └── kycDocuments.repository.js All DB queries, recomputeAggregate, listDriversForAdmin
├── controllers/
│   └── kycController.js
├── routes/
│   └── kycRoutes.js
└── middleware/
    └── kycUpload.middleware.js    Multer config, PDF size enforcement
```
