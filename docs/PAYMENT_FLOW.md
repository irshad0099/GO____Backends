# GoMobility — Payment Flow (Full Reference)

Ek complete guide jo explain karta hai ki har payment method mein paisa kaise chalta hai —
passenger se lekar driver ke wallet tak — APIs, webhooks, aur database changes ke saath.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Payment Methods Summary](#2-payment-methods-summary)
3. [Common Ride Flow (All Methods)](#3-common-ride-flow-all-methods)
4. [Method A — Cash](#4-method-a--cash)
5. [Method B — Personal UPI](#5-method-b--personal-upi)
6. [Method C — GoMobility QR](#6-method-c--gomobility-qr)
7. [Method D — Wallet](#7-method-d--wallet)
8. [Method E — Card / Online UPI (Razorpay)](#8-method-e--card--online-upi-razorpay)
9. [Razorpay Webhook Flow](#9-razorpay-webhook-flow)
10. [Auto-Deduction (Cross-method recovery)](#10-auto-deduction-cross-method-recovery)
11. [Key Database Tables](#11-key-database-tables)
12. [Socket Events Reference](#12-socket-events-reference)

---

## 1. Architecture Overview

```
Passenger App ──► REST API (Express) ──► PostgreSQL
                         │                    │
Driver App ──────────────┤               Redis (sessions)
                         │
                    Socket.IO ◄──── Real-time events
                         │
                    Razorpay ◄───── Online payments + Webhooks
```

**Key rule:** Paisa kabhi bhi directly passenger se driver ke paas nahi jata.
Platform (GoMobility) always beech mein hota hai — either as a UPI payee or as a debt tracker.

---

## 2. Payment Methods Summary

| Method | Paisa kahan jata hai | Driver deposit chahiye? | Earnings kab milti hai |
|---|---|---|---|
| **Cash** | Driver ke haath (physical) | YES — platform_share deposit karna hoga | Deposit ke baad |
| **Personal UPI** | Driver ke bank account | YES — same as cash | Deposit ke baad |
| **GoMobility QR** | GoMobility UPI (gomobility@upi) | NO | Immediately |
| **Wallet** | Platform wallet deduct (auto) | NO | Immediately |
| **Card/Online UPI** | Razorpay → Platform | NO | After webhook confirms |
| **Corporate** | Company invoice | NO | End of month |

---

## 3. Common Ride Flow (All Methods)

Yeh steps **har payment method** ke liye same hain.

### Step 1 — Passenger: Ride Request
**API:** `POST /api/v1/rides/request`
```json
{
  "pickup_latitude": 19.076,
  "pickup_longitude": 72.877,
  "pickup_address": "Andheri Station",
  "dropoff_latitude": 19.060,
  "dropoff_longitude": 72.835,
  "dropoff_address": "Bandra Kurla Complex",
  "vehicle_type": "auto",
  "payment_method": "cash"
}
```
**Response contains:**
- `rideId` — ye ID baad mein sab jagah use hogi
- `estimatedFare` — approximate charge
- `platformFee` — GoMobility ka commission (e.g., ₹5 on ₹53 fare)

**DB:** New row in `rides` table, `status = 'requested'`

**Socket:** `ride:new_request` event broadcast to nearby drivers

---

### Step 2 — Driver: Accept Ride
**API:** `POST /api/v1/rides/accept`
```json
{ "rideId": 42 }
```
**Socket event received by driver:** `ride:new_request`
**Socket event sent to passenger:** `ride:accepted`

**DB:** `rides.driver_id` set, `status = 'accepted'`

---

### Step 3 — Driver: Arrive at Pickup
**API:** `PATCH /api/v1/rides/{rideId}/status`
```json
{ "status": "driver_arrived" }
```

---

### Step 4 — Passenger: Verify OTP (ride starts)
**API:** `POST /api/v1/rides/{rideId}/verify-otp`
```json
{ "otp": "1398" }
```
**DB:** `status = 'in_progress'`

---

### Step 5 — Driver: Complete Ride
**API:** `PATCH /api/v1/rides/{rideId}/status`
```json
{ "status": "completed" }
```
**DB Updates at this point:**
- `rides.status = 'completed'`
- `rides.actual_fare` = final calculated fare
- `rides.final_fare` = passenger pays this
- `rides.platform_share` = GoMobility commission (e.g., ₹5) ← **[BUG FIX APPLIED]**
- `rides.fare_before_gst`, `rides.gst_on_fare` = tax breakdown
- `rides.waiting_charges` = time compensation
- `rides.completed_at` = NOW()

**Payment flow now diverges based on `payment_method`.**

---

## 4. Method A — Cash

**Scenario:** Passenger ne driver ko haath mein notes diye.

### Flow Diagram
```
Ride Complete
     │
     ▼
Driver taps "Cash Received" button in app
     │
     ▼
POST /api/v1/rides/collect-confirm  ← Driver API
     │
     ▼
DB: payment_status = 'collected_by_driver'
    cash_collections (new row created)
    driver_cash_balance.pending_amount += platform_share  ← company ka dues
    driver_cash_balance.pending_net_earnings += netEarnings ← driver ka paisa HOLD
     │
     ▼
Socket: driver:cash_dues_updated (driver ko dikha do)
Socket: ride:payment_settled (passenger ko confirm karo)
     │
     ▼
[Later — Driver deposits platform_share]
POST /api/v1/drivers/cash/deposit
     │
     ▼
DB: pending_amount -= depositAmount
    pending_net_earnings = 0 (release)
    driver.wallet += netEarnings  ← ab driver wallet mein paisa aaya
```

### APIs

#### A1 — Collect Confirm (Driver confirms cash received)
**API:** `POST /api/v1/rides/collect-confirm`
```json
{
  "ride_id": 42,
  "method": "cash"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Cash collected. Deposit ₹5 to receive your ₹48 earnings.",
  "data": {
    "rideId": 42,
    "method": "cash",
    "finalFare": 53,
    "netEarnings": 48,
    "platformShareDue": 5,
    "earningsOnHold": 48
  }
}
```

#### A2 — Check Cash Balance (Driver's dues dashboard)
**API:** `GET /api/v1/drivers/cash/balance`
```json
{
  "success": true,
  "data": {
    "pendingAmount": 5,
    "totalCashCollected": 53,
    "totalDeposited": 0,
    "pendingNetEarnings": 48,
    "isLimitExceeded": false,
    "cashLimit": 500
  }
}
```

#### A3 — Submit Deposit (Driver deposits platform fee)
**API:** `POST /api/v1/drivers/cash/deposit`
```json
{
  "amount": 5,
  "deposit_method": "upi",
  "reference_number": "UPI123456"
}
```
**What happens in DB:**
1. `driver_cash_balance.pending_amount -= 5`
2. `driver_cash_balance.pending_net_earnings` → released to 0
3. `driver.wallet += 48` (held netEarnings finally credited)
4. `driver.total_earnings += 48`

**Response:**
```json
{
  "success": true,
  "data": {
    "depositId": 7,
    "amount": 5,
    "heldEarningsReleased": 48,
    "walletBalance": 48,
    "message": "Deposit confirmed. ₹48 credited to wallet."
  }
}
```

---

## 5. Method B — Personal UPI

**Scenario:** Passenger ne driver ke personal UPI pe scan kar ke pay kiya (PhonePe/GPay/Paytm).
Economically **cash ke bilkul same** — paisa platform ke paas nahi aaya.

### Flow
- Exactly same as Cash (Method A)
- Only difference: `"method": "personal_upi"` in collect-confirm body

```json
POST /api/v1/rides/collect-confirm
{
  "ride_id": 42,
  "method": "personal_upi"
}
```

DB mein `collection_method_actual = 'personal_upi'` save hota hai.
Baaki sab — deposit, pending_amount, earnings hold — cash jaisa hi hai.

---

## 6. Method C — GoMobility QR

**Scenario:** Passenger ne GoMobility ka official QR scan kiya (`gomobility@upi`).
Paisa platform ke paas seedha aata hai.

### Flow Diagram
```
Ride Complete
     │
     ▼
Driver clicks "Show QR" in app
     │
     ▼
POST /api/v1/payments/qr/generate  ← Driver generates QR
     │
     ▼
Returns: qrCode (base64 image), upiUrl, orderId, expiresAt (15 min)
     │
     ▼
Passenger scans QR → pays via any UPI app
     │
     ▼
Razorpay webhook fires → POST /api/v1/payments/webhook
     │
     ▼
DB: payment_status = 'paid'
    driver.wallet += netEarnings  ← IMMEDIATE credit (no deposit needed)
Socket: driver:earnings_credited
```

### APIs

#### C1 — Generate QR
**API:** `POST /api/v1/payments/qr/generate`
```json
{
  "amount": 53,
  "purpose": "ride_payment",
  "ride_id": 42
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "order": {
      "orderNumber": "ORD-20240510-001",
      "orderId": "order_razorpay_xyz"
    },
    "qrCode": "data:image/png;base64,iVBORw0...",
    "upiUrl": "upi://pay?pa=gomobility@upi&pn=GoMobility&am=53&cu=INR",
    "expiresAt": "2024-05-10T11:15:00Z"
  }
}
```

#### C2 — Poll Status (Driver polls every 5 sec)
**API:** `GET /api/v1/payments/qr/status/{order_number}`
```json
{
  "success": true,
  "data": {
    "qrStatus": "pending",
    "order": { "status": "pending" }
  }
}
```
When paid: `"qrStatus": "completed"`

#### C3 — Close QR (if not used / expired)
**API:** `POST /api/v1/payments/qr/close`
```json
{ "order_number": "ORD-20240510-001" }
```

---

## 7. Method D — Wallet

**Scenario:** Passenger ka GoMobility wallet balance use hoga. Auto-deduction at ride completion.

### Flow
```
Driver marks ride 'completed'
     │
     ▼
System (automatic — no driver action needed):
  passenger.wallet -= finalFare
  driver.wallet    += netEarnings
     │
     ▼
rides.payment_status = 'completed'  (auto)
Socket: driver:earnings_credited (auto)
```

**No manual step needed.** Driver ko sirf ride complete karni hai.

---

## 8. Method E — Card / Online UPI (Razorpay)

**Scenario:** Passenger app mein card ya UPI (not GoMobility wallet) se pay karta hai.

### Flow
```
Ride Complete
     │
     ▼
Passenger app: POST /api/v1/payments/order/create  ← create Razorpay order
     │
     ▼
Returns: razorpayOrderId → Razorpay checkout opens in passenger app
     │
     ▼
Passenger pays on Razorpay UI
     │
     ▼
Razorpay → POST /api/v1/payments/webhook (server receives)
     │
     ▼
Server: verify signature → update DB
  rides.payment_status = 'paid'
  driver.wallet += netEarnings
Socket: driver:earnings_credited
     │
     ▼
Passenger app: POST /api/v1/payments/verify  ← optional frontend confirm step
```

### APIs

#### E1 — Create Payment Order (Passenger)
**API:** `POST /api/v1/payments/order/create`
```json
{
  "amount": 53,
  "purpose": "ride_payment",
  "ride_id": 42,
  "payment_method": "upi",
  "payment_gateway": "razorpay"
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "order": {
      "orderNumber": "ORD-20240510-002",
      "gatewayOrderId": "order_Razorpay123",
      "amount": 53,
      "currency": "INR",
      "status": "pending"
    },
    "gatewayConfig": {
      "key": "rzp_test_xxxxx",
      "amount": 5300,
      "currency": "INR",
      "name": "GoMobility",
      "orderId": "order_Razorpay123"
    }
  }
}
```

#### E2 — Verify Payment (Passenger after paying)
**API:** `POST /api/v1/payments/verify`
```json
{
  "gateway_order_id": "order_Razorpay123",
  "gateway_payment_id": "pay_Razorpay456",
  "gateway_signature": "sha256_signature_here"
}
```

---

## 9. Razorpay Webhook Flow

Jab bhi online payment hota hai (QR / Card / UPI), Razorpay humara server ko notify karta hai.

### Endpoint
```
POST /api/v1/payments/webhook
Headers: X-Razorpay-Signature: <hmac_sha256>
```

### Webhook Payload (from Razorpay)
```json
{
  "event": "payment.captured",
  "payload": {
    "payment": {
      "entity": {
        "id": "pay_Razorpay456",
        "order_id": "order_Razorpay123",
        "amount": 5300,
        "status": "captured"
      }
    }
  }
}
```

### What Server Does (Step by Step)
1. **Verify signature** — HMAC-SHA256 with Razorpay webhook secret
2. **Find order** in DB using `gateway_order_id`
3. **Find ride** linked to that order
4. **Update DB:**
   - `payment_orders.status = 'success'`
   - `payment_orders.gateway_payment_id = 'pay_Razorpay456'`
   - `rides.payment_status = 'paid'`
5. **Credit driver wallet** — `driver.wallet += netEarnings`
6. **Socket emit** — `driver:earnings_credited` to driver
7. **FCM** — notify driver about earnings

### Code Location
`src/modules/payments/controllers/webhookController.js`
`src/modules/payments/services/paymentService.js` → `verifyAndConfirmPayment()`

---

## 10. Auto-Deduction (Cross-method recovery)

**Scenario:** Driver ke paas pending cash dues hain (₹5) aur woh doosri ride online payment se karta hai.

**System automatically karta hai:**
- Jab driver ki online earnings aati hain (wallet credit)
- System pehle dekhta hai: `driver_cash_balance.pending_amount > 0`
- Agar hai toh: earnings mein se pending dues pehle kaat leta hai
- Baaki earnings driver wallet mein jati hain

**Example:**
```
Online ride earning: ₹100
Pending cash dues:   ₹5
─────────────────────────
Auto-deducted:       ₹5  (pending cleared)
Net to wallet:       ₹95
```

**Code:** `src/modules/drivers/services/earningsService.js` → `creditDriverEarnings()`

---

## 11. Key Database Tables

### `rides`
| Column | Purpose |
|---|---|
| `payment_method` | What passenger chose (cash/wallet/upi/qr) |
| `payment_status` | pending → collected_by_driver / paid / completed |
| `final_fare` | What passenger pays |
| `platform_share` | GoMobility commission (saved at ride complete) |
| `collection_method_actual` | cash / personal_upi (set at collect-confirm) |
| `collection_confirmed_at` | Timestamp when driver confirmed |

### `driver_cash_balance`
| Column | Purpose |
|---|---|
| `pending_amount` | Cash dues driver owes platform (platform_share) |
| `pending_net_earnings` | Driver's earnings on HOLD until deposit |
| `total_cash_collected` | Cumulative cash collected from passengers |
| `total_deposited` | Cumulative deposits made |
| `is_limit_exceeded` | TRUE if pending > cash_limit (₹500 default) |

### `cash_collections`
One row per ride where cash/personal_upi was used.
| Column | Purpose |
|---|---|
| `ride_id` | Which ride |
| `driver_id` | Which driver |
| `final_fare` | Total collected from passenger |
| `platform_fee` | Company's share |
| `net_earnings` | Driver's share |
| `collection_method` | cash / personal_upi |
| `status` | confirmed / disputed |

### `cash_deposits`
| Column | Purpose |
|---|---|
| `driver_id` | Who deposited |
| `amount` | How much |
| `deposit_method` | upi / bank_transfer / cash |
| `reference_number` | UPI ref / bank ref |
| `deposit_proof` | Photo URL (optional) |

### `payment_orders`
All Razorpay orders tracked here.
| Column | Purpose |
|---|---|
| `order_number` | Internal ref (ORD-YYYYMMDD-xxx) |
| `gateway_order_id` | Razorpay's order ID |
| `gateway_payment_id` | Razorpay's payment ID (after pay) |
| `status` | pending → success / failed |
| `ride_id` | Linked ride |

---

## 12. Socket Events Reference

### Driver receives:
| Event | When | Data |
|---|---|---|
| `ride:new_request` | Passenger ne ride maanga | rideId, pickup, fare |
| `driver:cash_dues_updated` | Cash collect-confirm ke baad | platformShareDue, netEarnings |
| `driver:earnings_credited` | Online payment confirmed | amount, rideId |
| `ride:payment_settled` | (Also sent to passenger) | method, amount |

### Passenger receives:
| Event | When | Data |
|---|---|---|
| `ride:accepted` | Driver ne accept kiya | driverName, vehicle |
| `ride:payment_settled` | Driver ne cash confirm kiya | method, amount |
| `driver:map_ping` | Driver location update | lat, lng |

---

## Quick Reference — Which APIs Driver Calls

| Step | API | Method |
|---|---|---|
| Go online | `PATCH /api/v1/drivers/availability` | PATCH |
| Accept ride | `POST /api/v1/rides/accept` | POST |
| Arrived | `PATCH /api/v1/rides/{id}/status` → `driver_arrived` | PATCH |
| Start ride | `POST /api/v1/rides/{id}/verify-otp` | POST |
| Complete ride | `PATCH /api/v1/rides/{id}/status` → `completed` | PATCH |
| Confirm cash | `POST /api/v1/rides/collect-confirm` | POST |
| Show QR | `POST /api/v1/payments/qr/generate` | POST |
| Check QR paid | `GET /api/v1/payments/qr/status/{order_number}` | GET |
| Check dues | `GET /api/v1/drivers/cash/balance` | GET |
| Deposit | `POST /api/v1/drivers/cash/deposit` | POST |

## Quick Reference — Which APIs Passenger Calls

| Step | API | Method |
|---|---|---|
| Request ride | `POST /api/v1/rides/request` | POST |
| Create payment | `POST /api/v1/payments/order/create` | POST |
| Verify payment | `POST /api/v1/payments/verify` | POST |

---

## Bug Fixed (2025-05-10)

**Problem:** `rides.platform_share` was never saved when a ride was completed.
When driver called collect-confirm, `ride.platform_share = 0` always, so:
- `pending_amount = 0` (no dues tracked)
- `pending_net_earnings = full_fare` (wrong — driver's entire fare was held, nothing properly owed)

**Fix:** Added `additionalFields.platform_share = finalResult.driver.platformFee` in
`src/modules/rides/services/rideService.js` — now saved correctly at ride completion.

---

*Generated: 2025-05-10 | Branch: Irshad__GoBackend*
