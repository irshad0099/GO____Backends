# 🚗 GoMobility - Complete Ride Flow Guide

**Last Updated:** 2025-05-05  
**Base URL:** `http://localhost:5000/api/v1`

---

## 📋 Table of Contents

1. [Complete Ride Flow Diagram](#complete-ride-flow-diagram)
2. [Phase 1: Discovery & Estimation](#phase-1-discovery--estimation)
3. [Phase 2: Ride Request & Assignment](#phase-2-ride-request--assignment)
4. [Phase 3: OTP Verification & Ride Start](#phase-3-otp-verification--ride-start)
5. [Phase 4: Ride Completion & Payment](#phase-4-ride-completion--payment)
6. [Phase 5: Invoice & Rating](#phase-5-invoice--rating)
7. [WebSocket Events](#websocket-events)
8. [Error Handling](#error-handling)
9. [Key Validations](#key-validations)

---

## Complete Ride Flow Diagram

```
PASSENGER                         BACKEND                          DRIVER
─────────────────────────────────────────────────────────────────────────────

┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: DISCOVERY & ESTIMATION                                             │
└─────────────────────────────────────────────────────────────────────────────┘

1. GET /rides/nearby-drivers    
   ?vehicleType=bike               → Fetch available drivers
   &latitude=28.7041                  within 5km radius
   &longitude=77.1025              

   Response: List of drivers with ratings, distance, ETA

2. POST /rides/calculate-fare
   Body: {vehicleType, pickupLat,   → Get fare estimate
          pickupLng, dropoffLat,       (no payment created yet)
          dropoffLng}                 

   Response: Detailed fare breakdown
   ├─ baseFare
   ├─ distanceFare
   ├─ surgeFare (if peak hours)
   ├─ platformFee
   └─ finalFare

3. (Optional) POST /rides/payments/calculate
   Body: {vehicleType, location coords,  → Get fare with payment order
          payment_method}                  & subscription benefits applied

   Response: Final amount after discounts + payment order


┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: RIDE REQUEST & ASSIGNMENT                                          │
└─────────────────────────────────────────────────────────────────────────────┘

4. POST /rides/request
   Body: {vehicleType,
          pickupLatitude, pickupLongitude,
          pickupAddress, pickupLocationName,
          dropoffLatitude, dropoffLongitude,
          dropoffAddress, dropoffLocationName,
          paymentMethod: 'cash'|'card'|'upi'|'wallet',
          couponCode: 'SAVE10'}
   
   Header: Authorization: Bearer <passenger_token>
   
   Response: Ride created with status='requested'
   ├─ id: 123
   ├─ rideNumber: 'RIDE-20250505-001'
   ├─ status: 'requested'
   ├─ estimatedFare: 242.5
   └─ webSocketRoom: 'ride:123'  ← Join this room!


5. ☝️ IMPORTANT: Passenger socket.emit('ride:join', {rideId: 123})
   ↓
   Backend finds nearby drivers & broadcasts
   socket.emit('ride:new_request', {...})  ← Drivers receive


6. Driver sees ride notification
   Decides: Accept or Reject?


7a. POST /rides/123/accept
    Header: Authorization: Bearer <driver_token>
    Body: {}
    
    Response: Ride status → 'driver_assigned'
    ├─ driverId assigned
    ├─ estimatedArrival: 5 min
    └─ Passenger notified via WebSocket


7b. (Alternative) POST /rides/123/reject
    Body: {reason_code: 'away_from_route'|'destination_changed'|...}
    
    Response: Ride rejected, system offers to other drivers


8. ☝️ IMPORTANT: Driver socket.emit('ride:join', {rideId: 123})
   ↓
   Now both in same room 'ride:123'
   
9. Driver starts sending location updates
   socket.emit('driver:location_update', {
     rideId: 123,
     latitude: 28.7050,
     longitude: 77.1030,
     speed: 25
   })  ← Every 5 seconds
   
   Passenger receives via WebSocket:
   socket.on('driver:map_ping', {latitude, longitude, speed})


┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: OTP VERIFICATION & RIDE START                                      │
└─────────────────────────────────────────────────────────────────────────────┘

10. Driver arrives at pickup location
    Calls:
    
    POST /rides/123/generate-otp
    Header: Authorization: Bearer <driver_token>
    Body: {}
    
    Response: OTP generated & SMS sent to passenger
    └─ expiresAt: "2025-05-05T10:40:00Z"


11. Driver enters OTP (from SMS) into his app
    
    POST /rides/123/verify-otp
    Header: Authorization: Bearer <driver_token>
    Body: {otp: "123456"}
    
    Response: 
    ├─ verified: true
    ├─ status: 'in_progress'  ← Ride has STARTED
    └─ startedAt: "2025-05-05T10:35:00Z"
    
    WebSocket emitted to room 'ride:123':
    - ride:otp_verified
    - ride:status_changed { status: 'in_progress' }


┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: RIDE COMPLETION & PAYMENT                                          │
└─────────────────────────────────────────────────────────────────────────────┘

12. Driver reaches dropoff, ends ride
    
    PATCH /rides/123/status
    Header: Authorization: Bearer <driver_token>
    Body: {status: 'completed'}
    
    Response:
    ├─ status: 'completed'
    ├─ finalFare: 255.0  ← Final amount calculated
    ├─ completedAt: "2025-05-05T10:48:00Z"
    └─ paymentStatus: 'pending'


13. Backend broadcasts to room 'ride:123':
    ├─ payment:fare_breakdown { ...details }
    └─ payment:status_update { status: 'processing' }


14a. IF CASH PAYMENT:
     Passenger calls:
     
     POST /rides/payments
     Body: {ride_id: 123, payment_method: 'cash'}
     
     Response: 'Please pay driver directly'
     
     Driver confirms cash collection:
     POST /rides/cash/confirm
     Body: {ride_id: 123}
     
     Payment marked as 'collected'


14b. IF DIGITAL PAYMENT (Card/UPI/Wallet):
     Passenger calls:
     
     POST /rides/payments
     Body: {ride_id: 123, 
             payment_method: 'card',
             payment_gateway: 'razorpay'}
     
     Response: Razorpay order created
     ├─ razorpay_order_id: 'order_abc123'
     ├─ amount: 255.0
     └─ status: 'created'
     
     Frontend opens Razorpay checkout
     User completes payment
     Razorpay calls webhook → Backend verifies signature
     
     Status updated to 'success'
     WebSocket emitted: payment:success { receipt }


┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 5: INVOICE & RATING                                                   │
└─────────────────────────────────────────────────────────────────────────────┘

15. GET /rides/123/invoice
    Response: Complete invoice with:
    ├─ invoiceNumber: 'INV-20250505-001'
    ├─ date, time, duration
    ├─ passenger & driver details
    ├─ fare breakdown
    │  ├─ baseFare
    │  ├─ distanceFare
    │  ├─ surgeFare
    │  ├─ platformFee
    │  └─ finalFare
    ├─ payment details
    └─ downloadUrl (PDF)


16. Driver gets summary:
    GET /rides/123/driver-summary
    
    Response:
    ├─ driverEarnings: 231.75
    ├─ platformCommission: 25.75
    ├─ paymentMethod: 'cash'
    └─ paymentStatus: 'collected'


17. POST /rides/123/rate
    Body: {rating: 5, review: 'Great ride!'}
    
    Both passenger & driver can rate each other
    (They can't see each other's rating)

---

## Phase 1: Discovery & Estimation

### 1.1 Get Nearby Drivers

```http
GET /rides/nearby-drivers?vehicleType=bike&latitude=28.7041&longitude=77.1025
Authorization: Bearer <token>
```

**Query Parameters:**
- `vehicleType` (required): `bike`, `auto`, `car`, `xl`, `premium`, `luxury`
- `latitude` (required): -90 to 90
- `longitude` (required): -180 to 180

**Response:**
```json
{
  "success": true,
  "data": {
    "count": 5,
    "drivers": [
      {
        "id": "uuid-1",
        "name": "Raj Kumar",
        "rating": 4.8,
        "vehicleType": "bike",
        "vehicleNumber": "DL-01-AB-1234",
        "latitude": 28.7050,
        "longitude": 77.1030,
        "distance": 0.5,
        "estimatedArrival": 3,
        "completedRides": 250,
        "isAvailable": true
      }
    ]
  }
}
```

### 1.2 Calculate Fare

```http
POST /rides/calculate-fare
Authorization: Bearer <token>
Content-Type: application/json

{
  "vehicleType": "bike",
  "pickupLatitude": 28.7041,
  "pickupLongitude": 77.1025,
  "dropoffLatitude": 28.6139,
  "dropoffLongitude": 77.2090
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "baseFare": 30,
    "perKmFare": 15,
    "distance": 12.5,
    "distanceFare": 187.5,
    "surgeFactor": 1.0,
    "surgeFare": 217.5,
    "platformFee": 25,
    "waitingCharges": 0,
    "estimatedFare": 242.5,
    "currency": "INR",
    "estimatedDuration": 25
  }
}
```

---

## Phase 2: Ride Request & Assignment

### 2.1 Request Ride

```http
POST /rides/request
Authorization: Bearer <passenger_token>
Content-Type: application/json

{
  "vehicleType": "bike",
  "pickupLatitude": 28.7041,
  "pickupLongitude": 77.1025,
  "pickupAddress": "New Delhi Railway Station, Delhi",
  "pickupLocationName": "Railway Station",
  "dropoffLatitude": 28.6139,
  "dropoffLongitude": 77.2090,
  "dropoffAddress": "India Gate, New Delhi",
  "dropoffLocationName": "India Gate",
  "paymentMethod": "cash",
  "couponCode": "SAVE10"
}
```

**Validations:**
- All location fields required
- Address 5-500 characters
- vehicleType must be valid
- paymentMethod: `cash`, `card`, `wallet`, `upi` (default: cash)
- couponCode: 2-50 characters

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "rideNumber": "RIDE-20250505-001",
    "passengerId": "uuid-passenger",
    "driverId": null,
    "vehicleType": "bike",
    "status": "requested",
    "pickupLocation": {
      "latitude": 28.7041,
      "longitude": 77.1025,
      "address": "New Delhi Railway Station, Delhi",
      "locationName": "Railway Station"
    },
    "dropoffLocation": {
      "latitude": 28.6139,
      "longitude": 77.2090,
      "address": "India Gate, New Delhi",
      "locationName": "India Gate"
    },
    "estimatedFare": 242.5,
    "finalFare": null,
    "paymentMethod": "cash",
    "paymentStatus": "pending",
    "couponCode": "SAVE10",
    "discountAmount": 24.25,
    "createdAt": "2025-05-05T10:30:00Z",
    "webSocketRoom": "ride:123"
  },
  "message": "Ride requested successfully"
}
```

**⚠️ Critical:** Passenger MUST call WebSocket:
```javascript
socket.emit('ride:join', {rideId: 123})
```

### 2.2 Accept Ride (Driver)

```http
POST /rides/123/accept
Authorization: Bearer <driver_token>
Content-Type: application/json

{}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "rideNumber": "RIDE-20250505-001",
    "status": "driver_assigned",
    "driverId": "uuid-driver",
    "driver": {
      "name": "Raj Kumar",
      "vehicleNumber": "DL-01-AB-1234",
      "phone": "919876543211",
      "rating": 4.8,
      "latitude": 28.7050,
      "longitude": 77.1030,
      "estimatedArrivalTime": 5
    },
    "acceptedAt": "2025-05-05T10:32:00Z"
  },
  "message": "Ride accepted successfully"
}
```

**⚠️ Critical:** Driver MUST call WebSocket:
```javascript
socket.emit('ride:join', {rideId: 123})
// Then start sending location updates every 5 sec:
socket.emit('driver:location_update', {
  rideId: 123,
  latitude: 28.7050,
  longitude: 77.1030,
  speed: 25
})
```

### 2.3 Reject Ride (Driver)

```http
POST /rides/123/reject
Authorization: Bearer <driver_token>
Content-Type: application/json

{
  "reason_code": "away_from_route"
}
```

**Valid Reason Codes:**
- `away_from_route` — Driver is too far
- `destination_changed` — Destination doesn't suit driver
- `passenger_behavior` — Bad passenger rating
- `other` — Other reason

---

## Phase 3: OTP Verification & Ride Start

### 3.1 Generate OTP

```http
POST /rides/123/generate-otp
Authorization: Bearer <driver_token>
Content-Type: application/json

{}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rideId": 123,
    "otpGenerated": true,
    "smsSent": true,
    "expiresAt": "2025-05-05T10:40:00Z",
    "message": "OTP sent to passenger"
  }
}
```

**What happens:**
- OTP generated (random 6-digit or configured)
- SMS sent to passenger's registered phone
- OTP stored in Redis with 5-minute TTL

### 3.2 Verify OTP

```http
POST /rides/123/verify-otp
Authorization: Bearer <driver_token>
Content-Type: application/json

{
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rideId": 123,
    "verified": true,
    "status": "in_progress",
    "startedAt": "2025-05-05T10:35:00Z",
    "message": "OTP verified successfully. Ride started!"
  },
  "message": "Ride started"
}
```

**⚠️ On Success:**
- Ride status changes to `in_progress`
- WebSocket events emitted:
  - `ride:otp_verified`
  - `ride:status_changed { status: 'in_progress' }`

---

## Phase 4: Ride Completion & Payment

### 4.1 Update Ride Status (Driver)

```http
PATCH /rides/123/status
Authorization: Bearer <driver_token>
Content-Type: application/json

{
  "status": "driver_arrived"
}
```

**Valid Statuses:**
- `driver_arrived` — Driver reached pickup
- `in_progress` — Ride started (usually via OTP)
- `completed` — Ride finished
- `cancelled` — Ride cancelled

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "rideNumber": "RIDE-20250505-001",
    "status": "completed",
    "finalFare": 255.0,
    "completedAt": "2025-05-05T10:48:00Z"
  },
  "message": "Ride status updated successfully"
}
```

### 4.2 Payment: Cash

```http
POST /rides/payments
Authorization: Bearer <passenger_token>
Content-Type: application/json

{
  "ride_id": 123,
  "payment_method": "cash"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Cash payment recorded. Please pay driver directly.",
  "data": {
    "ride": {
      "id": 123,
      "rideNumber": "RIDE-20250505-001",
      "finalFare": 255.0
    },
    "payment_method": "cash",
    "amount": 255.0,
    "status": "cash_collected"
  }
}
```

**Driver confirms cash collection:**

```http
POST /rides/cash/confirm
Authorization: Bearer <driver_token>
Content-Type: application/json

{
  "ride_id": 123
}
```

**Response:**
```json
{
  "success": true,
  "message": "Cash payment confirmed",
  "data": {
    "rideId": 123,
    "amount": 255.0,
    "status": "collected",
    "confirmedAt": "2025-05-05T10:52:00Z",
    "driver": {
      "accountBalance": 2500.0
    }
  }
}
```

### 4.3 Payment: Digital (Card/UPI)

```http
POST /rides/payments
Authorization: Bearer <passenger_token>
Content-Type: application/json

{
  "ride_id": 123,
  "payment_method": "card",
  "payment_gateway": "razorpay"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Ride payment order created",
  "data": {
    "id": "order-456",
    "order_number": "ORD-20250505-002",
    "ride_id": 123,
    "amount": 255.0,
    "currency": "INR",
    "payment_method": "card",
    "payment_gateway": "razorpay",
    "razorpay_order_id": "order_abc123xyz",
    "status": "created"
  }
}
```

**Frontend Integration:**
1. Take `razorpay_order_id` from response
2. Open Razorpay checkout with order ID
3. User completes payment
4. Razorpay calls backend webhook
5. Backend verifies signature & updates status

---

## Phase 5: Invoice & Rating

### 5.1 Get Invoice

```http
GET /rides/123/invoice
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "invoiceNumber": "INV-20250505-001",
    "rideNumber": "RIDE-20250505-001",
    "rideId": 123,
    "date": "2025-05-05",
    "time": "10:35-10:48",
    "durationMinutes": 13,
    "passenger": {
      "name": "John Doe",
      "phone": "919876543210"
    },
    "driver": {
      "name": "Raj Kumar",
      "phone": "919876543211",
      "vehicleNumber": "DL-01-AB-1234",
      "vehicleType": "bike"
    },
    "route": {
      "pickupAddress": "New Delhi Railway Station",
      "dropoffAddress": "India Gate, New Delhi",
      "distance": 12.5,
      "distanceUnit": "km"
    },
    "fareBreakdown": {
      "baseFare": 30,
      "distanceFare": 187.5,
      "timeFare": 15,
      "surgeFare": 0,
      "waitingCharges": 0,
      "platformFee": 25,
      "subtotal": 257.5,
      "discount": 2.5,
      "finalFare": 255.0
    },
    "payment": {
      "method": "cash",
      "status": "collected",
      "amount": 255.0,
      "timestamp": "2025-05-05T10:52:00Z"
    },
    "downloadUrl": "https://api.gomobility.com/invoices/INV-20250505-001.pdf"
  }
}
```

### 5.2 Get Driver Summary

```http
GET /rides/123/driver-summary
Authorization: Bearer <driver_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rideId": 123,
    "rideNumber": "RIDE-20250505-001",
    "passenger": {
      "name": "John Doe",
      "rating": 4.9
    },
    "distance": 12.5,
    "duration": 13,
    "baseFare": 30,
    "distanceFare": 187.5,
    "timeFare": 15,
    "platformFee": 25,
    "totalFare": 257.5,
    "driverEarnings": 231.75,
    "platformCommission": 25.75,
    "paymentMethod": "cash",
    "paymentStatus": "collected"
  }
}
```

### 5.3 Rate Ride

```http
POST /rides/123/rate
Authorization: Bearer <token>
Content-Type: application/json

{
  "rating": 5,
  "review": "Great ride! Professional driver."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rideId": 123,
    "rating": 5,
    "review": "Great ride! Professional driver.",
    "ratedBy": "passenger",
    "ratedAt": "2025-05-05T11:00:00Z"
  },
  "message": "Ride rated successfully"
}
```

---

## WebSocket Events

### Passenger Events

**Emit (Send to server):**
```javascript
// After login
socket.emit('auth:login', {
  userId: 'uuid-passenger',
  userType: 'passenger',
  phone: '919876543210'
})

// Join ride room (MUST be done when ride created)
socket.emit('ride:join', {rideId: 123})

// Leave ride room
socket.emit('ride:leave', {rideId: 123})

// Send message during ride
socket.emit('chat:send', {
  rideId: 123,
  message: 'Driver, can you turn down the AC?'
})

// Typing indicator
socket.emit('chat:typing', {rideId: 123})

// Reconnect after network loss
socket.emit('auth:reconnect', {
  userId: 'uuid-passenger',
  userType: 'passenger'
})
```

**Listen (Receive from server):**
```javascript
// Connection successful
socket.on('auth:success', () => {
  console.log('Connected!')
})

// Recover state after reconnect
socket.on('reconnection:recovery', (data) => {
  // data.activeRide — if ride in progress
  // data.queuedMessages — any messages sent while offline
})

// Driver assigned to your ride
socket.on('ride:driver_assigned', (data) => {
  // data.driverName, vehicleNumber, estimatedArrivalTime
})

// Real-time driver location
socket.on('driver:map_ping', (data) => {
  // data.location.latitude, longitude, speed
  // Update map every 5 seconds
})

// Driver arrived at pickup
socket.on('ride:driver_arrived', () => {})

// Ride status changes
socket.on('ride:status_changed', (data) => {
  // data.status: 'started', 'completed'
})

// Fare breakdown after ride ends
socket.on('payment:fare_breakdown', (data) => {
  // data.breakdown with all charges
})

// Payment processing updates
socket.on('payment:status_update', (data) => {
  // data.status: 'processing', 'completed'
})

// Payment successful
socket.on('payment:success', (data) => {
  // data.receipt
})

// Invoice generated
socket.on('payment:invoice', (data) => {
  // data.invoiceNumber, downloadUrl
})

// Chat message from driver
socket.on('chat:new_message', (data) => {
  // data.message, senderType, senderName
})

// Driver is typing
socket.on('chat:user_typing', (data) => {
  // data.userType
})

// ETA update
socket.on('ride:eta_update', (data) => {
  // data.estimatedMinutes
})

// New notification
socket.on('notification:new', (data) => {
  // data.title, message
})
```

### Driver Events

**Emit (Send to server):**
```javascript
// After login
socket.emit('auth:login', {
  userId: 'uuid-driver',
  userType: 'driver',
  phone: '919876543211'
})

// Join ride room (MUST do when accepting ride)
socket.emit('ride:join', {rideId: 123})

// Leave ride room
socket.emit('ride:leave', {rideId: 123})

// Send location every 5 seconds (HIGH PRIORITY)
socket.emit('driver:location_update', {
  latitude: 28.7050,
  longitude: 77.1030,
  rideId: 123,
  speed: 25
})

// Toggle availability
socket.emit('driver:availability_toggle', {
  isAvailable: true // or false
})

// Accept ride (alternative to REST)
socket.emit('ride:accept', {rideId: 123})

// Reject ride
socket.emit('ride:reject', {
  rideId: 123,
  reason: 'away_from_route'
})

// Send message to passenger
socket.emit('chat:send', {
  rideId: 123,
  message: 'I am 2 minutes away'
})

// Typing
socket.emit('chat:typing', {rideId: 123})

// Reconnect
socket.emit('auth:reconnect', {
  userId: 'uuid-driver',
  userType: 'driver'
})
```

**Listen (Receive from server):**
```javascript
// Connection successful
socket.on('auth:success', () => {})

// Recover state after reconnect
socket.on('reconnection:recovery', (data) => {
  // data.activeRide, data.queuedMessages
})

// New ride request
socket.on('ride:new_request', (data) => {
  // data.rideId, pickupLocation, dropoffLocation, estimatedFare
  // Driver can now accept or reject
})

// Ride assignment confirmed
socket.on('ride:assignment_confirmed', (data) => {
  // data.rideId, passengerName, passengerPhone, pickupLocation
})

// Ride status changed
socket.on('ride:status_changed', (data) => {
  // data.status, timestamp
})

// Payment received notification
socket.on('payment:received', (data) => {
  // data.earnings
})

// Payment settlement (end of day)
socket.on('payment:settlement', (data) => {
  // data.driverEarnings, totalRides
})

// Chat message from passenger
socket.on('chat:new_message', (data) => {
  // data.message, senderType
})

// New notification
socket.on('notification:new', (data) => {
  // data.title, message
})
```

---

## Error Handling

### Common HTTP Status Codes

| Code | Scenario | Example |
|------|----------|---------|
| 200 | Success | Ride accepted, status updated |
| 201 | Created | Ride requested, payment order created |
| 400 | Bad Request | Invalid coordinates, missing fields |
| 401 | Unauthorized | Token expired, invalid token |
| 403 | Forbidden | Passenger trying to accept ride |
| 404 | Not Found | Ride doesn't exist |
| 409 | Conflict | Ride already has a driver |
| 500 | Server Error | Database connection failed |

### Error Response Format

```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "pickupLatitude",
      "message": "Invalid latitude value"
    }
  ]
}
```

### Token Expiration

If you get 401 "Token expired":
```javascript
POST /auth/refresh-token
Body: {refreshToken: "..."}

// Get new tokens and retry original request
```

---

## Key Validations

### Vehicle Types
```
'bike', 'auto', 'car', 'xl', 'premium', 'luxury'
```

### Payment Methods
```
'cash', 'card', 'wallet', 'upi', 'qr'
```

### Ride Statuses
```
'requested' → 'driver_assigned' → 'driver_arrived' → 'in_progress' → 'completed'
                                  ↓
                              (rejected/cancelled anytime)
```

### Location Validation
- Latitude: -90 to 90
- Longitude: -180 to 180
- Address: 5-500 characters

### Cancellation
- **Passenger** can cancel anytime before ride starts (with charges if driver assigned)
- **Driver** can emergency cancel anytime
- Charges apply based on:
  - If no driver assigned: ₹0
  - If driver assigned: ₹50-100
  - If ride started: Full fare

---

## Best Practices

### ✅ DO

- Always join WebSocket room after ride created/assigned
- Send driver location every 5 seconds (not more, not less)
- Implement auto-reconnect for socket disconnections
- Cache driver location locally, update map smoothly
- Show ETA and real-time movement on map
- Handle payment failures gracefully (retry logic)
- Rate rides within 24 hours
- Log all API calls for debugging

### ❌ DON'T

- Broadcast driver location with `io.emit()` — only to `ride:${rideId}` room
- Create multiple payment orders for same ride
- Verify OTP more than 3 times (account lockout)
- Call `/rides/request` without `/ride:join` websocket
- Hardcode fare calculations — use `/rides/calculate-fare` API
- Hold rides in 'requested' status for >5 minutes without assignment
- Send location updates faster than every 5 seconds

---

## Postman Collection

Import the provided **`GoMobility_Ride_Flow_API_Collection.postman_collection.json`**

All endpoints documented with:
- Example requests
- Sample responses
- Query parameters
- Response codes
- Descriptions

---

## Contact & Support

For API issues:
- Check CLAUDE.md for architecture details
- Review error responses for specific errors
- Check WebSocket connection health
- Verify auth tokens validity

Last updated: 2025-05-05
