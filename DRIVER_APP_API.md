# Driver App — API Integration Guide

Base URL: `https://yourdomain.com/api/v1`
Auth Header: `Authorization: Bearer <access_token>` (sabhi protected routes pe)

WebSocket URL: `wss://yourdomain.com` (Socket.IO)

---

## Table of Contents

1. [Authentication (Socket.IO)](#1-authentication-socketio)
2. [Home Screen](#2-home-screen)
3. [Earnings Screen — Today Tab](#3-earnings-screen--today-tab)
4. [Earnings Screen — Week / Month Tab](#4-earnings-screen--week--month-tab)
5. [Wallet Screen](#5-wallet-screen)
6. [New Ride Request Popup](#6-new-ride-request-popup)
7. [On the Way to Pickup](#7-on-the-way-to-pickup)
8. [Arrived at Pickup — OTP Screen](#8-arrived-at-pickup--otp-screen)
9. [Arrived at Pickup — Start Ride](#9-arrived-at-pickup--start-ride)
10. [Trip in Progress](#10-trip-in-progress)
11. [Trip Completed](#11-trip-completed)
12. [Collect Cash Screen](#12-collect-cash-screen)
13. [Socket Events — Full Reference](#13-socket-events--full-reference)

---

## 1. Authentication (Socket.IO)

Socket connect hone ke baad sabse pehle yeh event emit karo:

### Connect & Login
```js
// Client → Server
socket.emit('auth:login', {
  token: '<jwt_access_token>',
  userType: 'driver'         // 'driver' | 'passenger'
})

// Server → Client (success)
socket.on('auth:success', {
  userId: 'uuid',
  userType: 'driver',
  message: 'Authenticated successfully'
})

// Server → Client (fail)
socket.on('auth:error', {
  message: 'Invalid token'
})
```

### Reconnect (server restart / network drop ke baad)
```js
// Client → Server
socket.emit('auth:reconnect', {
  token: '<jwt_access_token>',
  userType: 'driver'
})

// Server → Client
socket.on('reconnection:recovery', {
  success: true,
  data: {
    session: { userId, socketId, connectedAt },
    activeRide: { rideId, userType, startedAt } | null,
    queuedMessages: [ { event, data, queuedAt } ],
    recoveredAt: '2026-04-26T10:00:00Z'
  }
})
```

---

## 2. Home Screen

**Kab use hogi:** App open karne pe / dashboard pe wapas aane pe

### 2.1 Driver Profile + Status
```
GET /api/v1/drivers/profile
Auth: Required
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "userId": "uuid",
    "vehicleType": "auto",
    "vehicleNumber": "KA01AB1234",
    "vehicleModel": "Bajaj RE",
    "vehicleColor": "Yellow",
    "isVerified": true,
    "isAvailable": false,
    "isOnDuty": false,
    "currentLocation": {
      "latitude": 12.9352,
      "longitude": 77.6244
    },
    "totalRides": 12,
    "rating": "4.8",
    "totalEarnings": "1245.00"
  }
}
```

### 2.2 Today's Earnings + Total Rides (top cards)
```
GET /api/v1/drivers/earnings?period=today
Auth: Required
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalEarnings": 1245,
    "ridesCompleted": 12,
    "timeOnlineMinutes": 390,
    "platformFeesPaid": 249,
    "averagePerRide": 103,
    "avgRidesPerDay": 12,
    "period": "today"
  }
}
```

### 2.3 Bonus Tracker (9/12 rides, ₹200 bonus)
```
GET /api/v1/drivers/incentives/progress
Auth: Required
```

**Response:**
```json
{
  "success": true,
  "data": {
    "plans": [
      {
        "id": 1,
        "title": "Daily Ride Bonus",
        "description": "Complete 12 rides for ₹200 bonus",
        "targetRides": 12,
        "completedRides": 9,
        "bonusAmount": 200,
        "progressPercent": 75,
        "ridesRemaining": 3,
        "status": "in_progress"
      }
    ]
  }
}
```

### 2.4 GO Online / GO Offline Button
```
PATCH /api/v1/drivers/availability
Auth: Required
Body: { "isAvailable": true }   // true = Online, false = Offline
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isAvailable": true,
    "updatedAt": "2026-04-26T10:00:00Z"
  }
}
```

---

## 3. Earnings Screen — Today Tab

**Kab use hogi:** Earnings screen open karo → "Today" tab tap karo

### 3.1 Today Summary (top cards)
```
GET /api/v1/drivers/earnings?period=today
Auth: Required
```
*(Same as Home Screen 2.2)*

### 3.2 Today's Ride List (ride cards)
```
GET /api/v1/drivers/rides/history?period=today&page=1&limit=20
Auth: Required
```

**Query Params:**
| Param | Type | Description |
|---|---|---|
| period | string | `today` \| `week` \| `month` |
| page | number | Default: 1 |
| limit | number | Default: 10 |
| status | string | Optional filter: `completed` \| `cancelled` |

**Response:**
```json
{
  "success": true,
  "data": {
    "rides": [
      {
        "id": 101,
        "rideNumber": "RD-20260426-83421",
        "passengerName": "Priya S.",
        "passengerPhone": "+919876543210",
        "vehicleType": "auto",
        "pickupAddress": "Koramangala 5th Block",
        "dropoffAddress": "Indiranagar Metro Station",
        "distanceKm": "4.20",
        "durationMinutes": 14,
        "estimatedFare": "145.00",
        "actualFare": "145.00",
        "status": "completed",
        "paymentStatus": "collected_by_driver",
        "requestedAt": "2026-04-26T09:30:00Z",
        "startedAt": "2026-04-26T09:35:00Z",
        "completedAt": "2026-04-26T09:49:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 12,
      "pages": 1
    }
  }
}
```

---

## 4. Earnings Screen — Week / Month Tab

**Kab use hogi:** Earnings screen → "Week" ya "Month" tab tap karo

```
GET /api/v1/drivers/earnings?period=week
GET /api/v1/drivers/earnings?period=month
Auth: Required
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalEarnings": 8456,
    "ridesCompleted": 67,
    "timeOnlineMinutes": 2535,
    "platformFeesPaid": 1691,
    "averagePerRide": 126,
    "avgRidesPerDay": 10,
    "period": "week",
    "startDate": "2026-04-19T00:00:00Z",
    "endDate": "2026-04-26T10:00:00Z",
    "breakdown": [
      { "date": "2026-04-26", "earnings": 145 },
      { "date": "2026-04-25", "earnings": 310 }
    ]
  }
}
```

> `timeOnlineMinutes` → frontend pe convert karo: `Math.floor(mins/60) + 'h ' + (mins%60) + 'm'`

---

## 5. Wallet Screen

**Kab use hogi:** Home screen → "Wallet" quick action tap karo

### 5.1 Available Balance
```
GET /api/v1/wallet/balance
Auth: Required
```

**Response:**
```json
{
  "success": true,
  "data": {
    "balance": "1245.00",
    "currency": "INR"
  }
}
```

### 5.2 Recent Transactions
```
GET /api/v1/wallet/transactions?limit=10
Auth: Required
```

**Query Params:**
| Param | Type | Description |
|---|---|---|
| limit | number | Default: 20 |
| offset | number | Pagination |
| type | string | `credit` \| `debit` |

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": 1,
        "txnNumber": "TXN-20260425-12345",
        "type": "credit",
        "amount": "145.00",
        "description": "Trip #RIDE001",
        "category": "ride_earning",
        "status": "completed",
        "createdAt": "2026-01-25T09:30:00Z"
      },
      {
        "id": 2,
        "txnNumber": "TXN-20260424-99887",
        "type": "debit",
        "amount": "1000.00",
        "description": "Bank Transfer",
        "category": "withdrawal",
        "status": "completed",
        "createdAt": "2026-01-24T14:00:00Z"
      },
      {
        "id": 3,
        "txnNumber": "TXN-20260423-55412",
        "type": "credit",
        "amount": "200.00",
        "description": "Daily Bonus",
        "category": "bonus",
        "status": "completed",
        "createdAt": "2026-01-23T20:00:00Z"
      }
    ]
  }
}
```

### 5.3 Transfer / Withdraw Button
```
POST /api/v1/wallet/withdraw
Auth: Required
Body:
{
  "amount": 500
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "txnNumber": "TXN-20260426-77412",
    "amount": "500.00",
    "status": "processing",
    "message": "Withdrawal initiated"
  }
}
```

---

## 6. New Ride Request Popup

**Kab use hogi:** Driver online hai → passenger ne ride request ki → popup aata hai (13 sec countdown)

### 6.1 Ride Request Receive (WebSocket — Server → Driver)
```js
socket.on('ride:new_request', {
  rideId: 101,
  timeoutSeconds: 13,
  passenger: {
    name: "Priya S.",
    rating: 4.8,
    phone: "+919876543210"
  },
  pickup: {
    address: "Koramangala 5th Block",
    latitude: 12.9352,
    longitude: 77.6244,
    distanceFromDriver: "1 km"
  },
  dropoff: {
    address: "Indiranagar Metro Station",
    latitude: 12.9784,
    longitude: 77.6408
  },
  distanceKm: 4.2,
  durationMinutes: 12,
  estimatedFare: 145,
  vehicleType: "auto"
})
```

### 6.2 Accept Ride

**REST (primary):**
```
POST /api/v1/rides/:rideId/accept
Auth: Required (driver)
```

**Response:**
```json
{
  "success": true,
  "message": "Ride accepted successfully",
  "data": {
    "rideId": 101,
    "status": "driver_assigned",
    "passenger": {
      "name": "Priya S.",
      "phone": "+919876543210"
    },
    "pickup": {
      "address": "Koramangala 5th Block",
      "latitude": 12.9352,
      "longitude": 77.6244
    }
  }
}
```

**WebSocket (accept ke baad ride room join karo):**
```js
socket.emit('ride:join', { rideId: 101 })
```

### 6.3 Decline Ride

**REST (primary):**
```
POST /api/v1/rides/:rideId/reject
Auth: Required (driver)
Body: {}    // reason_code optional — default "other"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rideId": 101,
    "rejected": true
  }
}
```

**WebSocket (optional, real-time ke liye):**
```js
socket.emit('ride:reject', { rideId: 101 })
```

---

## 7. On the Way to Pickup

**Kab use hogi:** Driver ne ride accept ki → pickup ki taraf ja raha hai

### 7.1 Ride Details (screen load pe)
```
GET /api/v1/rides/:rideId
Auth: Required
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 101,
    "rideNumber": "RD-20260426-83421",
    "status": "driver_assigned",
    "passenger": {
      "name": "Priya S.",
      "rating": "4.8",
      "phone": "+919876543210"
    },
    "pickup": {
      "address": "Koramangala 5th Block",
      "latitude": 12.9352,
      "longitude": 77.6244
    },
    "dropoff": {
      "address": "Indiranagar Metro Station",
      "latitude": 12.9784,
      "longitude": 77.6408
    },
    "distanceKm": "4.20",
    "durationMinutes": 12,
    "estimatedFare": "145.00",
    "vehicleType": "auto",
    "paymentMethod": "cash"
  }
}
```

### 7.2 Driver Location Update — Real-time Map (har 4-5 sec mein)
```js
// Client → Server
socket.emit('driver:location_update', {
  latitude: 12.9380,
  longitude: 77.6260,
  rideId: 101,         // ZAROORI — ride ke dauran rideId bhejo
  accuracy: 15,        // optional (meters)
  speed: 25            // optional (km/h)
})

// Server → Ride Room (passenger ko bhi milta hai)
socket.on('driver:map_ping', {
  rideId: 101,
  driverId: 'uuid',
  location: { latitude: 12.9380, longitude: 77.6260 },
  accuracy: 15,
  speed: 25,
  timestamp: '2026-04-26T10:05:00Z'
})

// Server → Ride Room — ETA update
socket.on('ride:eta_update', {
  rideId: 101,
  etaMinutes: 3,
  distanceKm: 0.8,
  etaType: 'pickup',   // 'pickup' | 'dropoff'
  message: 'Driver arriving in 3 min',
  timestamp: '2026-04-26T10:05:00Z'
})
```

### 7.3 I've Arrived Button
```
PATCH /api/v1/rides/:rideId/status
Auth: Required (driver)
Body: { "status": "driver_arrived" }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rideId": 101,
    "status": "driver_arrived",
    "updatedAt": "2026-04-26T10:08:00Z"
  }
}
```

### 7.4 Chat Button (WebSocket)
```js
// Driver → Server
socket.emit('chat:send', {
  rideId: 101,
  message: "Main aa gaya hoon, bahar aao"
})

// Server → Ride Room (dono ko milta hai)
socket.on('chat:new_message', {
  rideId: 101,
  senderId: 'uuid',
  senderType: 'driver',
  message: "Main aa gaya hoon, bahar aao",
  timestamp: '2026-04-26T10:07:00Z'
})

// Typing indicator
socket.emit('chat:typing', { rideId: 101, isTyping: true })
socket.on('chat:typing', { rideId: 101, userId: 'uuid', userType: 'driver', isTyping: true })
```

### 7.5 Call Button
Phone number `GET /rides/:rideId` response se lelo → direct call karo. Koi API nahi.

---

## 8. Arrived at Pickup — OTP Screen

**Kab use hogi:** Driver arrived → passenger ka OTP enter karo

### 8.1 Verify OTP & Start Ride
```
POST /api/v1/rides/:rideId/verify-otp
Auth: Required (driver)
Body: { "otp": "1234" }
```

**Response (success):**
```json
{
  "success": true,
  "data": {
    "rideId": 101,
    "status": "in_progress",
    "message": "OTP verified. Ride started."
  }
}
```

**Response (wrong OTP):**
```json
{
  "success": false,
  "message": "Invalid OTP"
}
```

### 8.2 Emergency Cancel Ride
```
POST /api/v1/rides/:rideId/driver-cancel
Auth: Required (driver)
Body: {}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rideId": 101,
    "status": "cancelled",
    "message": "Ride cancelled successfully"
  }
}
```

**WebSocket — Passenger ko notify milega:**
```js
socket.on('ride:status_changed', {
  rideId: 101,
  status: 'cancelled',
  cancelledBy: 'driver',
  reason: 'emergency',
  timestamp: '2026-04-26T10:10:00Z'
})
```

---

## 9. Arrived at Pickup — Start Ride

**Kab use hogi:** OTP verify ho gaya → "Start Ride" button

```
PATCH /api/v1/rides/:rideId/status
Auth: Required (driver)
Body: { "status": "in_progress" }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rideId": 101,
    "status": "in_progress",
    "startedAt": "2026-04-26T10:12:00Z"
  }
}
```

---

## 10. Trip in Progress

**Kab use hogi:** Ride chal rahi hai → driver dropoff tak ja raha hai

### 10.1 Ride Details (screen load pe)
```
GET /api/v1/rides/:rideId
```
*(Same as Section 7.1)*

### 10.2 Driver Location Update (map tracking)
```js
socket.emit('driver:location_update', {
  latitude: 12.9500,
  longitude: 77.6300,
  rideId: 101
})
```
*(Same as Section 7.2 — ETA type ab `dropoff` hoga)*

### 10.3 End Ride Button
```
PATCH /api/v1/rides/:rideId/status
Auth: Required (driver)
Body: { "status": "completed" }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rideId": 101,
    "status": "completed",
    "completedAt": "2026-04-26T10:26:00Z"
  }
}
```

> **Note:** Payment method `cash` hai to End Ride ke baad Collect Cash screen aayegi.

### 10.4 Report Issue with Rider
```
POST /api/v1/support/tickets
Auth: Required
Body:
{
  "category": "rider_behavior",
  "subject": "Issue with rider",
  "description": "Rider was rude / unsafe behavior etc.",
  "ride_id": 101
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "ticketId": 55,
    "ticketNumber": "TKT-20260426-55",
    "status": "open",
    "message": "Ticket created successfully"
  }
}
```

---

## 11. Trip Completed

**Kab use hogi:** Ride complete hone ke baad — earnings breakdown screen

### 11.1 Driver Ride Summary
```
GET /api/v1/rides/:rideId/driver-summary
Auth: Required (driver)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rideId": 101,
    "pickup": "Koramangala 5th Block",
    "dropoff": "Indiranagar Metro Station",
    "distanceKm": 4.2,
    "durationMinutes": 14,
    "earnings": {
      "tripFare": 145,
      "waitTimeBonus": 10,
      "platformFee": 29,
      "netEarnings": 126
    }
  }
}
```

### 11.2 Bonus Tracker (2 more rides for ₹200)
```
GET /api/v1/drivers/incentives/progress
Auth: Required
```
*(Same as Home Screen Section 2.3)*

---

## 12. Collect Cash Screen

**Kab use hogi:** Cash payment wali ride complete hone ke baad — driver cash collect kare

```
POST /api/v1/rides/:rideId/collect-confirm
Auth: Required (driver)
Body: { "method": "cash" }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rideId": 101,
    "amountCollected": 145,
    "method": "cash",
    "platformShareDue": 29,
    "message": "₹145 collection confirmed"
  }
}
```

> **Note:** Yeh API idempotent hai — double tap safe hai, dobara call karo to same response aayega.

**WebSocket — Confirmation event:**
```js
socket.on('ride:collection_confirmed', {
  rideId: 101,
  amount: 145,
  method: 'cash',
  timestamp: '2026-04-26T10:27:00Z'
})
```

---

## 13. Socket Events — Full Reference

### Driver → Server (Client Emit karta hai)

| Event | Payload | Kab use karo |
|---|---|---|
| `auth:login` | `{ token, userType: 'driver' }` | App open / login ke baad |
| `auth:reconnect` | `{ token, userType: 'driver' }` | Network drop / server restart ke baad |
| `driver:location_update` | `{ latitude, longitude, rideId, accuracy?, speed? }` | Ride ke dauran har 4-5 sec |
| `driver:availability_toggle` | `{ isAvailable: true/false }` | Online/Offline toggle |
| `ride:accept` | `{ rideId }` | Ride accept karne ke baad (REST ke saath) |
| `ride:reject` | `{ rideId }` | Ride decline karne ke baad (REST ke saath) |
| `ride:join` | `{ rideId }` | Ride accept hone ke baad room join karo |
| `ride:leave` | `{ rideId }` | Ride complete / cancel ke baad |
| `chat:send` | `{ rideId, message }` | Passenger ko message bhejo |
| `chat:typing` | `{ rideId, isTyping: true/false }` | Typing indicator |

### Server → Driver (Client Listen karta hai)

| Event | Payload | Kab aata hai |
|---|---|---|
| `auth:success` | `{ userId, userType, message }` | Login success |
| `auth:error` | `{ message }` | Invalid token |
| `ride:new_request` | Full ride payload (Section 6.1) | Passenger ne ride request ki |
| `driver:map_ping` | `{ rideId, driverId, location, speed, timestamp }` | Location broadcast |
| `ride:eta_update` | `{ rideId, etaMinutes, distanceKm, etaType, message }` | Har location ping pe |
| `ride:status_changed` | `{ rideId, status, cancelledBy?, reason?, timestamp }` | Koi bhi status change |
| `ride:collection_confirmed` | `{ rideId, amount, method, timestamp }` | Cash collect confirm |
| `chat:new_message` | `{ rideId, senderId, senderType, message, timestamp }` | Passenger ka message |
| `chat:typing` | `{ rideId, userId, userType, isTyping }` | Passenger typing |
| `reconnection:recovery` | `{ success, data: { session, activeRide, queuedMessages } }` | Reconnect ke baad state restore |
| `ride:participant_reconnected` | `{ userId, userType, rideId, timestamp }` | Koi reconnect kiya ride mein |
| `error` | `{ message }` | Koi bhi error |

---

## Quick Reference — Screen wise API Map

| Screen | REST APIs | Socket Events |
|---|---|---|
| Home | `GET /drivers/profile` `GET /drivers/earnings?period=today` `GET /drivers/incentives/progress` `PATCH /drivers/availability` | `auth:login` `driver:location_update` |
| Earnings Today | `GET /drivers/earnings?period=today` `GET /drivers/rides/history?period=today` | — |
| Earnings Week/Month | `GET /drivers/earnings?period=week\|month` | — |
| Wallet | `GET /wallet/balance` `GET /wallet/transactions` `POST /wallet/withdraw` | — |
| Ride Request | `POST /rides/:id/accept` `POST /rides/:id/reject` | `ride:new_request` `ride:accept` `ride:reject` `ride:join` |
| On Way to Pickup | `GET /rides/:id` `PATCH /rides/:id/status` (driver_arrived) | `driver:location_update` `ride:eta_update` `chat:send` |
| OTP Screen | `POST /rides/:id/verify-otp` `POST /rides/:id/driver-cancel` | — |
| Start Ride | `PATCH /rides/:id/status` (in_progress) | — |
| Trip in Progress | `GET /rides/:id` `PATCH /rides/:id/status` (completed) `POST /support/tickets` | `driver:location_update` `ride:eta_update` `chat:send` |
| Trip Completed | `GET /rides/:id/driver-summary` `GET /drivers/incentives/progress` | — |
| Collect Cash | `POST /rides/:id/collect-confirm` | `ride:collection_confirmed` |
