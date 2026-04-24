# PRD: Ride Completion Payment Flow
**GoMobility Backend — Engineering & Product**
**Version:** 1.0 | **Date:** 2026-04-22 | **Status:** Draft

---

## 1. Overview

When a ride reaches `status = 'completed'`, the fare is locked and payment must be settled between passenger, driver, and platform. This document defines all supported payment methods, their settlement flows, edge cases, failure handling, and the data contracts required to implement them correctly.

---

## 2. Goals

- Support 6 distinct payment methods with clear state machines per method
- Ensure driver wallet is credited correctly regardless of collection method
- Ensure platform commission is always captured
- Prevent double-charging and double-crediting (idempotency everywhere)
- Give real-time feedback to both passenger and driver via socket events

---

## 3. Payment Methods

### 3.1 Wallet Payment

**Who pays:** Passenger's in-app Go Wallet
**When settled:** Immediately at ride completion (synchronous)
**Settlement timeline:** T+0

**Flow:**
1. Ride reaches `completed` status, fare is locked (`final_fare`)
2. System checks passenger wallet balance ≥ `final_fare`
3. If sufficient: debit passenger wallet → credit driver wallet with `net_earnings` → credit platform with `platform_fee`
4. Update `rides.payment_status = 'paid'`
5. Emit `payment:success` to passenger, `payment:received` to driver

**Failure scenario — insufficient balance:**
1. Emit `payment:failed` to passenger with shortfall amount
2. `payment_status` stays `pending`
3. Fallback: passenger is prompted to top up wallet or switch to UPI/card
4. Retry window: 10 minutes, then auto-flag ride for manual review

**Business rules:**
- Max wallet balance: ₹1,00,000 (RBI semi-closed wallet guideline)
- Transaction category: `ride_payment` (debit passenger), `ride_earnings` (credit driver)
- Must be idempotent — calling twice on same `ride_id` must not double-debit

---

### 3.2 Card Payment (Razorpay)

**Who pays:** Passenger's saved/new debit or credit card via Razorpay
**When settled:** After Razorpay webhook confirms payment
**Settlement timeline:** T+0 to T+5 minutes (gateway latency)

**Flow:**
1. Ride completes → system creates a `payment_orders` record (`status = 'created'`) with `gateway_order_id` from Razorpay
2. Frontend opens Razorpay checkout with the `gateway_order_id`
3. Passenger completes payment on Razorpay UI
4. Razorpay fires `payment.captured` webhook to `/api/v1/payments/verify`
5. Backend verifies HMAC signature (`RAZORPAY_WEBHOOK_SECRET`)
6. Updates `payment_orders.status = 'success'`
7. Queues `post-payment` job → worker credits driver wallet + updates ride `payment_status = 'paid'`
8. Emit `payment:success` to passenger, `payment:received` to driver

**Failure scenarios:**
- Webhook not received within timeout → retry via Razorpay dashboard + manual verification endpoint
- Signature mismatch → reject, log, do not mark paid
- Payment failed at gateway → `payment_orders.status = 'failed'`, emit `payment:failed`, passenger can retry

**Business rules:**
- Order number format: `PAY20240101XXXX` (unique per attempt)
- Payment order expires after 15 minutes — a new order must be created if expired
- Saved cards are tokenized — never store raw card data; use `gateway_token`

---

### 3.3 UPI Payment (Razorpay Intent)

**Who pays:** Passenger via any UPI app (GPay, PhonePe, Paytm, BHIM)
**When settled:** After Razorpay webhook confirms
**Settlement timeline:** T+0 to T+2 minutes

**Flow:** Identical to Card Payment (3.2) — same `payment_orders` table, same webhook, same post-payment worker.

**Difference from Card:** Frontend opens UPI intent (deep link to UPI app) instead of card form. `payment_method = 'upi'` in order.

**Failure scenarios:**
- User closes app mid-payment → order stays `attempted`, frontend polls order status
- UPI timeout → Razorpay marks failed, webhook fires, emit `payment:failed`

---

### 3.4 UPI QR Code

**Who pays:** Passenger scans a dynamic QR code shown on driver's device or passenger app
**When settled:** After scan and confirmation
**Settlement timeline:** T+0 to T+3 minutes

**Flow:**
1. Ride completes → backend generates Razorpay Dynamic QR (`upi_qr` type order)
2. Driver app or passenger app displays QR
3. Passenger scans with any UPI app
4. Razorpay fires `payment.captured` webhook (same as card/UPI above)
5. Same post-payment worker flow

**Special handling:**
- QR expires in 10 minutes
- If passenger cannot scan: driver can trigger fallback to `cash` mode via `collect-confirm` endpoint (this cancels the pending QR order and records `collected_by_driver`)

---

### 3.5 Cash Collection

**Who pays:** Passenger hands physical cash (or personal UPI transfer) to driver
**When settled:** When driver taps "Paise mil gaye" / "Collected" in app
**Settlement timeline:** Deferred — driver-controlled

**Flow:**
1. Ride completes with `payment_method = 'cash'`
2. `payment_status = 'pending'` — waiting for driver confirmation
3. Driver app shows amount to collect from passenger
4. Driver taps collect → `POST /api/v1/rides/:rideId/collect-confirm` with `{ method: 'cash' | 'personal_upi' }`
5. Backend:
   - Calculates: `final_fare` → `platform_fee` (commission) → `net_earnings = final_fare - platform_fee`
   - Cancels any pending online payment order for this ride
   - Updates ride: `payment_status = 'collected_by_driver'`, `collection_method_actual`, `platform_share`, `collection_confirmed_at`
   - Adds `platform_fee` to driver's `cash_balance` (driver owes platform this amount)
   - Credits driver wallet with `net_earnings` (category: `ride_earnings`)
6. Emit `ride:collection_confirmed` to driver, `ride:payment_settled` to passenger

**Failure scenarios:**
- Driver never confirms → cron job flags rides older than 2 hours with `payment_status = 'pending'` for admin review
- Driver confirms twice → idempotent: second call returns 200 "already confirmed", no double credit

**Business rules:**
- `cash_balance` represents the driver's running debt to the platform (cash they collected but not remitted)
- Platform recovers `cash_balance` from future online earnings or weekly settlement
- `collection_method_actual = 'personal_upi'` is for audit only — payment was handled offline

---

### 3.6 Corporate Billing

**Who pays:** The passenger's registered company, on a monthly billing cycle
**When settled:** End of billing month
**Settlement timeline:** T+30 days max

**Flow:**
1. Ride completes with `payment_method = 'corporate'`
2. `payment_status = 'billed_corporate'` immediately
3. Ride amount is added to company's monthly invoice ledger
4. Driver is credited immediately (platform assumes collection risk from corporate)
5. End of month: platform generates invoice, collects from company, reconciles

**Business rules:**
- Only available to passengers with a verified corporate account
- Driver earnings are pre-credited (not deferred) — platform bears collection risk
- Dispute period: 7 days after invoice generation

---

## 4. State Machine — `rides.payment_status`

```
                    ┌──────────────────────────┐
                    │          pending          │  ← ride just completed
                    └──────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
        ▼                         ▼                         ▼
  [online methods]          [cash method]           [corporate method]
  card/upi/wallet         driver confirms             auto-set
        │                         │                         │
        ▼                         ▼                         ▼
       paid             collected_by_driver        billed_corporate
        │
        ▼
     refunded  ← admin initiates refund post-payment
```

**Terminal states:** `paid`, `collected_by_driver`, `billed_corporate`, `refunded`
**Retry-eligible state:** `failed` → can be retried back to `pending` for a new payment attempt

---

## 5. Driver Earnings & Platform Commission

Regardless of payment method, the split is:

```
final_fare
  └─ platform_fee      = final_fare × commission_rate  (ENV-configured per vehicle type)
  └─ net_earnings      = final_fare - platform_fee
  └─ subscription_discount  (already deducted in fare lock at ride completion)
  └─ coupon_discount        (already deducted in fare lock at ride completion)
```

**When is the driver credited by method:**

| Method | When driver is credited | How |
|---|---|---|
| wallet | Immediately at ride completion | wallet credit (ride_earnings) |
| card/UPI | After webhook success — async via post-payment worker | wallet credit |
| UPI QR | After webhook success — async via post-payment worker | wallet credit |
| cash | After driver confirms collection | wallet credit (net only) |
| corporate | Immediately at ride completion | wallet credit (platform assumes risk) |

---

## 6. Refund Policy

| Trigger | Refund Method | Timeline |
|---|---|---|
| Ride cancelled before pickup | Source (bank/card) or wallet | T+5-7 business days (source) / T+0 (wallet) |
| Overcharge dispute (admin) | Wallet (instant) or source | Admin-controlled |
| Driver no-show | Full refund to source | T+5-7 business days |
| Cancellation fee dispute | Admin approval required | N/A |

Refunds are tracked in `payment_refunds` table. One refund per `payment_order_id` for full refunds; `partially_refunded` status for partial.

---

## 7. Socket Events Contract

| Event | Direction | Trigger | Payload Key Fields |
|---|---|---|---|
| `payment:fare_breakdown` | Server → Passenger | Ride completes | `final_fare`, `breakdown`, `payment_method` |
| `payment:status_update` | Server → Both | Any status change | `payment_status`, `message` |
| `payment:success` | Server → Passenger | Payment confirmed | `receipt_url`, `amount_paid` |
| `payment:received` | Server → Driver | Payment confirmed | `net_earnings`, `platform_fee` |
| `payment:failed` | Server → Passenger | Payment fails | `reason`, `retry_url` |
| `payment:reminder` | Server → Passenger | Unpaid after 5 min | `amount_due`, `retry_url` |
| `ride:collection_confirmed` | Server → Driver | Cash confirmed | `net_earnings` |
| `ride:payment_settled` | Server → Passenger | Cash confirmed | `amount`, `method` |

---

## 8. REST Endpoints Required

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/payments/orders` | POST | Passenger | Create payment order for a completed ride |
| `/payments/verify` | POST | Webhook (Razorpay signature) | Razorpay webhook handler |
| `/payments/history` | GET | Passenger | Paginated payment history |
| `/payments/orders/:orderNumber` | GET | Passenger | Single order detail + refunds |
| `/payments/methods` | GET | Passenger | List saved cards/UPI |
| `/payments/methods` | POST | Passenger | Save new payment method |
| `/payments/methods/:id` | DELETE | Passenger | Remove saved method |
| `/payments/methods/:id/default` | PATCH | Passenger | Set as default method |
| `/rides/:rideId/collect-confirm` | POST | Driver | Confirm cash collection |
| `/payments/refund` | POST | Admin | Initiate refund |

---

## 9. Known Gaps to Fix Before Shipping

These are gaps discovered in the current codebase that must be resolved before this flow is production-ready:

| # | Gap | Impact | File to Fix |
|---|---|---|---|
| 1 | `creditDriverEarnings()` is imported but not implemented | Cash collection silently fails to credit driver wallet | `rideCollectionService.js` + `walletService.js` |
| 2 | `getActivePaymentOrderByRideId()` missing from payment repository | Cannot cancel pending order during cash collection | `paymentRepository.js` |
| 3 | Online payment success never updates `rides.payment_status = 'paid'` | Ride stays `pending` forever after online payment succeeds | Post-payment worker |
| 4 | Payment queue worker (`post-payment`) has no processor registered | Wallet recharge and subscription activation jobs never execute | `infrastructure/queue/workers/` |
| 5 | Wallet payment (`payForRide`) never called at ride completion | Wallet-method rides are not charged | `rideService.js` or post-payment worker |

---

## 10. Non-Functional Requirements

- **Idempotency:** Every payment action must be safe to retry. Use `ride_id` or `order_number` as idempotency keys.
- **Atomicity:** Wallet debit + ride status update must execute inside the same DB transaction. No partial states allowed.
- **Timeout handling:** Payment orders expire in 15 minutes. Expired orders must be cancelled before creating a new one on retry.
- **Audit trail:** Every wallet transaction must carry a `reference_id` pointing to `payment_orders.id` or `ride_id`.
- **Commission reconciliation:** `rides.platform_share` must always equal the corresponding commission entry in the ledger — verified during end-of-day reconciliation.
- **No silent failures:** Any payment failure must emit a socket event AND log a structured error. Never swallow payment errors.
