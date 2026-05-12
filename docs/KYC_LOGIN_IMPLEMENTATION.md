# GoMobility — KYC System: Complete Reference

> **Audience:** Founders, PMs, designers, and developers.
> Non-tech explanation pehle, technical details baad mein — dono ek hi document mein.

---

## 1. KYC Kya Hai Aur Kyun Zaroori Hai (Non-Tech)

KYC = "Know Your Customer" — matlab driver ka background verify karna before wo rides le sake.

Socho ek security guard jo gate pe check karta hai. Driver app install karta hai, documents deta hai — system automatically check karta hai ki:
- Ye aadmi real hai?
- Documents genuine hain?
- License valid hai?
- Gaadi ka insurance/RC theek hai?
- Bank account sahi hai?
- Selfie document se match karti hai?

Agar sab theek → driver 60 seconds ke andar **online ho sakta hai** (bina kisi admin ke).
Agar kuch gadbad → admin ke paas **manually review** ke liye jaata hai.

---

## 2. Do KYC Systems Hain (Important!)

### System A — Manual KYC (Legacy/Old)
- **Kahan:** `/api/v1/drivers/add-aadhar`, `add-pancard`, etc.
- **Kya karta hai:** Driver document upload karta hai → Admin manually dekh ke approve karta hai
- **Status:** Abhi login response mein dikhta hai (backward compatibility ke liye)
- **Future:** Eventually hataya jayega

### System B — Smart OCR KYC (New / Active)
- **Kahan:** `/api/v1/kyc/submit`, `/kyc/bank`, `/kyc/face-match`
- **Kya karta hai:** AI + government databases se automatic verification
- **Status:** Yahi production mein use karna hai

> ⚠️ Dono systems simultaneously chal rahe hain. Frontend ko **System B** use karna chahiye.

---

## 3. Documents Jo Driver Ko Dene Hain (System B)

| # | Document | Kaise Verify Hota Hai | Speed |
|---|---|---|---|
| 1 | **Aadhaar Card** | Cashfree OCR → UIDAI pattern check | ~10 sec |
| 2 | **PAN Card** | Cashfree OCR → NSDL government DB | ~15 sec |
| 3 | **Driving Licence** | Cashfree OCR → Sarathi government DB | ~15 sec |
| 4 | **Vehicle RC** | Cashfree OCR → **VAHAN DB** (insurance + fitness bhi) | ~20 sec |
| 5 | **Bank Account** | Cashfree Penny-Drop (₹1 transfer test) | ~10 sec |
| 6 | **Selfie** | AI face match vs Aadhaar photo | ~10 sec |

**Total agar sab pass:** ~60-90 seconds mein driver verified.

---

## 4. Driver Ka Step-by-Step Journey (Non-Tech)

```
Driver app download karta hai
        ↓
Phone number se signup (OTP)
        ↓
KYC Screen aati hai — 6 steps dikhti hain
        ↓
┌─────────────────────────────────────────┐
│  Step 1: Aadhaar upload karo            │
│  Step 2: PAN upload karo               │
│  Step 3: Driving Licence upload karo   │
│  Step 4: RC upload karo                │
│  Step 5: Bank details enter karo       │
│  Step 6: Selfie lo                     │
└─────────────────────────────────────────┘
        ↓
System automatically verify karta hai
        ↓
    ┌───────────────────────────────────┐
    │  Sab sahi?                        │
    │  → auto_verified in 60 sec        │
    │  → Driver ONLINE ho sakta hai ✅   │
    └───────────────────────────────────┘
          |
          | Kuch suspicious?
          ↓
    ┌───────────────────────────────────┐
    │  manual_review                    │
    │  → Admin queue mein jaata hai     │
    │  → Admin 24hrs mein decide karta  │
    └───────────────────────────────────┘
          |
          | Fraud/Fake?
          ↓
    ┌───────────────────────────────────┐
    │  rejected                         │
    │  → Driver ko reason bataaya jaata │
    │  → 3 chances milte hain retry ke  │
    └───────────────────────────────────┘
```

---

## 5. RC Upload Pe VAHAN Se Insurance + Fitness Bhi Check Hoti Hai

Uber/Rapido style — driver ko alag insurance document upload nahi karna padta.
Jab RC submit hoti hai, system **VAHAN government database** se yeh sab automatically fetch karta hai:

| VAHAN Se Kya Milta Hai | Auto-Check |
|---|---|
| Insurance expiry | Expired → Hard reject |
| Insurance < 30 days bachi | Warning flag |
| Fitness certificate expiry | Expired → Manual review |
| Permit details | Store for reference |
| RC registration validity | Expired → Reject |
| RC status (active/cancelled) | Cancelled → Reject |

---

## 6. Status Enums — Ek Document Ka Status

Har ek document (Aadhaar, PAN, DL, RC, Bank, Selfie) ka apna status hota hai:

```
pending
  → System ne submit receive kar liya, process ho raha hai

auto_verified
  → Government DB ne confirm kar diya, AI ne pass kar diya
  → Koi human review nahi laga
  → Best case ✅

manual_review
  → Kuch suspicious mila (naam thoda alag, image blurry, etc.)
  → Admin ke queue mein hai
  → Driver ko wait karna padega

approved
  → Admin ne manually dekh ke approve kar diya
  → Same as auto_verified in effect ✅

rejected
  → Document invalid / tampered / expired / mismatch
  → Driver ko reason milta hai
  → 3 attempts milte hain retry ke liye

[3 attempts ke baad rejected → account suspended]
```

### Visual:

```
                    ┌──────────────────────────────┐
                    │           SUBMIT              │
                    └──────────────┬───────────────┘
                                   ↓
                              [ pending ]
                                   ↓
               ┌───────────────────┼───────────────────┐
               ↓                   ↓                   ↓
        Score ≥ 85           Score 60-84           Score < 60
        No red flags         OR any flag           OR hard fail
               ↓                   ↓                   ↓
       [auto_verified]      [manual_review]         [rejected]
               ✅                  ↓                   ↓
                            Admin dekhe         Retry (max 3x)
                            ↓         ↓               ↓
                        [approved]  [rejected]    [suspended]
                            ✅          ↓
                                   Retry (max 3x)
```

---

## 7. Overall KYC Status Enums (Driver Ka Total Status)

Jab saare 6 documents ka combination dekha jaaye, driver ka **overall status** banta hai:

```
not_started
  → Driver ne abhi koi document submit nahi kiya
  → App dikhayegi: KYC Intro Screen

in_progress
  → Kuch documents submit hue, kuch baaki hain
  → App dikhayegi: Resume KYC Screen

pending_review
  → Saare 6 documents submit ho gaye
  → Koi rejected nahi, kuch manual_review mein hain
  → App dikhayegi: "Verification in progress, 24hrs wait karo"

verified
  → Saare 6 documents auto_verified ya approved
  → Driver rides le sakta hai ✅
  → App dikhayegi: Home/Dashboard

rejected
  → Koi document rejected hai, aur driver ne retry nahi kiya abhi
  → App dikhayegi: KYC Retry Screen (kaun sa doc fix karo)

suspended
  → 3 baar try kar ke bhi fail / fraud detect hua / admin ne suspend kiya
  → Driver account band
  → App dikhayegi: Account Suspended Screen (support contact)
```

### Frontend Screen Routing (Login Pe):

```javascript
// Login response mein yeh aata hai:
nextScreen:
  "HOME"              → verified driver, dashboard pe bhejo
  "KYC_INTRO"         → not_started, fresh onboarding
  "KYC_UPLOAD"        → in_progress, resume karo
  "KYC_UNDER_REVIEW"  → pending_review, wait karo
  "KYC_RETRY"         → rejected, fix karo
  "ACCOUNT_SUSPENDED" → suspended, support se contact karo
```

---

## 8. Scoring System — Auto vs Manual Ka Decision Kaise Hota Hai (Tech)

Jab document submit hota hai, system ek **confidence score (0-100)** calculate karta hai:

| Factor | Max Points | Kaise |
|---|---|---|
| Image quality (blur, glare, partial) | 40 | Cashfree quality_checks |
| Name match (doc vs driver profile) | 20 | Token-based similarity |
| Velocity check (too many submissions) | 20 | Redis rate counter |
| Cross-doc name consistency (vs Aadhaar) | 20 | Compare with already submitted docs |
| **Total** | **100** | |

**Decision:**

| Score | Flags | Result |
|---|---|---|
| ≥ 85 | None | `auto_verified` ✅ |
| ≥ 85 | Any flag | `manual_review` |
| 60–84 | Any | `manual_review` |
| < 60 | Any | `rejected` |

**Hard Fails (score ignore, direct reject/review):**
- Document tampered (`is_overwritten` / `is_photo_imposed`) → `rejected`
- Document forged suspicious (`is_forged`) → `manual_review`
- Same document already registered to another account → `rejected`
- DL expires within 90 days → `rejected`
- PAN not valid in NSDL → `rejected` (production only)
- DL not ACTIVE in Sarathi → `rejected` (production only)
- Vehicle insurance expired (VAHAN) → `rejected`

---

## 9. Cross-Verification (Saare Docs Submit Hone Ke Baad)

Jab driver ke saare 6 documents submit ho jaate hain, system automatically ek **cross-check** run karta hai — ensure kare ki sab documents ek hi person ke hain.

### Checks Jo Run Hote Hain:

| Check | Kya Hota Hai Fail Pe |
|---|---|
| Aadhaar name ≈ PAN name (≥70% match) | `manual_review` |
| Aadhaar name ≈ DL name (≥70% match) | `manual_review` |
| Bank holder name ≈ Aadhaar name | Warning only (family account ho sakta hai) |
| Aadhaar DOB = PAN DOB | `manual_review` |
| Aadhaar DOB = DL DOB | `manual_review` |
| PAN status = 'E' (active) | `manual_review` |
| PAN Aadhaar linked | Warning only |
| DL status = ACTIVE | `manual_review` |
| RC vehicle type = Driver's registered vehicle type | `manual_review` |
| RC registration validity | `manual_review` |
| Insurance expired (VAHAN) | `manual_review` |
| Insurance < 30 days | Warning only |
| Fitness certificate expired (VAHAN) | `manual_review` |
| RC owner name ≈ Aadhaar name | Warning only (gaadi kisi aur ki ho sakti hai) |

---

## 10. Admin Panel — Kya Controls Milte Hain

### Admin Kya Kar Sakta Hai:

| Action | Endpoint | Effect |
|---|---|---|
| Saare drivers dekhna | `GET /kyc/admin/drivers` | Status filter ke saath list |
| Ek driver ki full detail | `GET /kyc/admin/drivers/:userId` | Saare docs + fraud flags |
| Review queue dekhna | `GET /kyc/admin/queue` | Manual review mein pending docs |
| Document approve karna | `POST /kyc/admin/documents/:id/approve` | `approved` → driver verified |
| Document reject karna | `POST /kyc/admin/documents/:id/reject` | `rejected` + reason |
| Fraud alerts dekhna | `GET /kyc/admin/fraud-alerts?severity=HIGH` | All flagged cases |
| Driver suspend karna | `POST /kyc/admin/drivers/:userId/suspend` | Account band |

### Admin Kya NAHI Kar Sakta (Hard Restrictions):

| Restriction | Reason |
|---|---|
| Tampered document approve nahi kar sakta | System block karta hai |
| Duplicate document approve nahi kar sakta | Ek document ek hi account pe |
| Under-18 driver approve nahi kar sakta | DL DOB se check |
| Inactive PAN approve nahi kar sakta | NSDL check |
| Inactive DL approve nahi kar sakta | Sarathi check |
| Expired RC approve nahi kar sakta | Registration validity check |
| Admin-rejected document dubara approve nahi kar sakta | Final decision hota hai |

---

## 11. Notifications (Driver Ko Kab Kya Milta Hai)

| Event | Notification Title | Message |
|---|---|---|
| Doc auto_verified | "Aadhaar Verified" | Successfully verified |
| Doc manual_review | "Aadhaar Under Review" | 24hrs wait karo |
| Doc rejected | "Aadhaar Rejected" | Reason + attempts left |
| Admin approved | "Aadhaar Approved" | Approved by team |
| Admin rejected | "Aadhaar Rejected" | Reason + support |
| KYC complete | "KYC Verification Complete" | Ab online ho sakte ho |
| Cross-verify fail | "Document Review Required" | N docs flag hue |

Notifications = **Push (FCM)** + **In-app notification DB** dono.

---

## 12. Retry Rules

| Situation | Retry Allowed? |
|---|---|
| System ne reject kiya (image unclear, etc.) | Haan, max 3 attempts |
| Admin ne reject kiya (with allowRetry=true) | Haan |
| Admin ne reject kiya (with allowRetry=false) | Nahi — final decision |
| 3 attempts exhaust → overall status | `suspended` |
| Already `auto_verified` ya `approved` | Nahi — can't resubmit |

---

## 13. API Reference — Driver Endpoints (System B)

```
GET  /api/v1/kyc/status
     → Poora KYC status (saare docs + nextAction hint)

POST /api/v1/kyc/submit
     Body: multipart/form-data
       document_type: AADHAAR | PAN | DRIVING_LICENCE | VEHICLE_RC
       file: <image/pdf>
       file_back: <image> (optional, Aadhaar ke liye address fetch)

POST /api/v1/kyc/documents/:id/retry
     Body: multipart/form-data
       file: <image/pdf>

POST /api/v1/kyc/bank
     Body: { account_number, ifsc, name }

POST /api/v1/kyc/face-match
     Body: multipart/form-data
       selfie: <image>
```

---

## 14. Login Response Mein KYC (Dono Systems)

Driver login karne pe response mein yeh aata hai:

```json
{
  "user": { ... },
  "tokens": { ... },

  // System B (Smart OCR) — use this
  "kycV2": {
    "overallStatus": "in_progress",
    "submittedDocs": 3,
    "verifiedDocs": 2,
    "canGoOnline": false,
    "verifiedAt": null,
    "nextScreen": "KYC_UPLOAD"
  },

  // System A (Manual/Legacy) — backward compat only
  "kyc": {
    "kycStatus": "in_progress",
    "documentStatus": {
      "aadhaar": true,
      "pan": false,
      "bank": false,
      "license": false,
      "vehicle": false
    },
    "allDocumentsSubmitted": false,
    "isDriverVerified": false
  }
}
```

> **Frontend Rule:** `kycV2.nextScreen` use karo routing ke liye. `kyc` (System A) ignore karo.

---

## 15. Database Tables (Tech Reference)

```
kyc_documents          — Har document ka record (ek row per doc per user)
driver_kyc_status      — Driver ka overall aggregate status (single row per driver)
kyc_fraud_flags        — Fraud/suspicious flags (append-only log)
kyc_audit_log          — Har action ka trail (submit, verify, reject, approve)
```

### `kyc_documents` Key Columns:

| Column | Type | Values |
|---|---|---|
| `document_type` | string | `AADHAAR` \| `PAN` \| `DRIVING_LICENCE` \| `VEHICLE_RC` \| `BANK_ACCOUNT` \| `SELFIE` |
| `method` | string | `OCR` \| `PENNY_DROP` \| `FACE_MATCH` |
| `status` | string | `pending` \| `auto_verified` \| `manual_review` \| `approved` \| `rejected` |
| `confidence_score` | integer | 0–100 |
| `fraud_score` | integer | 0–100 (higher = more suspicious) |
| `extracted_data` | JSON | OCR se nikala hua data |
| `attempt_count` | integer | 1–3 |
| `reviewed_by` | UUID | Admin ka ID (agar human review hua) |

### `driver_kyc_status` Key Columns:

| Column | Type | Values |
|---|---|---|
| `overall_status` | string | `not_started` \| `in_progress` \| `pending_review` \| `verified` \| `rejected` \| `suspended` |
| `submitted_docs_count` | integer | 0–6 |
| `verified_docs_count` | integer | 0–6 |
| `verified_at` | timestamp | Jab sab 6 verify hue |
| `suspended_at` | timestamp | Agar suspended |
| `pre_check_report` | JSON | Cross-verify ka full report |

### `kyc_fraud_flags` Flag Types:

| Flag | Severity | Matlab |
|---|---|---|
| `TEMPLATE_TAMPERING` | HIGH | Document edit/forged hai |
| `DUPLICATE_NUMBER` | HIGH | Yeh doc kisi aur ke account pe hai |
| `FACE_MISMATCH` | HIGH/MEDIUM | Selfie document se match nahi karti |
| `EXPIRED_DOC` | HIGH | DL/RC expire ho gaya |
| `INSURANCE_EXPIRED` | HIGH | VAHAN se insurance expired |
| `FITNESS_EXPIRED` | HIGH | VAHAN se fitness cert expired |
| `INSURANCE_EXPIRING_SOON` | MEDIUM | 30 din mein expire hogi |
| `NAME_MISMATCH` | MEDIUM | Doc ka naam profile se alag |
| `CROSS_DOC_MISMATCH` | MEDIUM | Alag docs mein naam/DOB alag |
| `VELOCITY` | MEDIUM | Bahut zyada submissions ek din mein |

---

## 16. Environment Variables (KYC Related)

```env
CASHFREE_ENV=sandbox                  # sandbox | production
CASHFREE_CLIENT_ID=...
CASHFREE_CLIENT_SECRET=...
CASHFREE_PUBLIC_KEY=...               # RSA key for signature

KYC_AUTO_THRESHOLD=85                 # Score >= yeh → auto_verified
KYC_REVIEW_THRESHOLD=60              # Score >= yeh → manual_review (else reject)
CASHFREE_FACE_MATCH_THRESHOLD=75     # Face similarity % → auto_verified selfie
CASHFREE_NAME_MATCH_THRESHOLD=70     # Name similarity % minimum

KYC_INSURANCE_EXPIRY_MIN_DAYS=30     # Insurance < 30 days → warning flag

AWS_BUCKET_NAME=go-mobility-kyc      # S3 bucket for document storage
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

---

## 17. What Happens Internally — Full Technical Flow

```
Driver submits document
        │
        ▼
1. S3 pe upload (original file preserve)
        │
        ▼
2. DB mein pending record create
        │
        ▼
3. Cashfree SmartOCR API call
   (PAN/DL → govt DB verify bhi)
   (RC → VAHAN call → insurance + fitness data)
        │
        ├── OCR fail → rejected (image unclear)
        │
        ▼
4. Fields extract karo (naam, number, DOB, expiry, etc.)
        │
        ▼
5. Hard fail checks:
   - Tampered? → rejected
   - Duplicate doc number? → rejected
   - DL/RC expired? → rejected
   - Insurance expired (RC)? → rejected
        │
        ▼
6. Confidence score calculate karo (0-100)
   [image quality + name match + velocity + cross-doc]
        │
        ▼
7. Decision:
   score ≥ 85, no flags → auto_verified
   score ≥ 60 OR any flag → manual_review
   score < 60 → rejected
        │
        ▼
8. DB update + audit log + fraud flags
        │
        ▼
9. recomputeAggregate → overall_status update
        │
        ├── All 6 submitted? → runCrossVerify() [background]
        │   (naam consistency, DOB match, RC type, insurance, fitness)
        │
        ▼
10. Push notification + FCM to driver
```

---

*Last updated: April 2026 — GoMobility KYC v2 (Smart OCR + VAHAN integration)*
