# GoMobility — Passenger App API Reference

Base URL: `/api/v1`  
Auth: `Authorization: Bearer <accessToken>` (sabhi protected routes pe)

---

## AUTH

### OTP Send
```
POST /auth/send-otp
Body: { "phone": "9876543210", "role": "passenger" }
```
Login/signup ke liye OTP bhejta hai.

### OTP Verify (Login)
```
POST /auth/verify-otp
Body: { "phone": "9876543210", "otp": "1234", "role": "passenger" }
```
OTP verify karke `accessToken` + `refreshToken` deta hai. Driver role ke liye KYC status bhi milta hai.

### Token Refresh
```
POST /auth/refresh-token
Body: { "refreshToken": "..." }
```
Naya access token leta hai jab purana expire ho.

### Logout
```
POST /auth/logout
Body: { "refreshToken": "..." }
```
Session delete karta hai.

### FCM Token Save
```
POST /users/fcm-token  🔒
Body: { "fcm_token": "device_fcm_token" }
```
Login ke baad device FCM token save karo — push notifications ke liye zaroori.

---

## HOME SCREEN

### Nearby Drivers (Map pe cars dikhana)
```
GET /rides/nearby-drivers?latitude=28.61&longitude=77.20&vehicleType=auto  🔒
```
5km radius mein available drivers return karta hai. Redis cache se fast response milta hai.

### User Profile
```
GET /users/profile  🔒
```
Name, phone, email, profile picture deta hai.

### Saved Places (Home/Work chips)
```
GET /users/addresses  🔒
```
User ke saved locations return karta hai.

### Recent Places (Search sheet mein)
```
GET /users/recent-places?limit=10  🔒
```
Completed rides ki history se unique drop locations return karta hai.

### Notifications Count (Bell icon badge)
```
GET /notifications/unread-count  🔒
```
`{ "unreadCount": 3 }` — bell icon pe number dikhane ke liye.

---

## RIDE BOOKING FLOW

### Fare Estimate (Vehicle selection screen)
```
GET /pricing/all-estimates?pickup_lat=28.61&pickup_lng=77.20&drop_lat=28.70&drop_lng=77.10  🔒
```
Sabhi vehicle types (Bike, Auto, Economy, XL, Executive) ke liye fare estimate ek saath deta hai.

### Available Coupons
```
GET /coupons/available  🔒
```
User ke liye applicable coupons list deta hai. "Apply Coupon" field ke liye.

### Ride Request (Confirm Ride button)
```
POST /rides/request  🔒
Body: {
  "pickupLatitude": 28.61,
  "pickupLongitude": 77.20,
  "pickupAddress": "123 MG Road, Bangalore",
  "dropoffLatitude": 28.70,
  "dropoffLongitude": 77.10,
  "dropoffAddress": "MG Road Metro Station",
  "vehicleType": "auto",
  "paymentMethod": "upi",
  "couponCode": "SAVE20"   // optional
}
```
Ride create karke nearby drivers ko notify karta hai. Subscription discount automatically apply hota hai. Response mein `rideId` milta hai jo baaki sab APIs mein use hoga.

---

## SCHEDULED RIDES (Book for Later)

### Schedule a Ride
```
POST /rides/schedule  🔒
Body: {
  "pickupLatitude": 28.61,
  "pickupLongitude": 77.20,
  "pickupAddress": "123 MG Road",
  "dropoffLatitude": 28.70,
  "dropoffLongitude": 77.10,
  "dropoffAddress": "Airport",
  "vehicleType": "auto",
  "scheduledAt": "2026-04-26T08:00:00Z"
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

## SOCKET EVENTS (Real-time)

Socket connect karne ke baad pehle auth event bhejo:
```js
socket.emit('auth:login', { userId, userType: 'passenger' })
```

### Searching → Driver Found
| Event | Direction | Data |
|-------|-----------|------|
| `ride:driver_assigned` | Server → App | driverName, phone, vehicleNumber, vehicleModel, vehicleColor, rating, eta |
| `ride:no_driver_found` | Server → App | — timeout, koi driver nahi mila |

### Ride Room Join (Driver assigned hone ke baad zaroori)
```js
socket.emit('ride:join', { rideId: 123 })
```
Yeh emit karo tabhi live tracking aur ETA milegi.

### Live Tracking
| Event | Direction | Data |
|-------|-----------|------|
| `driver:map_ping` | Server → App | latitude, longitude, timestamp |
| `ride:eta_update` | Server → App | etaMinutes, distanceKm, etaType ('pickup'/'dropoff'), message |

`etaType: 'pickup'` → "Driver arriving in 2 min" (ride start se pehle)  
`etaType: 'dropoff'` → "Reaching destination in 8 min" (ride start ke baad)

### Ride Status Changes
```js
socket.on('ride:status_changed', ({ rideId, status }) => { })
// status: 'driver_arrived' | 'in_progress' | 'completed' | 'cancelled'
```

### Chat (Ride ke dauran)
```js
// Bhejne ke liye
socket.emit('chat:send', { rideId: 123, message: "Main aa raha hoon" })

// Receive karne ke liye
socket.on('chat:new_message', ({ senderId, senderType, message, timestamp }) => { })

// Typing indicator
socket.emit('chat:typing', { rideId: 123 })
socket.on('chat:user_typing', ({ userType }) => { })
```

### OTP Verified → Ride Started
```js
socket.on('ride:otp_verified', ({ rideId, verifiedAt }) => { })
// Yah aate hi 'in_progress' screen pe jao
```

---

## RIDE DETAILS

### Current Active Ride
```
GET /rides/current  🔒
```
App reopen hone pe active ride check karne ke liye. OTP bhi milta hai (status `driver_assigned`/`driver_arrived` mein).

### Ride Details + OTP
```
GET /rides/:rideId  🔒
```
Driver info, vehicle, pickup/dropoff, fare, status sab milta hai.  
Passenger ko `otp` field milta hai jab status `driver_assigned` ya `driver_arrived` ho.

### Cancel Ride
```
POST /rides/:rideId/cancel  🔒
Body: { "reason": "changed_mind" }
```
Driver ke arrive hone tak cancel kar sakte hain.

### Ride Invoice (Ride complete hone ke baad)
```
GET /rides/:rideId/invoice  🔒
```
Base fare, distance fare, time fare, convenience fee, subscription discount, total — sab breakdown milta hai.

### Rate Driver
```
POST /rides/:rideId/rate  🔒
Body: { "rating": 4, "review": "Great ride" }
```
Ride complete hone ke baad driver ko rate karo.

### Ride History
```
GET /users/rides/history?page=1&limit=10  🔒
```

---

## SOS

### SOS Trigger (Red button)
```
POST /sos  🔒
Body: { "ride_id": 123, "latitude": 28.61, "longitude": 77.20 }
```
Alert create karke emergency contacts ko notify karta hai.

### SOS Cancel (False alarm)
```
PATCH /sos/:alertId/cancel  🔒
```
Alert ko `false_alarm` mark karta hai.

---

## NOTIFICATIONS

### Notification List
```
GET /notifications?limit=20&offset=0  🔒
```
Today/Yesterday ke groups mein sorted notifications deta hai.

### Unread Count
```
GET /notifications/unread-count  🔒
```
Bell icon badge ke liye.

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

### Payment History
```
GET /payments/history?page=1&limit=10  🔒
```
Sabhi payments ki list — filter by status/purpose.

### Single Order Detail
```
GET /payments/orders/:orderNumber  🔒
```

---

## WALLET

### Wallet Balance
```
GET /users/wallet  🔒
```

### Add Money
```
POST /users/wallet/add  🔒
Body: { "amount": 200, "paymentMethod": "upi" }
```
Min ₹10, Max ₹10,000.

### Transaction History
```
GET /wallet/transactions  🔒
```

---

## SUBSCRIPTION

### All Plans
```
GET /subscriptions/plans
```
Auth nahi chahiye. Sabhi active subscription plans deta hai.

### Active Subscription
```
GET /subscriptions/active  🔒
```
User ka current plan, active until date, rides this month, total saved amount.

### Subscribe
```
POST /subscriptions/purchase  🔒
Body: { "planId": 2, "paymentMethod": "upi" }
```

### Cancel Subscription
```
POST /subscriptions/cancel  🔒
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
Form-data: profilePicture (image file)
```

### Saved Addresses (Home/Work)
```
GET  /users/addresses        🔒   — list
POST /users/addresses        🔒   — add new
PUT  /users/addresses/:id    🔒   — update
DELETE /users/addresses/:id  🔒   — delete
```
Body for add/update: `{ "label": "Home", "address": "123 MG Road", "latitude": 28.61, "longitude": 77.20 }`

### Emergency Contacts
```
GET    /users/emergency-contacts        🔒
POST   /users/emergency-contacts        🔒
PUT    /users/emergency-contacts/:id    🔒
DELETE /users/emergency-contacts/:id    🔒
```
Body: `{ "name": "Mom", "phone": "9876500000", "relation": "mother" }`

### Referral
```
GET  /users/referral-code       🔒   — apna referral code
POST /users/referral/apply      🔒   — dusre ka code apply karo
GET  /users/referrals           🔒   — referral history
```

### Delete Account
```
DELETE /users/account  🔒
```
Soft delete — phone/email ke peeche `-deleted-<userId>` lag jaata hai taaki same number se dobara register ho sake. Active ride chal rahi ho to error aayega.

---

## SUPPORT

### Categories List
```
GET /support/categories  🔒
```
Trip Issues, Payments & Refunds, Account & Subscription — har category ke saath sub-items.

### Search Tickets
```
GET /support/search?q=refund  🔒
```
User ke apne tickets mein subject/description se search.

### Create Ticket
```
POST /support/tickets  🔒
Body: { "category": "trip_issues", "subject": "Wrong fare charged", "description": "...", "ride_id": 123 }
```

### My Tickets
```
GET /support/tickets?status=in_progress  🔒
```

### Ticket Detail
```
GET /support/tickets/:id  🔒
```
Ticket info + full message thread.

### Reply to Ticket
```
POST /support/tickets/:id/reply  🔒
Body: { "message": "Please check the fare again" }
```

---

## REVIEWS

### Feedback Tags (Rating screen ke liye)
```
GET /reviews/tags?reviewer_type=passenger
```
Cleanliness, AC Working, Professional wagera tags return karta hai.

---

## ERROR RESPONSE FORMAT
```json
{
  "success": false,
  "message": "Error description"
}
```

## SUCCESS RESPONSE FORMAT
```json
{
  "success": true,
  "data": { },
  "message": "Optional message"
}
```
