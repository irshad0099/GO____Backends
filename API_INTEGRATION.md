# GoMobility — Complete API Integration Guide
# Base URL: http://YOUR_SERVER:5000/api/v1

## Auth Headers (sabhi protected routes pe lagao)
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

---

# ═══════════════════════════════════════
# PASSENGER APP
# ═══════════════════════════════════════

## 🔐 AUTH

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/auth/signup` | `{ phone, name, email? }` | Register karo |
| POST | `/auth/verify-signup` | `{ phone, otp }` | OTP verify karo |
| POST | `/auth/signin` | `{ phone }` | Login karo |
| POST | `/auth/verify-signin` | `{ phone, otp }` | Login OTP verify |
| POST | `/auth/refresh-token` | `{ refreshToken }` | Token refresh |
| POST | `/auth/logout` | `{ refreshToken }` | Logout |
| GET  | `/auth/me` | — | Profile dekho |

---

## 🚗 RIDES

| Method | Endpoint | Body / Query | Description |
|--------|----------|------|-------------|
| GET | `/rides/nearby-drivers` | `?latitude=&longitude=&vehicleType=` | Nearby drivers |
| POST | `/rides/calculate-fare` | `{ pickupLocation, dropoffLocation, vehicleType }` | Fare estimate |
| POST | `/rides/request` | `{ pickupLocation, dropoffLocation, vehicleType, paymentMethod? }` | Ride book karo |
| GET | `/rides/current` | — | Current active ride |
| GET | `/rides/passenger/history` | `?page=1&limit=10` | Ride history |
| GET | `/rides/:rideId` | — | Ride details |
| POST | `/rides/:rideId/cancel` | `{ reason }` | Ride cancel |
| GET | `/rides/:rideId/invoice` | — | Invoice/receipt |
| POST | `/rides/:rideId/rate` | `{ rating, comment }` | Rate ride |

### Scheduled Rides
| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/rides/schedule` | `{ pickupLocation, dropoffLocation, vehicleType, scheduledAt }` | Ride schedule karo |
| GET | `/rides/scheduled` | — | My scheduled rides |
| DELETE | `/rides/scheduled/:id` | — | Scheduled ride cancel |

---

## 💳 PAYMENTS

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/payments/orders` | `{ rideId, amount, method }` | Payment order create |
| POST | `/payments/verify` | `{ orderId, paymentId, signature }` | Razorpay verify |
| GET | `/payments/history` | `?status=&page=` | Payment history |
| GET | `/payments/orders/:orderNumber` | — | Single order detail |
| GET | `/payments/methods` | — | Saved cards/UPI |
| POST | `/payments/methods` | `{ type, token }` | Card/UPI save |
| DELETE | `/payments/methods/:methodId` | — | Method remove |
| PATCH | `/payments/methods/:methodId/default` | — | Default set karo |

---

## 👛 WALLET

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| GET | `/wallet` | — | Wallet info |
| GET | `/wallet/balance` | — | Balance dekho |
| POST | `/wallet/recharge` | `{ amount, method }` | Wallet recharge |
| POST | `/wallet/pay-ride` | `{ rideId, amount }` | Ride pay karo |
| GET | `/wallet/transactions` | `?type=&page=` | Transaction history |
| GET | `/wallet/transactions/:txnNumber` | — | Single transaction |

---

## 🏷️ COUPONS

| Method | Endpoint | Body/Query | Description |
|--------|----------|------|-------------|
| GET | `/coupons/available` | `?vehicleType=bike` | Available coupons |
| POST | `/coupons/apply` | `{ code, rideId }` | Coupon apply karo |

---

## ⭐ REVIEWS

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/reviews` | `{ rideId, rating, tags[], comment }` | Review submit |
| GET | `/reviews/ride/:rideId` | — | Ride ke reviews |
| GET | `/reviews/user/:userId` | — | User ke reviews |
| GET | `/reviews/user/:userId/summary` | — | Rating summary |
| GET | `/reviews/tags` | `?reviewer_type=passenger` | Available tags |

---

## 🆘 SOS

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/sos` | `{ rideId, location, message? }` | SOS trigger |
| PATCH | `/sos/:alertId/cancel` | — | SOS cancel |
| GET | `/sos/history` | — | SOS history |

---

## 👤 PROFILE

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| GET | `/users/profile` | — | Profile dekho |
| PUT | `/users/profile` | `{ name, email }` | Profile update |

---

## 💰 SUBSCRIPTIONS

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| GET | `/subscriptions/plans` | — | Plans dekho |
| POST | `/subscriptions/subscribe` | `{ planId }` | Subscribe karo |
| GET | `/subscriptions/my` | — | My subscription |

---

# ═══════════════════════════════════════
# DRIVER APP
# ═══════════════════════════════════════

## 🔐 AUTH

**Note:** For drivers, `POST /auth/verify-signin` and `POST /auth/verify-signup` responses include a `kyc` object with current KYC status.

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/auth/signup` | `{ phone, name, email? }` | Register karo |
| POST | `/auth/verify-signup` | `{ phone, otp }` | OTP verify, returns KYC status for drivers |
| POST | `/auth/signin` | `{ phone }` | Login |
| POST | `/auth/verify-signin` | `{ phone, otp }` | Login OTP verify, returns KYC status for drivers |
| POST | `/auth/refresh-token` | `{ refreshToken }` | Token refresh |
| POST | `/auth/logout` | `{ refreshToken }` | Logout |
| GET  | `/auth/me` | — | Profile |

### Driver Login Response Example (for role: 'driver')
```json
{
  "success": true,
  "data": {
    "accessToken": "...",
    "refreshToken": "...",
    "user": {
      "id": "uuid",
      "phone": "919876543210",
      "email": "driver@example.com",
      "fullName": "John Doe",
      "role": "driver",
      "isVerified": true,
      "isActive": true
    },
    "kyc": {
      "kycStatus": "in_progress",
      "documentStatus": {
        "aadhaar": true,
        "pan": true,
        "bank": false,
        "license": false,
        "vehicle": false
      },
      "allDocumentsSubmitted": false,
      "isDriverVerified": false
    }
  }
}
```

**KYC Status Values (Manual KYC):**
- `not_started` — Koi document nahi submit hua
- `in_progress` — Kuch documents submit aur verify ho gaye
- `complete` — Sabhi 5 documents verified (aadhaar, pan, bank, license, vehicle)

**documentStatus:** Each is `true` (verified) or `false` (not verified / not submitted)
- `aadhaar` — Aadhaar verified?
- `pan` — PAN verified?
- `bank` — Bank account verified?
- `license` — Driving license verified?
- `vehicle` — Vehicle RC verified?

**allDocumentsSubmitted:** `true` jab sab documents verify ho jayein

**isDriverVerified:** `drivers.is_verified` field (admin final approval)

---

## 👷 DRIVER PROFILE & KYC

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/drivers/register` | `{ name, vehicleType, vehicleNumber }` | Driver register |
| GET | `/drivers/profile` | — | Profile dekho |
| PUT | `/drivers/profile` | `{ name, photo? }` | Profile update |
| POST | `/drivers/add-aadhar` | `{ aadharNumber, front, back }` | Aadhar add |
| POST | `/drivers/add-pancard` | `{ panNumber, image }` | PAN add |
| POST | `/drivers/add-bankdetail` | `{ accountNumber, ifsc, holderName }` | Bank add |
| POST | `/drivers/add-license` | `{ licenseNumber, expiry, image }` | License add |
| POST | `/drivers/add-vehicle-details` | `{ rc, insurance, permit }` | Vehicle docs |
| POST | `/drivers/kyc-upload` | `FormData: file` | Document upload (S3) |
| GET | `/drivers/document/:driver_id` | — | Docs status |
| GET | `/drivers/documents/status` | — | Expiry status |
| POST | `/drivers/fcm-token` | `{ fcm_token }` | FCM token save |

---

## 🟢 AVAILABILITY & LOCATION

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| PATCH | `/drivers/availability` | `{ isAvailable: true/false }` | Online/Offline toggle |
| PUT | `/drivers/location` | `{ latitude, longitude }` | Location update (REST) |

> **Note:** Location update real-time ke liye WebSocket use karo (neeche dekho)

---

## 🚗 RIDE MANAGEMENT

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| GET | `/rides/current` | — | Current ride |
| GET | `/rides/driver/history` | `?page=1&limit=10` | Ride history |
| GET | `/rides/:rideId` | — | Ride details |
| POST | `/rides/:rideId/accept` | — | Ride accept |
| PATCH | `/rides/:rideId/status` | `{ status: 'arrived'/'started'/'completed' }` | Status update |
| POST | `/rides/:rideId/generate-otp` | — | OTP generate (passenger ko SMS jayega) |
| POST | `/rides/:rideId/verify-otp` | `{ otp }` | OTP verify → Ride start |
| GET | `/rides/:rideId/invoice` | — | Invoice |
| POST | `/drivers/rides/:rideId/reject` | `{ reason }` | Ride reject |
| GET | `/drivers/rides/rejections` | — | Rejection history |
| GET | `/drivers/rides/acceptance-stats` | — | Acceptance rate |

---

## 💰 EARNINGS

| Method | Endpoint | Query | Description |
|--------|----------|------|-------------|
| GET | `/drivers/earnings` | — | Overall earnings |
| GET | `/drivers/earnings/weekly` | — | Weekly summary |
| GET | `/drivers/earnings/monthly` | — | Monthly summary |
| GET | `/drivers/earnings/current-week` | — | Current week live |
| GET | `/drivers/earnings/statement` | `?from=2024-01-01&to=2024-01-31` | Date range statement |

---

## 💵 CASH COLLECTION

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| GET | `/drivers/cash/balance` | — | Pending cash balance |
| POST | `/drivers/cash/deposit` | `{ amount, note? }` | Cash deposit submit |
| GET | `/drivers/cash/deposits` | — | Deposit history |

---

## 🎯 INCENTIVES & PENALTIES

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/drivers/incentives` | Active incentive plans |
| GET | `/drivers/incentives/progress` | Progress on each plan |
| GET | `/drivers/penalties` | My penalties |
| GET | `/drivers/penalties/ban-status` | Am I banned? |
| PATCH | `/drivers/penalties/:penaltyId/acknowledge` | Penalty seen karo |
| POST | `/drivers/penalties/:penaltyId/appeal` | Penalty contest karo |
| GET | `/drivers/acceptance-rate` | Last 7 days rate |

---

## 🏠 DESTINATION MODE (Going Home)

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| GET | `/drivers/destination-mode` | — | Current mode |
| POST | `/drivers/destination-mode` | `{ destination: { lat, lng } }` | Set destination |
| DELETE | `/drivers/destination-mode` | — | Mode off karo |

---

## ⭐ DRIVER SCORE & BADGE

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/drivers/score` | Driver score dekho |
| GET | `/drivers/badge` | Badge dekho |
| GET | `/drivers/metrics/daily` | Daily metrics |

---

## ⭐ REVIEWS (Driver)

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/reviews` | `{ rideId, rating, tags[], comment }` | Passenger ko rate karo |
| GET | `/reviews/ride/:rideId` | — | Ride ke reviews |
| GET | `/reviews/user/:userId/summary` | — | Passenger rating |
| POST | `/reviews/respond` | `{ reviewId, response }` | Review ka reply |

---

# ═══════════════════════════════════════
# WEBSOCKET EVENTS (Real-Time)
# ═══════════════════════════════════════

## Connect
```
ws://YOUR_SERVER:5000
```

## Passenger WebSocket Events

### Bhejo (Emit):
```
auth:login          → { userId, userType: 'passenger', phone }
auth:reconnect      → { userId, userType: 'passenger' }
ride:join           → { rideId }
ride:leave          → { rideId }
chat:send           → { rideId, message }
chat:typing         → { rideId }
```

### Suno (On):
```
auth:success              → Connected
reconnection:recovery     → { activeRide, queuedMessages }
ride:driver_assigned      → { driverName, vehicleNumber, estimatedArrivalTime }
driver:map_ping           → { location: { latitude, longitude }, speed }
ride:driver_arrived       → Driver aa gaya
ride:status_changed       → { status: 'started'/'completed' }
payment:fare_breakdown    → { breakdown: { totalAmount } }
payment:status_update     → { status: 'processing'/'completed' }
payment:success           → { receipt }
payment:invoice           → { invoiceNumber, downloadUrl }
chat:new_message          → { message, senderType }
chat:user_typing          → { userType }
ride:eta_update           → { estimatedMinutes }
notification:new          → { title, message }
```

---

## Driver WebSocket Events

### Bhejo (Emit):
```
auth:login                  → { userId, userType: 'driver', phone }
auth:reconnect              → { userId, userType: 'driver' }
ride:join                   → { rideId }
ride:leave                  → { rideId }
driver:location_update      → { latitude, longitude, rideId, speed? }  ← HAR 5 SEC
driver:availability_toggle  → { isAvailable: true/false }
ride:accept                 → { rideId }
ride:reject                 → { rideId, reason }
chat:send                   → { rideId, message }
chat:typing                 → { rideId }
```

### Suno (On):
```
auth:success                → Connected
reconnection:recovery       → { activeRide, queuedMessages }
ride:new_request            → { rideId, pickupLocation, dropoffLocation, estimatedFare }
ride:assignment_confirmed   → { rideId, passengerName, passengerPhone, pickupLocation }
ride:status_changed         → { status }
payment:received            → { earnings }
payment:settlement          → { driverEarnings }
chat:new_message            → { message, senderType }
notification:new            → { title, message }
```

---

# ═══════════════════════════════════════
# COMPLETE RIDE FLOW (Step by Step)
# ═══════════════════════════════════════

```
PASSENGER                         BACKEND                          DRIVER
─────────────────────────────────────────────────────────────────────────────

1. socket.emit('auth:login')   →  Session Redis mein save       ←  socket.emit('auth:login')

2. GET /rides/nearby-drivers   →  Nearby drivers return

3. POST /rides/calculate-fare  →  Fare estimate return

4. POST /rides/request         →  Ride create                   →  socket: 'ride:new_request'

5.                                                              ←  socket.emit('ride:accept')

6.                             →  Driver assign                 →  socket: 'ride:assignment_confirmed'
   socket: 'ride:driver_assigned' ←                                socket.emit('ride:join', { rideId })
   socket.emit('ride:join', { rideId })

7.                                                              ←  socket.emit('driver:location_update',
   socket: 'driver:map_ping'   ←  io.to('ride:123')                { latitude, longitude, rideId })
   (Map update every 5 sec)        .emit('driver:map_ping')

8.                             ←  POST /rides/:rideId/generate-otp
                               →  OTP SMS to passenger

9.                             ←  POST /rides/:rideId/verify-otp { otp }
                               →  socket: 'ride:status_changed' { status: 'started' }

10. PATCH /rides/:rideId/status { status: 'completed' }
                               →  socket: 'payment:fare_breakdown'

11. POST /payments/orders      →  Razorpay order create
    POST /payments/verify      →  Payment verify
                               →  socket: 'payment:success'
                               →  socket: 'payment:invoice'     →  socket: 'payment:settlement'

12. POST /reviews { rideId, rating } → Review save
```

---

# RESPONSE FORMAT

### Success:
```json
{
  "success": true,
  "data": { ... },
  "message": "Done"
}
```

### Error:
```json
{
  "success": false,
  "message": "Error message",
  "errors": [ ... ]
}
```

### Token Expired (401):
```json
{
  "success": false,
  "message": "Token expired"
}
```
→ `/auth/refresh-token` call karo, naya token lo

---

# IMPORTANT NOTES

1. **Auth Token:** `Authorization: Bearer <token>` — sabhi protected routes pe
2. **Location Update:** REST `/drivers/location` sirf DB update ke liye, map tracking ke liye WebSocket use karo
3. **Ride Join:** Driver aur Passenger dono ko `ride:join` emit karna hai, tabhi map ping milega
4. **OTP Flow:** Driver generate kare → Passenger ko SMS aayega → Driver verify kare → Ride start
5. **Payment:** Wallet se instant, Razorpay card/UPI ke liye orders + verify
6. **Reconnect:** App background se aaye → `auth:reconnect` emit karo → previous state wapas milega
