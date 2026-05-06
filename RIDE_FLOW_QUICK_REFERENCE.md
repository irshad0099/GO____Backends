# 🚀 Ride Flow - Quick Reference Card

**Print this or keep it in your IDE!**

---

## API Endpoints at a Glance

### Discovery Phase
```
GET  /rides/nearby-drivers?vehicleType=bike&latitude=X&longitude=Y
POST /rides/calculate-fare
POST /rides/payments/calculate  (with subscription benefits)
```

### Ride Lifecycle
```
POST   /rides/request                        (Passenger)
POST   /rides/:rideId/accept                 (Driver)
POST   /rides/:rideId/reject                 (Driver)
PATCH  /rides/:rideId/status                 (Driver)
GET    /rides/current                        (Either)
GET    /rides/:rideId                        (Either)
POST   /rides/:rideId/cancel                 (Passenger)
POST   /rides/:rideId/driver-cancel          (Driver)
GET    /rides/passenger/history              (Passenger)
GET    /rides/driver/history                 (Driver)
```

### OTP & Start
```
POST /rides/:rideId/generate-otp             (Driver at pickup)
POST /rides/:rideId/verify-otp               (Driver enters OTP)
```

### Payments
```
POST /rides/payments                         (Create payment)
GET  /rides/payments/:ride_id/status         (Check status)
POST /rides/cash/confirm                     (Driver confirms cash)
GET  /rides/cash/status/:ride_id             (Check cash status)
```

### After Completion
```
GET  /rides/:rideId/invoice                  (Receipt)
GET  /rides/:rideId/driver-summary           (Driver earnings)
POST /rides/:rideId/rate                     (Leave rating)
```

### Scheduled Rides
```
POST   /rides/schedule                       (Book for later)
GET    /rides/scheduled                      (My scheduled rides)
DELETE /rides/scheduled/:id                  (Cancel scheduled)
```

---

## Status Flow Diagram

```
requested
    ↓
driver_assigned (driver accepted)
    ↓
driver_arrived (driver at pickup)
    ↓
in_progress (OTP verified)
    ↓
completed ← (ride ends)

❌ Can cancel at any stage before ride starts
❌ Driver can emergency cancel anytime
```

---

## Request Payloads (Copy-Paste Ready)

### POST /rides/request
```json
{
  "vehicleType": "bike",
  "pickupLatitude": 28.7041,
  "pickupLongitude": 77.1025,
  "pickupAddress": "Railway Station, Delhi",
  "pickupLocationName": "Railway Station",
  "dropoffLatitude": 28.6139,
  "dropoffLongitude": 77.2090,
  "dropoffAddress": "India Gate, Delhi",
  "dropoffLocationName": "India Gate",
  "paymentMethod": "cash",
  "couponCode": "SAVE10"
}
```

### POST /rides/payments (Cash)
```json
{
  "ride_id": 123,
  "payment_method": "cash"
}
```

### POST /rides/payments (Card/UPI)
```json
{
  "ride_id": 123,
  "payment_method": "card",
  "payment_gateway": "razorpay"
}
```

### POST /rides/:rideId/verify-otp
```json
{
  "otp": "123456"
}
```

### PATCH /rides/:rideId/status
```json
{
  "status": "completed"
}
```

### POST /rides/:rideId/cancel
```json
{
  "reason": "Driver too far"
}
```

### POST /rides/:rideId/rate
```json
{
  "rating": 5,
  "review": "Excellent service"
}
```

---

## WebSocket Events (Critical!)

### Passenger Must Do
```javascript
// After ride created
socket.emit('ride:join', {rideId: 123})

// Listen for driver assignment
socket.on('ride:driver_assigned', (data) => {
  // Update UI with driver name, vehicle, ETA
})

// Listen for live location (every 5 sec)
socket.on('driver:map_ping', (data) => {
  // data.latitude, longitude, speed
  // Update map in real-time
})

// Listen for ride status changes
socket.on('ride:status_changed', (data) => {
  // data.status: 'started', 'completed'
})
```

### Driver Must Do
```javascript
// After accepting ride
socket.emit('ride:join', {rideId: 123})

// Send location every 5 seconds (CRITICAL)
setInterval(() => {
  socket.emit('driver:location_update', {
    rideId: 123,
    latitude: 28.7050,
    longitude: 77.1030,
    speed: 25
  })
}, 5000)

// Listen for new ride requests
socket.on('ride:new_request', (data) => {
  // Show notification, driver can accept/reject
})
```

---

## Response Structures

### Success Response
```json
{
  "success": true,
  "data": { /* actual data */ },
  "message": "Optional message"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {"field": "fieldName", "message": "error details"}
  ]
}
```

---

## Vehicle Types & Payment Methods

**Vehicle Types:**
```
'bike', 'auto', 'car', 'xl', 'premium', 'luxury'
```

**Payment Methods:**
```
'cash', 'card', 'wallet', 'upi', 'qr'
```

**Ride Status Values:**
```
'requested', 'driver_assigned', 'driver_arrived', 'in_progress', 'completed', 'cancelled'
```

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Driver not seeing new ride | Check: WebSocket connected? Using `ride:new_request` listener? |
| Map not updating | Driver must send location every 5 sec. Passenger must use `driver:map_ping` listener |
| OTP not received | Check: SMS provider configured? Passenger phone number correct? |
| Payment fails | Check: Ride status = 'completed'? Amount > 0? Payment method valid? |
| 401 Unauthorized | Token expired → Call `/auth/refresh-token` |
| Ride can't be cancelled | Check: Ride already started? Use `/rides/:rideId/driver-cancel` for driver |
| No active ride | Check: Call `GET /rides/current` — returns null if no active ride |

---

## Headers Required

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

---

## Testing Checklist

### Passenger Flow
- [ ] Get nearby drivers
- [ ] Calculate fare
- [ ] Request ride (join WebSocket room)
- [ ] Receive driver assigned notification
- [ ] See live location updates
- [ ] Receive driver arrived notification
- [ ] Receive ride started notification
- [ ] Pay for ride (cash/digital)
- [ ] Get invoice
- [ ] Rate ride

### Driver Flow
- [ ] Receive new ride request
- [ ] Accept ride (join WebSocket room)
- [ ] Generate OTP at pickup
- [ ] Verify OTP (ride starts)
- [ ] Send location updates (every 5 sec)
- [ ] Mark ride completed
- [ ] Confirm cash payment OR receive digital payment
- [ ] View earnings summary
- [ ] Rate passenger

### Payment Testing
- [ ] Cash payment flow
- [ ] Card payment with Razorpay
- [ ] Subscription discount applied
- [ ] Coupon discount applied
- [ ] Invoice generation
- [ ] Payment status updates

### Error Cases
- [ ] Ride cancellation before driver assigned
- [ ] Ride cancellation after driver assigned (check charges)
- [ ] Invalid OTP attempts (3 strike limit)
- [ ] Token refresh when expired
- [ ] Network disconnection + reconnection recovery

---

## Debugging Tips

### Check Ride Status
```
GET /rides/123  → See current status, driver info, fare, payment status
```

### Check Payment Status
```
GET /rides/payments/123/status  → See if payment pending/success
```

### Simulating Production
1. Use real phone numbers for OTP testing
2. Use actual coordinates (not random)
3. Test with actual payment gateway (Sandbox mode)
4. Enable driver location tracking simulation

### Logs to Monitor
```
✅ [Ride] Created: RIDE-20250505-001
✅ [Driver] Accepted: ride_id=123
✅ [OTP] Generated and sent to passenger
✅ [OTP] Verified by driver
✅ [Ride] Status changed to in_progress
✅ [Payment] Order created: order_123
✅ [Payment] Verified: payment_id=pay_123
```

---

## Quick Links

- **Postman Collection:** `GoMobility_Ride_Flow_API_Collection.postman_collection.json`
- **Full Guide:** `RIDE_FLOW_GUIDE.md`
- **Architecture:** `CLAUDE.md` (see RIDE SERVICE section)
- **API Specs:** `API_INTEGRATION.md`

---

## Constants

**OTP:**
- Length: 6 digits
- Validity: 5 minutes
- Max attempts: 3
- SMS sent to: Passenger's registered phone

**Fare Calculation:**
- Uses coordinates, vehicle type, time, surge factor
- Includes: base fare + distance fare + platform fee
- Check: `core/utils/rideCalculator.js`

**Cancellation Charges:**
- No driver assigned: ₹0
- Driver assigned: ₹50-100
- Ride started: Full fare

**Payment Gateway:**
- Razorpay (default)
- Stripe (optional)

---

**Last Updated:** 2025-05-05  
**Quick Ref Version:** 1.0
