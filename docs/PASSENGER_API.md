# GoMobility — Passenger App API Reference

Base URL: `/api/v1`
Auth: `Authorization: Bearer <accessToken>` (sabhi 🔒 protected routes pe)

> **Last sync with code: 2026-04-25** — yeh doc actual route files ke against verify ki gayi hai.

---

## Response Shape (sab endpoints)

```json
// Success
{ "success": true, "message": "...", "data": { } }

// Error
{ "success": false, "message": "Error description" }
```

---

## AUTH

OTP **6 digits** hota hai. Phone validation: `^[6-9]\d{9}$`.
Roles: `passenger` | `driver` | `admin`.

### Signup — Send OTP (new user)
```
POST /auth/signup
Body: {
  "phone": "9876543210",
  "role": "passenger",
  "fullName": "Rahul Sharma",   // optional
  "email": "rahul@email.com"    // optional
}
```
Response: `{ message: 'OTP sent to your phone', expiryInMinutes: 5 }`

### Verify Signup (create account)
```
POST /auth/verify-signup
Body: { "phone": "9876543210", "otp": "123456", "role": "passenger", "fullName": "Rahul", "email": "..." }
```
Response: `{ accessToken, refreshToken, user }` — 201 status. Frontend tokens ko secure storage mein save kare (Keychain / EncryptedSharedPreferences).

### Signin — Send OTP (existing user)
```
POST /auth/signin
Body: { "phone": "9876543210", "role": "passenger" }
// phone OR email — kam se kam ek required
```
Response: `{ message: 'OTP sent', expiryInMinutes: 5 }`

### Verify Signin (login)
```
POST /auth/verify-signin
Body: { "phone": "9876543210", "otp": "123456", "role": "passenger" }
```
Response: `{ accessToken, refreshToken, user }`. Driver role ke liye `kycStatus` bhi milta hai.

### Token Refresh
```
POST /auth/refresh-token
Body: { "refreshToken": "..." }
```
Access token (15 min) expire hone par naya pair leta hai. Refresh token validity: 30 days.
**Frontend strategy**: protected API `401` de → refresh-token call karo → naya `accessToken` save karo → original request retry karo. Agar yeh bhi fail → login screen.

### Me
```
GET /auth/me  🔒
```
App start pe token validity check karne ke liye.

### Logout
```
POST /auth/logout  🔒
Body: { "refreshToken": "..." }
```
Session delete + access token blacklist (24h). Frontend ko local tokens bhi clear karne hain.

### FCM Token Save
```
POST /users/fcm-token  🔒
Body: { "fcm_token": "device_fcm_token" }
```
Login ke turant baad — push notifications ke liye zaroori.

---

## HOME SCREEN

### Nearby Drivers (Map markers)
```
GET /rides/nearby-drivers?latitude=28.61&longitude=77.20&vehicleType=auto  🔒
```
5 km radius ke available drivers. `vehicleType` optional.
Response: `{ count, drivers: [{ driverId, latitude, longitude, vehicleType, distance }] }`. Frontend polling 10-15s se zyada na karein — Redis fresh data deta hai.

### User Profile
```
GET /users/profile  🔒
```
`{ id, fullName, phone, email, profilePicture, walletBalance?, createdAt }`

### Saved Places (Home/Work chips)
```
GET /users/addresses  🔒
```
`[{ id, label, address, latitude, longitude }]` — pickup/drop sheet ke quick chips ke liye.

### Recent Places (Search sheet)
```
GET /users/recent-places?limit=10  🔒
```
Past completed rides ke unique drop locations.

### Notifications Unread Count (Bell badge)
```
GET /notifications/unread-count  🔒
```
`{ unreadCount: 3 }`

---

## RIDE BOOKING FLOW

### Fare Estimate — All Vehicle Types (Vehicle selection screen)
```
GET /pricing/all-estimates?pickup_lat=28.61&pickup_lng=77.20&drop_lat=28.70&drop_lng=77.10
```
Sabhi types ek saath. Auth ki zarurat nahi.
Response:
```json
{
  "distance_km": 12.3,
  "duration_min": 28,
  "estimates": [
    { "vehicleType": "bike", "totalFare": 95, "surge": 1.0, "eta": 3 },
    { "vehicleType": "auto", "totalFare": 145, "surge": 1.2, "eta": 5 }
  ]
}
```
Frontend: `surge > 1.0` aaye to red badge dikhao.

### Single Vehicle Estimate (optional)
```
GET /pricing/estimate?pickup_lat=...&pickup_lng=...&drop_lat=...&drop_lng=...&vehicle_type=auto
```

### Surge Info (optional)
```
GET /pricing/surge?lat=28.61&lng=77.20
```
'Surge in your area' banner ke liye.

### Available Coupons
```
GET /coupons/available?vehicleType=auto  🔒
```
`vehicleType` optional. Apply Coupon screen ke liye.
Response item: `{ code, title, description, discountType, discountValue, minOrderAmount, maxDiscount, expiresAt }`

### Apply Coupon (Validate before booking)
```
POST /coupons/apply  🔒
Body: { "code": "SAVE20", "fareAmount": 230, "vehicleType": "auto" }
```
Response: `{ valid: true, discount: 46, finalFare: 184 }` ya error if invalid. UI mein "Apply" button click pe hit karo.

### Ride Request (Confirm Ride button)
```
POST /rides/request  🔒
Body: {
  "pickupLatitude": 28.61,
  "pickupLongitude": 77.20,
  "pickupAddress": "123 MG Road",
  "dropoffLatitude": 28.70,
  "dropoffLongitude": 77.10,
  "dropoffAddress": "MG Road Metro",
  "vehicleType": "auto",        // bike | auto | economy | xl | executive
  "paymentMethod": "upi",        // cash | wallet | upi | card
  "couponCode": "SAVE20"         // optional
}
```
Response (201): `{ ride: { id, status: 'searching', ... }, fare: { ... } }`. Subscription discount automatically apply hota hai.

**Frontend kya kare**:
1. `rideId` save karo.
2. Socket pe `ride:join` emit karo.
3. Searching screen pe `ride:driver_assigned` (mil gaya) / `ride:no_driver_found` (timeout) listen karo.

---

## SCHEDULED RIDES (Book for Later)

### Schedule a Ride
```
POST /rides/schedule  🔒
Body: {
  "pickupLatitude": 28.61, "pickupLongitude": 77.20, "pickupAddress": "...",
  "dropoffLatitude": 28.70, "dropoffLongitude": 77.10, "dropoffAddress": "...",
  "vehicleType": "auto",
  "scheduledAt": "2026-04-26T08:00:00Z"   // ISO-8601 UTC, future
}
```

### My Scheduled Rides
```
GET /rides/scheduled  🔒
```

### Cancel Scheduled Ride
```
DELETE /rides/scheduled/:id  🔒
```

---

## RIDE TRACKING & DETAILS

### Current Active Ride
```
GET /rides/current  🔒
```
App reopen pe bottom-sheet restore karne ke liye. No active ride → `data: null`.
Status `driver_assigned` / `driver_arrived` mein passenger ko `otp` field bhi milta hai.

### Ride Details (incl. OTP)
```
GET /rides/:rideId  🔒
```
Driver, vehicle, pickup/drop, fare, status sab. **Status flow**: `searching` → `driver_assigned` → `driver_arrived` → `in_progress` → `completed` (ya `cancelled`).

### Cancel Ride
```
POST /rides/:rideId/cancel  🔒
Body: { "reason": "changed_mind" }
```
**reason options (UI suggest)**: `changed_mind` | `driver_late` | `wrong_pickup` | `safety_concern` | `other`.
Driver arrive hone tak free; baad mein cancellation fee response mein aa sakti hai (`cancellationFee` field).

### Ride Invoice (after complete)
```
GET /rides/:rideId/invoice  🔒
```
Receipt screen.
```json
{
  "rideId": 42,
  "baseFare": 40, "distanceFare": 80, "timeFare": 25,
  "convenienceFee": 10, "surgeMultiplier": 1.2,
  "couponDiscount": 30, "subscriptionDiscount": 10,
  "taxes": 8, "total": 123,
  "paymentMethod": "upi", "paymentStatus": "paid"
}
```

### Rate Driver (Quick rating)
```
POST /rides/:rideId/rate  🔒
Body: { "rating": 4, "review": "Great ride" }
```
`rating` 1-5. Tags-wala richer review chahiye to `POST /reviews` use karo.

### Ride History
```
GET /users/rides/history?page=1&limit=10  🔒
```

---

## SOS

### Trigger SOS (Red button)
```
POST /sos  🔒
Body: { "ride_id": 123, "latitude": 28.61, "longitude": 77.20 }
```
Emergency contacts ko SMS + admin ko notify. UI mein big red banner + "Cancel SOS" button rakhna.

### Cancel SOS (False alarm)
```
PATCH /sos/:alertId/cancel  🔒
```
Trigger ke 30s baad confirmation modal: "Cancel if false alarm".

### My SOS History
```
GET /sos/history  🔒
```
Settings/Safety screen mein.

---

## NOTIFICATIONS

### List
```
GET /notifications?limit=20&offset=0  🔒
```
Today/Yesterday/Earlier groups mein sorted. Item: `{ id, title, body, isRead, createdAt, type }`.

### Unread Count
```
GET /notifications/unread-count  🔒
```

### Mark Single Read
```
PATCH /notifications/:id/read  🔒
```

### Mark All Read
```
PATCH /notifications/read-all  🔒
```

---

## PAYMENTS

### Step 1 — Create Payment Order
```
POST /payments/orders  🔒
Body: {
  "amount": 230,
  "purpose": "ride",        // ride | wallet_recharge | subscription
  "rideId": 42,
  "paymentMethod": "upi"    // cash | wallet | upi | card
}
```
- `cash` / `wallet` → auto-confirmed.
- `upi` / `card` → response mein `gateway_order_id` aata hai → Razorpay SDK open karo.

### Step 2 — Verify Payment (Razorpay callback)
```
POST /payments/verify  🔒
Body: { "razorpay_order_id": "...", "razorpay_payment_id": "...", "razorpay_signature": "..." }
```
Razorpay SDK success callback ke 3 fields. Bina iske payment incomplete rahega.

### Payment History
```
GET /payments/history?page=1&limit=10&status=paid&purpose=ride  🔒
```
`status`: `paid` | `pending` | `failed` | `refunded`. `purpose`: `ride` | `wallet_recharge` | `subscription`.

### Single Order Detail
```
GET /payments/orders/:orderNumber  🔒
```
Order + linked refunds.

### Saved Payment Methods
```
GET    /payments/methods                       🔒   — list
POST   /payments/methods                       🔒   — add
DELETE /payments/methods/:methodId             🔒   — remove
PATCH  /payments/methods/:methodId/default     🔒   — set default
```
Body for add: `{ "type": "upi", "vpa": "user@upi", "isDefault": true }` — card ke liye gateway token bhejo (raw card data backend pe nahi).

---

## WALLET

### Wallet Summary (balance + recent txns)
```
GET /wallet  🔒
```

### Balance Only (light call)
```
GET /wallet/balance  🔒
```
Header chip ke liye. `{ balance: 250 }`.

### Add Money — Simple
```
POST /users/wallet/add  🔒
Body: { "amount": 200, "paymentMethod": "upi" }
```
Min ₹10, Max ₹10,000.

### Add Money — Full Recharge Flow (recommended)
```
POST /wallet/recharge  🔒
Body: { "amount": 500, "paymentMethod": "upi" }
```
Recharge intent → `gateway_order_id` → Razorpay SDK → success pe `/payments/verify` call.

### Pay Ride from Wallet
```
POST /wallet/pay-ride  🔒
Body: { "rideId": 42, "amount": 230 }
```
Insufficient balance → 400.

### Transactions
```
GET /wallet/transactions?page=1&limit=20&type=credit  🔒
```
`type`: `credit` | `debit`.

### Single Transaction
```
GET /wallet/transactions/:txnNumber  🔒
```

---

## SUBSCRIPTION

### All Plans (public)
```
GET /subscriptions/plans
```
Auth ki zarurat nahi. Pricing/landing page.

### Plan Details (public)
```
GET /subscriptions/plans/:planId
```

### Active Subscription
```
GET /subscriptions/active  🔒
```
Current plan, valid till, rides used this month, total saved. No active sub → `data: null`.

### Purchase
```
POST /subscriptions/purchase  🔒
Body: { "planId": 2, "paymentMethod": "upi" }
```
Rate-limited 3/hour. UPI/card → gateway flow same as rides.

### Cancel
```
POST /subscriptions/cancel  🔒
Body: { "reason": "too_expensive" }
```

### Toggle Auto-Renew
```
PATCH /subscriptions/auto-renew  🔒
Body: { "autoRenew": true }
```

### Subscription History
```
GET /subscriptions/history?page=1&limit=10  🔒
```

### Subscription Payments
```
GET /subscriptions/:subscriptionId/payments  🔒
```

---

## PROFILE & SETTINGS

### Get Profile
```
GET /users/profile  🔒
```

### Update Profile
```
PUT /users/profile  🔒
Body: { "fullName": "Rahul Sharma", "email": "rahul@email.com" }
```

### Upload Profile Picture
```
POST /users/profile/picture  🔒
Form-data: profilePicture (image file, ≤ 5 MB)
```
Response data: `{ profilePicture: 'https://...' }`.

### Saved Addresses (Home/Work)
```
GET    /users/addresses        🔒   — list
POST   /users/addresses        🔒   — add
PUT    /users/addresses/:id    🔒   — update
DELETE /users/addresses/:id    🔒   — delete
```
Body: `{ "label": "Home", "address": "123 MG Road", "latitude": 28.61, "longitude": 77.20 }`.

### Emergency Contacts
```
GET    /users/emergency-contacts        🔒
POST   /users/emergency-contacts        🔒
PUT    /users/emergency-contacts/:id    🔒
DELETE /users/emergency-contacts/:id    🔒
```
Body: `{ "name": "Mom", "phone": "9876500000", "relation": "mother" }`. Phone same Indian regex.

### Referral
```
GET  /users/referral-code       🔒   — apna code + share message
POST /users/referral/apply      🔒   — kisi aur ka code apply (sirf naye user, pehli baar)
GET  /users/referrals           🔒   — referrals list + earned bonus
```
Body for apply: `{ "code": "FRIEND123" }`.

### Delete Account
```
DELETE /users/account  🔒
```
Soft delete — phone/email pe `-deleted-<userId>` suffix lagta hai (same number se dobara register ho sake). Active ride chal rahi ho to error.
**Frontend**: Confirmation modal + final-delete alert. Local tokens clear karo.

---

## SUPPORT

### Categories
```
GET /support/categories  🔒
```
Trip Issues / Payments & Refunds / Account & Subscription — har ek ke andar sub-items.

### Search Tickets
```
GET /support/search?q=refund  🔒
```
User ke apne tickets mein subject/description search.

### Create Ticket
```
POST /support/tickets  🔒
Body: { "category": "trip_issues", "subject": "Wrong fare charged", "description": "...", "ride_id": 123 }
```
**category options**: `trip_issues` | `payments_refunds` | `account_subscription` | `safety` | `other` (latest list `/support/categories` se lo).

### My Tickets
```
GET /support/tickets?status=in_progress  🔒
```
`status`: `open` | `in_progress` | `resolved` | `closed`.

### Ticket Detail (with messages)
```
GET /support/tickets/:id  🔒
```
Full thread chat-style display ke liye.

### Reply to Ticket
```
POST /support/tickets/:id/reply  🔒
Body: { "message": "Please check the fare again" }
```

---

## REVIEWS

### Feedback Tags (public)
```
GET /reviews/tags?reviewer_type=passenger
```
Rating screen ke chips: Cleanliness, AC Working, Professional, etc. `reviewer_type`: `passenger` | `driver`.

### Submit Detailed Review
```
POST /reviews  🔒
Body: { "rideId": 42, "rating": 5, "comment": "Polite driver", "tags": ["cleanliness", "professional"] }
```
Tags-wala richer review. Quick rating ke liye `POST /rides/:id/rate` use karo.

### Reviews for a Ride
```
GET /reviews/ride/:rideId  🔒
```

### Flag a Review
```
POST /reviews/:reviewId/flag  🔒
```
Abuse report — moderation queue mein bhejta hai.

---

## SOCKET EVENTS (Real-time)

### Connection
```js
const socket = io('http://localhost:3000', {
  auth: { token: accessToken },
  transports: ['websocket']
});
```

### Step 1 — Identify
```js
socket.emit('auth:login', { userId, userType: 'passenger' });
```

### Step 2 — Ride request ke baad room join
```js
socket.emit('ride:join', { rideId });
// ⚠️ Bina iske live tracking nahi milegi
```

### Server → App events
| Event | Payload | Kab aata hai |
|-------|---------|--------------|
| `ride:driver_assigned` | `{ driverName, phone, vehicleNumber, vehicleModel, vehicleColor, rating, eta }` | Driver mil gaya |
| `ride:no_driver_found`  | `{ rideId, message }` | Timeout |
| `driver:map_ping` | `{ latitude, longitude, timestamp }` | Live driver location (3-5s) |
| `ride:eta_update` | `{ etaMinutes, distanceKm, etaType, message }` | `etaType`: `pickup` (driver aa raha) ya `dropoff` (destination tak) |
| `ride:status_changed` | `{ rideId, status }` | `driver_arrived` / `in_progress` / `completed` / `cancelled` |
| `ride:otp_verified` | `{ rideId, verifiedAt }` | Driver ne OTP enter kiya — 'in_progress' screen |
| `chat:new_message` | `{ senderId, senderType, message, timestamp }` | Driver ka chat |
| `chat:user_typing` | `{ userType }` | Typing indicator |

### App → Server events
| Event | Payload |
|-------|---------|
| `auth:login` | `{ userId, userType: 'passenger' }` |
| `auth:reconnect` | `{ userId }` (app restart pe) |
| `ride:join` | `{ rideId }` |
| `ride:leave` | `{ rideId }` (cancel/complete pe) |
| `chat:send` | `{ rideId, message }` |
| `chat:typing` | `{ rideId }` |

### Reconnection
App reopen pe `auth:reconnect` emit karo — backend Redis se queued messages flush karega aur ride rooms wapas join kara dega.

---

## Postman Collection

Ready-to-use collection: [`GoMobility_Passenger.postman_collection.json`](./GoMobility_Passenger.postman_collection.json).
Import karke `baseUrl` set karo, fir `Verify Signin (Login)` chalao — tokens auto-save ho jaayenge.
