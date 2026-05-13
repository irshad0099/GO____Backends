# Driver App — Complete Integration Guide

> Base URL: `https://your-domain.com/api/v1`  
> All protected routes → `Authorization: Bearer <accessToken>`  
> All responses → `{ success, message, data }` or `{ success, message, errors }`

---

## Table of Contents
1. [Auth Flow](#1-auth-flow)
2. [Driver Registration & Profile](#2-driver-registration--profile)
3. [KYC](#3-kyc)
4. [Socket.IO — Connect & Events](#4-socketio--connect--events)
5. [Ride Flow (Step by Step)](#5-ride-flow-step-by-step)
6. [Payment Flow per Method](#6-payment-flow-per-method)
7. [Wallet APIs](#7-wallet-apis)
8. [Earnings APIs](#8-earnings-apis)
9. [Cash Balance & Deposit](#9-cash-balance--deposit)
10. [Availability & Location](#10-availability--location)
11. [Ride History & Summary](#11-ride-history--summary)
12. [Penalties & Acceptance Rate](#12-penalties--acceptance-rate)

---

## 1. Auth Flow

### Signup (New Driver)

```
POST /auth/signup
Body: { phone, email?, fullName?, role: "driver" }
→ { sessionId, otpSent: true, expiresIn: 300 }
```

```
POST /auth/verify-signup
Body: { phone, otp, fullName, role: "driver" }
→ { accessToken, refreshToken, user: { id, phone, role } }
```

### Login (Existing Driver)

```
POST /auth/signin
Body: { phone, role: "driver" }
→ { otpSent: true }
```

```
POST /auth/verify-signin
Body: { phone, otp, role: "driver" }
→ { accessToken, refreshToken, user }
```

### Other

```
GET  /auth/me           → logged-in user info
POST /auth/logout       → blacklists token
POST /auth/fcm-token    Body: { fcm_token }   → save FCM token for push notifications
```

**Token rules:**
- `accessToken` — JWT, 15 min expiry, send in every request header
- `refreshToken` — JWT, 30 days, use to get new accessToken

---

## 2. Driver Registration & Profile

### Register as Driver (after signup)

```
POST /drivers/register
Auth: YES
Body:
{
  "vehicleType": "auto",          // "bike" | "auto" | "car"
  "vehicleNumber": "MH12AB1234",
  "vehicleModel": "Bajaj RE",
  "vehicleColor": "Yellow",
  "licenseNumber": "MH1234567890123",
  "licenseExpiry": "2028-12-31"
}
→ { driverId, status: "pending_verification", kycStatus: "not_started" }
```

### Profile

```
GET  /drivers/profile     → full driver profile
PUT  /drivers/profile     Body: { name?, email?, phone? }
```

---

## 3. KYC

Required before driver can go online and receive rides.

### Check Status

```
GET /kyc/status
→ {
    overallStatus: "not_started" | "in_progress" | "pending_review" | "verified" | "rejected" | "suspended",
    documents: {
      AADHAAR: { uploaded, status },
      PAN: { uploaded, status },
      DRIVING_LICENCE: { uploaded, status },
      VEHICLE_RC: { uploaded, status }
    }
  }
```

### Upload Document (multipart/form-data)

```
POST /kyc/submit
Body (form-data):
  document_type: "AADHAAR" | "PAN" | "DRIVING_LICENCE" | "VEHICLE_RC"
  file: <image/pdf>
  file_back: <image/pdf>   ← only for AADHAAR
→ { documentId, status: "submitted" }
```

### Retry Rejected Document

```
POST /kyc/documents/:id/retry
Body (form-data): { file, file_back? }
```

### Add Bank Account (for withdrawals)

```
POST /kyc/bank
Body: { account_number, ifsc, name }
→ { bankId, status: "verified" }
```

### Face Match / Selfie Verification

```
POST /kyc/face-match
Body (form-data): { selfie: <image> }
→ { status: "verified" | "failed" }
```

---

## 4. Socket.IO — Connect & Events

### Connect

```js
const socket = io("https://your-domain.com", {
  transports: ["websocket"],
  auth: { token: accessToken }
});
```

### Step 1 — Auth Login (after socket connects)

```js
// EMIT
socket.emit("auth:login", {
  userId: 10,
  userType: "driver",
  phone: "9876543210"
});

// LISTEN
socket.on("auth:success", ({ socketId, userId, message }) => { ... });
socket.on("auth:error",   ({ message }) => { ... });
```

### Step 2 — On reconnect (app resume / network restore)

```js
socket.emit("auth:reconnect", { userId: 10, userType: "driver" });
// Ye queued messages flush karega aur active ride room rejoin karega
```

---

### Events Driver EMITS

| Event | Payload | When |
|-------|---------|------|
| `auth:login` | `{ userId, userType: "driver", phone }` | App open / login |
| `auth:reconnect` | `{ userId, userType: "driver" }` | App resume after disconnect |
| `auth:logout` | `{}` | Logout |
| `driver:availability_toggle` | `{ isAvailable: boolean }` | Driver goes online/offline |
| `driver:location_update` | `{ latitude, longitude, rideId, accuracy?, speed? }` | Active ride — every 3-5 sec |
| `driver:idle_location` | `{ latitude, longitude }` | Online but no active ride |
| `ride:accept` | `{ rideId }` | Driver accepts ride request |
| `ride:reject` | `{ rideId, reason }` | Driver rejects ride request |
| `ride:join` | `{ rideId }` | After accepting — join ride room |
| `ride:leave` | `{ rideId }` | After ride ends — leave ride room |
| `ride:update` | `{ rideId, status }` | Status change broadcast |
| `chat:send` | `{ rideId, message }` | In-ride chat |
| `chat:typing` | `{ rideId }` | Typing indicator |

---

### Events Driver LISTENS

| Event | Payload | What to do |
|-------|---------|------------|
| `auth:success` | `{ socketId, userId }` | Store socketId |
| `auth:error` | `{ message }` | Show error / re-login |
| `ride:new_request` | `{ rideId, passengerId, pickupLocation, dropoffLocation, estimatedFare, vehicleType, timestamp }` | Show incoming ride card (accept/reject within timeout) |
| `ride:joined` | `{ rideId, message }` | Confirm room joined |
| `ride:accepted` | `{ rideId, driverId, timestamp }` | Update UI — ride accepted |
| `ride:rejected` | `{ rideId, driverId, reason, timestamp }` | Ride was rejected |
| `ride:status_changed` | `{ rideId, status, finalFare?, paymentMethod?, isFreeRide?, subscriptionDiscount?, couponDiscount? }` | Update ride screen state |
| `ride:status_update` | same as above | Same — listen both |
| `ride:eta_update` | `{ rideId, etaMinutes, distanceKm, etaType: "pickup"\|"dropoff" }` | Show ETA to driver |
| `ride:fare_update` | `{ rideId, drivenKm, currentFare, waitingCharges, isWaiting }` | Live fare meter |
| `ride:otp_verified` | `{ rideId, verifiedAt }` | OTP confirmed, ride started |
| `driver:map_ping` | `{ rideId, location: { latitude, longitude } }` | Passenger tracking update |
| `driver:availability_changed` | `{ driverId, isAvailable }` | Confirm availability toggle |
| `chat:new_message` | `{ rideId, senderId, senderType, message, timestamp }` | Show chat message |
| `chat:user_typing` | `{ rideId, userId, userType }` | Show typing indicator |
| `error` | `{ message }` | Show error toast |

---

## 5. Ride Flow (Step by Step)

```
[Passenger books ride]
        ↓
socket: ride:new_request → Driver app shows incoming card
        ↓
Driver accepts
        ↓
REST:   POST /rides/:rideId/accept
socket: socket.emit("ride:accept", { rideId })
socket: socket.emit("ride:join",   { rideId })   ← MUST JOIN ROOM for tracking to work
        ↓
Driver drives to pickup
socket: socket.emit("driver:location_update", { latitude, longitude, rideId })  ← every 3-5 sec
        ↓
Driver arrives at pickup
REST:   PATCH /rides/:rideId/status   Body: { status: "driver_arrived" }
        ↓
OTP verification (passenger tells OTP to driver)
REST:   POST /rides/:rideId/verify-otp   Body: { otp: "4321" }
socket: listens for ride:otp_verified
        ↓
Ride starts — driver drives to destination
socket: socket.emit("driver:location_update", { latitude, longitude, rideId })  ← continue
socket: listens ride:fare_update for live meter
        ↓
Driver reaches destination
REST:   PATCH /rides/:rideId/status   Body: { status: "completed" }
socket: listens ride:status_changed → check paymentMethod field
        ↓
Payment collection (see Section 6)
        ↓
[Optional] Rate passenger
REST:   POST /rides/:rideId/rate   Body: { rating: 4, comment? }
```

### Ride Reject (before accepting)

```
socket.emit("ride:reject", { rideId, reason: "too_far" })
// OR
POST /drivers/rides/:rideId/reject
Body: {
  "reason_code": "too_far" | "wrong_direction" | "low_fare" | "bad_area" | "busy" | "ending_shift" | "other",
  "reason_text": "..."   // optional
}
```

### Driver Cancel (after accepting, before in_progress)

```
POST /rides/:rideId/driver-cancel
Body: { reason: "emergency" }
```

---

## 6. Payment Flow per Method

Ride complete hone ke baad `ride:status_changed` socket event mein `paymentMethod` field aata hai.  
Driver app us field se decide kare kya karna hai.

```js
socket.on("ride:status_changed", ({ status, paymentMethod, finalFare }) => {
  if (status === "completed") {
    if (paymentMethod === "cash") {
      // "Cash lena hai" screen dikhao
    } else {
      // QR code dikhao — passenger scan karega
    }
  }
});
```

---

### Cash

```
Ride complete → Driver receives cash physically
        ↓
POST /rides/cash-payment/confirm
Body: { ride_id: 123 }
→ { payment_method: "cash", status: "cash_confirmed", amount: 150 }
```

Driver earnings → wallet mein credit (after confirmation)

---

### UPI / QR

```
Ride complete → Driver app QR show kare (generate karo)
        ↓
POST /payments/orders
Body:
{
  "amount": 150,
  "purpose": "ride_payment",
  "payment_method": "qr",      // "upi" ya "qr"
  "payment_gateway": "razorpay",
  "ride_id": 123
}
→ {
    requiresGateway: true,
    gatewayOrderId: "order_xxxx",
    qrCode: "base64string",     // show this as image
    upiUrl: "upi://pay?...",
    amount: 15000,              // paise mein (Razorpay format)
    expiresAt: "..."
  }
        ↓
Passenger scans QR / pays via UPI
        ↓
[Passenger app calls POST /payments/verify]
[Driver side — nothing needed, earnings auto-credit hoga]
```

---

### Wallet (Passenger ke wallet se auto-deduct)

```
Ride complete → kuch nahi karna driver ko
Driver earnings → automatically wallet mein credit
```

---

### Payment Method Summary for Driver

| Method | Driver Action | Earnings Credit |
|--------|--------------|-----------------|
| `cash` | Call `/rides/cash-payment/confirm` | After confirm call |
| `upi` / `qr` | Show QR to passenger | Auto after passenger pays |
| `wallet` | Nothing | Auto on ride complete |
| `card` | Nothing | Auto after gateway confirms |

---

## 7. Wallet APIs

Driver earning wallet — rides se paisa ata hai, bank mein withdraw karo.

```
GET  /wallet              → { walletId, balance, totalCredited, totalDebited, lastTransactionAt }
GET  /wallet/balance      → { balance }

GET  /wallet/transactions
Query: ?limit=20&offset=0&type=credit|debit&category=ride_earnings|withdrawal&status=success&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
→ { transactions: [...], pagination: { total, limit, offset, hasMore } }

GET  /wallet/transactions/:txnNumber   → single transaction detail

POST /wallet/withdraw
Body:
{
  "amount": 1000,
  "bank_account_number": "1234567890",
  "ifsc_code": "SBIN0001234",
  "description": "Weekly withdrawal"
}
→ { transaction, newBalance, note: "1-2 business days" }
```

**Wallet Transaction Categories (driver relevant):**

| Category | Means |
|----------|-------|
| `ride_earnings` | Earnings from completed ride |
| `withdrawal` | Withdrawal to bank |
| `referral_bonus` | Referral program bonus |
| `ride_refund` | Refund (rare) |
| `auto_deduct` | Cash dues deduction |

---

## 8. Earnings APIs

```
GET /drivers/earnings/current-week
→ {
    weekStart, weekEnd,
    totalRides, completedRides, cancelledRides,
    rideEarnings, tipEarnings, incentiveEarnings,
    grossEarnings, totalDeductions, netEarnings,
    cashCollected, onlineEarnings,
    totalOnlineHours, avgEarningPerRide
  }

GET /drivers/earnings/weekly?limit=10&offset=0
→ [ { weekStart, weekEnd, totalRides, netEarnings, ... } ]

GET /drivers/earnings/monthly?limit=12&offset=0
→ [ { month, year, totalRides, netEarnings, ... } ]

GET /drivers/earnings/statement?from=2025-01-01&to=2025-01-31
→ { statement: [...], total, average }

GET /drivers/metrics/daily
→ { rideCount, earnings, rating, ... }
```

### Incentives / Targets

```
GET /drivers/incentives
→ { activePlans: [ { id, name, target, progress, reward } ] }

GET /drivers/incentives/progress
→ { plans: [ { id, progress%, earned, remaining } ] }
```

---

## 9. Cash Balance & Deposit

Jab driver cash collect karta hai, platform fee track hoti hai. Driver periodically deposit karta hai.

```
GET /drivers/cash/balance
→ { pendingBalance, collectedToday, totalPending }

POST /drivers/cash/deposit
Body:
{
  "amount": 500,
  "deposit_method": "upi" | "bank_transfer" | "cash_center",
  "reference_number": "TXN123",    // optional
  "deposit_proof": "..."           // optional
}
→ { depositId, status: "pending" }

GET /drivers/cash/deposits?limit=20&offset=0
→ { deposits: [...], pagination }
```

---

## 10. Availability & Location

### Toggle Online/Offline

```
PATCH /drivers/availability
Body: { isAvailable: true, latitude: 19.07, longitude: 72.87 }
→ { isAvailable, updatedAt }

// Also emit via socket:
socket.emit("driver:availability_toggle", { isAvailable: true })
```

### Update Location (REST fallback)

```
PUT /drivers/location
Body: { latitude: 19.07, longitude: 72.87 }
```

> Socket se location update karna prefer karo during active ride.

### Destination Mode (Driver want rides toward a direction)

```
POST /drivers/destination-mode
Body: { latitude, longitude, address, radius_km: 3.0 }
→ { modeId, destination, active: true }

GET    /drivers/destination-mode   → current mode
DELETE /drivers/destination-mode   → cancel destination mode
```

---

## 11. Ride History & Summary

```
GET /rides/driver/history?page=1&limit=10&status=completed
→ { rides: [...], pagination }

GET /rides/:rideId
→ { ride: { id, rideNumber, status, fare, passenger, paymentMethod, ... } }

GET /rides/:rideId/driver-summary
→ { ride, fare, earnings: { netEarnings, platformFee }, rating }

GET /rides/:rideId/invoice
→ { invoice: { baseFare, distanceFare, finalFare, gst, platformFee, ... } }
```

---

## 12. Penalties & Acceptance Rate

```
GET /drivers/penalties
→ { penalties: [ { id, type, reason, amount, date, acknowledged } ] }

GET /drivers/penalties/ban-status
→ { isBanned: false } OR { isBanned: true, reason, banUntil }

PATCH /drivers/penalties/:penaltyId/acknowledge
→ { success, message }

POST /drivers/penalties/:penaltyId/appeal
Body: { reason: "..." }   // 10-500 chars
→ { appealId, status }

GET /drivers/acceptance-rate
→ { rideAcceptanceRate, last7Days }

GET /drivers/rides/acceptance-stats
→ { acceptanceRate%, rejectionCount, reasons: { too_far: 5, ... } }
```

---

## Quick Reference — All Driver APIs

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 1 | POST | `/auth/signup` | No | Send OTP for signup |
| 2 | POST | `/auth/verify-signup` | No | Verify OTP, get tokens |
| 3 | POST | `/auth/signin` | No | Send OTP for login |
| 4 | POST | `/auth/verify-signin` | No | Verify OTP, get tokens |
| 5 | GET | `/auth/me` | Yes | Get own user info |
| 6 | POST | `/auth/logout` | Yes | Logout |
| 7 | POST | `/auth/fcm-token` | Yes | Save push token |
| 8 | POST | `/drivers/register` | Yes | Register driver profile |
| 9 | GET | `/drivers/profile` | Yes | Get profile |
| 10 | PUT | `/drivers/profile` | Yes | Update profile |
| 11 | PATCH | `/drivers/availability` | Yes | Toggle online/offline |
| 12 | PUT | `/drivers/location` | Yes | Update location (REST) |
| 13 | GET | `/drivers/rides/current` | Yes | Get active ride |
| 14 | GET | `/drivers/rides/history` | Yes | Ride history |
| 15 | GET | `/drivers/score` | Yes | Driver score/rating |
| 16 | GET | `/drivers/badge` | Yes | Badge & tier |
| 17 | GET | `/drivers/metrics/daily` | Yes | Today's stats |
| 18 | GET | `/drivers/earnings/current-week` | Yes | This week earnings |
| 19 | GET | `/drivers/earnings/weekly` | Yes | Past weeks |
| 20 | GET | `/drivers/earnings/monthly` | Yes | Past months |
| 21 | GET | `/drivers/earnings/statement` | Yes | Custom date range |
| 22 | GET | `/drivers/incentives` | Yes | Active incentive plans |
| 23 | GET | `/drivers/incentives/progress` | Yes | Incentive progress |
| 24 | GET | `/drivers/penalties` | Yes | Penalty list |
| 25 | GET | `/drivers/penalties/ban-status` | Yes | Ban status |
| 26 | PATCH | `/drivers/penalties/:id/acknowledge` | Yes | Acknowledge penalty |
| 27 | POST | `/drivers/penalties/:id/appeal` | Yes | Appeal penalty |
| 28 | GET | `/drivers/acceptance-rate` | Yes | Acceptance rate |
| 29 | GET | `/drivers/cash/balance` | Yes | Pending cash balance |
| 30 | POST | `/drivers/cash/deposit` | Yes | Deposit collected cash |
| 31 | GET | `/drivers/cash/deposits` | Yes | Deposit history |
| 32 | POST | `/drivers/destination-mode` | Yes | Set destination mode |
| 33 | GET | `/drivers/destination-mode` | Yes | Get destination mode |
| 34 | DELETE | `/drivers/destination-mode` | Yes | Cancel destination mode |
| 35 | POST | `/rides/:rideId/accept` | Yes | Accept ride |
| 36 | POST | `/drivers/rides/:rideId/reject` | Yes | Reject ride |
| 37 | POST | `/rides/:rideId/driver-cancel` | Yes | Cancel accepted ride |
| 38 | PATCH | `/rides/:rideId/status` | Yes | Update ride status |
| 39 | POST | `/rides/:rideId/generate-otp` | Yes | Generate ride OTP |
| 40 | POST | `/rides/:rideId/verify-otp` | Yes | Verify passenger OTP |
| 41 | GET | `/rides/:rideId` | Yes | Ride details |
| 42 | GET | `/rides/:rideId/driver-summary` | Yes | Ride earnings summary |
| 43 | GET | `/rides/:rideId/invoice` | Yes | Ride invoice |
| 44 | POST | `/rides/cash-payment/confirm` | Yes | Confirm cash collected |
| 45 | GET | `/rides/cash-payment/status/:ride_id` | Yes | Cash payment status |
| 46 | POST | `/payments/orders` | Yes | Create payment order (UPI/QR) |
| 47 | POST | `/payments/verify` | Yes | Verify Razorpay payment |
| 48 | GET | `/payments/history` | Yes | Payment history |
| 49 | GET | `/wallet` | Yes | Wallet details |
| 50 | GET | `/wallet/balance` | Yes | Quick balance |
| 51 | GET | `/wallet/transactions` | Yes | Transaction history |
| 52 | POST | `/wallet/withdraw` | Yes | Withdraw to bank |
| 53 | GET | `/kyc/status` | Yes | KYC overall status |
| 54 | GET | `/kyc/doc-flags` | Yes | Document upload flags |
| 55 | POST | `/kyc/submit` | Yes | Upload KYC document |
| 56 | POST | `/kyc/documents/:id/retry` | Yes | Re-upload rejected doc |
| 57 | POST | `/kyc/bank` | Yes | Add bank account |
| 58 | POST | `/kyc/face-match` | Yes | Selfie verification |
