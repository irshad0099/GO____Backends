# GO Mobility Backend — Pending Work

**Last Updated:** April 2026  
**Branch:** main

---

## CRITICAL — Empty Files (Implement karne hain)

Yeh files exist karti hain but completely empty hain (0 lines):

| File | Kya karna hai |
|------|--------------|
| `src/infrastructure/websocket/socket.server.js` | Socket.IO server setup — ride events ke liye real-time connection |
| `src/infrastructure/websocket/socket.events.js` | Ride events: `ride:requested`, `ride:accepted`, `driver:location`, `ride:completed` |
| `src/infrastructure/queue/rideQueue.js` | Ride request queue — driver ko broadcast karna (Kafka/Bull) |
| `src/infrastructure/queue/payment.queue.js` | Payment processing queue — async refunds, payouts |
| `src/infrastructure/external/payment.gateway.js` | Razorpay/Stripe gateway wrapper |

---

## HIGH PRIORITY — TODO Comments in Code

### 1. Payment Gateway Integration
**File:** `src/modules/payments/services/paymentService.js`

- **Line 203:** Razorpay/Stripe order create API call nahi ki — abhi placeholder `gw_order_${Date.now()}` use ho raha hai
- **Line 408:** Refund API call commented out — `razorpayService.createRefund()` implement karna hai

### ~~2. Driver Pickup Distance Tracking~~ ✅ DONE
- `acceptRide` mein Haversine distance calculate hoti hai driver location → pickup point
- `driver_pickup_distance_km` rides table mein save hoti hai (migration 033)
- `calculateCompletionFare` mein actual value use hoti hai
┌────────────────────────────────────────┬────────────────────────────────────────────────────────────────────────────────────────┐
  │                  File                  │                                         Change                                         │  
  ├────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────┤
  │ migrations/033_...sql                  │ New — driver_pickup_distance_km column add kiya rides table mein                       │  
  ├────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────┤
  │ ride.repository.js                     │ assignDriverToRide(rideId, driverId, pickupDistanceKm) — 3rd param add kiya, DB mein   │
  │                                        │ save karta hai                                                                         │
  ├────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────┤
  │ rideService.js:acceptRide              │ Driver accept karte waqt calculateDistance() call karta hai (driver lat/lng → pickup   │
  │                                        │ lat/lng)                                                                               │
  ├────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────┤
  │ rideService.js:calculateCompletionFare │ ride.driver_pickup_distance_km use karta hai, hardcoded 0 hata diya                    │
  └────────────────────────────────────────┴────────────────────────────────────────────────────────────────────────────────────────┘
  Migration run karni hogi DB pe — 033_alter_rides_add_driver_pickup_distance.sql

### 3. Wallet Payout API
**File:** `src/modules/wallet/services/walletService.js:441`

- Driver payout ke liye bank API call missing hai
- Abhi status update nahi hoti — `success`/`failed` real response se aani chahiye

---

## MEDIUM PRIORITY — Features Incomplete

### 4. Real-time Driver Notifications
- WebSocket server empty hai → driver ko ride request push notification nahi jaati
- Driver manually poll kar raha hai (ya nahi ho raha) — yeh implement karna zaroori hai flow ke liye

### 5. Ride Queue / Driver Broadcast
- `rideQueue.js` empty hai → jab passenger ride request kare, nearby drivers ko broadcast nahi hota
- Without this, `acceptRide` API meaningless hai — driver ko pata kaise chalega?

### 6. Scheduled Rides — Auto-Trigger Logic
**Module:** `src/modules/rides/services/scheduledRideService.js`  
- Scheduled ride DB mein save hoti hai ✅  
- But scheduled time pe automatically ride request trigger karne ka cron/queue logic banana hai

---

## LOW PRIORITY — Minor Gaps

### 7. SOS / Support / Coupon — Integration
- **SOS** (`src/modules/sos/`) — service bana hai, but koi notification/alert system nahi (SMS ya push)
- **Support** (`src/modules/support/`) — tickets create hote hain, but admin side handling nahi


### 8. Kafka (Optional — README mein mention hai)
- README mein Kafka listed hai as "Optional for driver notifications"
- Decide karna hai: Bull Queue use karein ya Kafka — abhi dono empty hain

---

## DONE ✅ (Kya Kaam Ho Chuka Hai)

- Auth (OTP login, JWT, sessions, brute force protection)
- Ride flow: request → accept → OTP verify → status updates → complete
- Pricing algorithm: surge + weather + demand (fully working, documented)
- Driver module: earnings, incentives, penalties, document expiry, destination mode
- Wallet: rider + driver wallet, withdrawals
- Ride cancellation with penalty
- Ride invoice / receipt
- Subscription module
- Review / rating system
- Payment module (structure ready, gateway pending)
- Pricing admin module
- SOS, Support, Coupon modules (basic structure)
- S3 file uploads
- Redis geo-location for nearby drivers
- Rate limiting, role-based auth

---

## Priority Order (Kya Pehle Karo)

```
1. socket.server.js + socket.events.js   ← App ka core flow toot rha hai iske bina
2. rideQueue.js                           ← Driver broadcast
3. payment.gateway.js (Razorpay)         ← Revenue ke liye
4. Wallet payout API                     ← Driver payments
5. Scheduled ride auto-trigger           ← Feature complete karna
6. Coupon → ride request integration     ← User-facing feature


                                                                                                                                   
                                                                                                                                       
  ---                                                                                     
  Yeh changes kiye:                                                                                                                    
                                                                                                                                       
  ┌──────────────────────────────────┬─────────────────────────────────────────────────────────────────────────────────────────────┐   
  │               File               │                                           Change                                            │   
  ├──────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────┤ 
  │ rideValidator.js                 │ couponCode optional field add kiya requestRideValidators mein                               │
  ├──────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────┤
  │ ride.repository.js — createRide  │ coupon_id + coupon_discount parameters add kiye, INSERT query mein save hote hain           │
  ├──────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────┤
  │ rideService.js                   │ couponService import kiya                                                                   │
  ├──────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────┤
  │ rideService.js — requestRide     │ Fare calculate hone ke baad applyCoupon() call hota hai, discount laga ke estimatedFare     │
  │                                  │ update hoti hai, response mein coupon breakdown bhi aata hai                                │
  ├──────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────┤
  │ rideService.js —                 │ Ride complete hone pe recordUsage() call hota hai — coupon_usages table mein record hota    │
  │ updateRideStatus (completed)     │ hai aur current_uses increment hota hai                                                     │
  └──────────────────────────────────┴─────────────────────────────────────────────────────────────────────────────────────────────┘

  Flow:
  POST /api/v1/rides/request
  {
    ...,
    "couponCode": "FIRST50"   ← optional
  }

  Response:
  {
    "estimatedFare": 95,       ← discount ke baad
    "coupon": {
      "code": "FIRST50",
      "discountApplied": 50,
      "originalFare": 145,
      "message": "₹50 discount applied!"
    }
  }
```
