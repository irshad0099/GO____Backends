# GoMobility — Complete Platform Documentation

> Ride-hailing platform for India (Ola / Uber / Rapido style)
> Two-sided marketplace: Passengers + Drivers

---

# PART A — Business Model & Platform Overview
> For Founders · Investors · Stakeholders · Growth Teams

---

## 1. What is GoMobility?

GoMobility is an **Indian ride-hailing platform** connecting passengers with bike, auto, and cab drivers in real-time. The platform earns from passengers through subscriptions, convenience fees, and platform fees deducted per ride.

Think: Rapido for bikes + Ola for autos/cabs — under one roof.

---

## 2. The Two Sides of the Marketplace

### Side A — Passengers
- Book a ride (bike / auto / car) in seconds
- Real-time driver tracking on map
- Multiple payment options: Cash, UPI, Card, In-app Wallet
- Safety: In-ride SOS button with emergency contact alerts
- Premium subscriptions for daily commuters (discounts, free rides, surge protection)

### Side B — Drivers
- Accept rides via app
- Transparent earnings per ride
- KYC-verified onboarding (Aadhaar, DL, PAN, bank, vehicle RC)
- Incentive programs for high performers
- Small platform fee deducted per ride (₹1–₹5, daily cap applies)

---

## 3. Revenue Streams — How GoMobility Makes Money

GoMobility has **4 active revenue streams**:

---

### Revenue Stream 1 — Passenger Subscriptions (Primary Recurring Revenue)

Passengers can buy **monthly pass plans** for discounts and premium features. This is the "Ola Pass / Amazon Prime" model for rides.

| Plan | Price | Ride Discount | Free Rides/Month | Surge Protection | Priority Booking |
|---|---|---|---|---|---|
| Basic Pass | ₹99/month | 5% off every ride | 0 | ❌ | ❌ |
| Prime Pass | ₹199/month | 10% off every ride | 5 free rides | ❌ | ✅ |
| Elite Pass | ₹399/month | 20% off every ride | 10 free rides | ✅ (no surge ever) | ✅ |
| Annual Pass | ₹999/year | 15% off every ride | 5 free/month | ❌ | ✅ |

**Surge Protection** (Elite Pass) is the most powerful benefit — during peak hours or rain, Elite subscribers always pay the base fare. This is a strong conversion driver.

**Unit Economics Example — Prime Pass subscriber, 20 rides/month:**
```
Subscription revenue         = ₹199
Discount given (10% × rides) = ~₹150 (absorbed by platform margin)
Net gain from subscriber     = ₹49 + higher ride frequency + retention
```

Subscribers ride **2–3x more frequently** than non-subscribers (industry benchmark). Subscription drives **ride volume**, which drives **driver earnings**, which attracts **more drivers** — a flywheel.

---

### Revenue Stream 2 — Platform Fee per Ride (Transaction Revenue)

Every ride generates a small flat fee charged to the driver:

| Vehicle | Platform Fee | Daily Cap |
|---|---|---|
| Bike | ₹1 per ride | ₹10/day (max 10 rides) |
| Auto | ₹1.50 per ride | ₹10/day |
| Car/Cab | ₹5 per ride | ₹50/day |

This is a **supplementary** revenue stream — it adds up at scale but is not the primary model.

**At scale example:**
```
1,000 drivers × 15 rides/day average × ₹1.50 avg fee = ₹22,500/day = ₹6.75L/month
```

---

### Revenue Stream 3 — Convenience Fee (Embedded in Passenger Fare)

Every ride includes a **convenience fee** — a platform service charge embedded in the total fare shown to the passenger. This is NOT shared with drivers.

| Vehicle | Off-Peak | Peak Hours |
|---|---|---|
| Bike | ₹5 flat | ₹10–12 |
| Auto | ₹12–15 | ₹20–25 |
| Car | ₹20–25 | ₹30–50 |

At scale, convenience fees become significant:
```
500 rides/day × ₹10 avg convenience fee = ₹5,000/day = ₹1.5L/month
```

---

### Revenue Stream 4 — Cancellation Penalties (Deterrence + Revenue)

When a passenger cancels a ride after the driver has already started moving toward them (> 500m driven):

```
Cancellation Penalty = ₹50
  → Driver gets      = ₹40 (80%)
  → Platform gets    = ₹10 (20%)
```

Primary purpose is **driver protection** and **reducing frivolous cancellations**, but the 20% platform share adds marginal revenue.

---

## 4. Full Revenue Summary (Monthly — 1,000 Active Drivers, 5,000 Passengers)

| Revenue Source | Estimate/Month |
|---|---|
| Passenger Subscriptions (500 subscribers × ₹199 avg) | **₹99,500** |
| Platform Fee per Ride (1,000 drivers × 15 rides × ₹1.50 avg) | **₹6,75,000** |
| Convenience Fee (15,000 rides/day × 30 days × ₹8 avg) | **₹36,00,000** |
| Cancellation Penalties (est. 2% rides × ₹10 platform share) | **₹9,000** |
| **Total MRR Estimate** | **~₹43L/month** |

> Note: Convenience fee is the largest revenue lever at scale. Passenger subscriptions drive loyalty and ride frequency. These estimates assume tier-2/tier-3 city operations.

---

## 5. The Fare System — What a Passenger Pays

Every ride fare is built from these components:

```
Passenger Fare = (Base Fare + Distance Fare + Convenience Fee + Waiting Charges) × Surge Multiplier
```

| Component | What it is | Example (10km Bike) |
|---|---|---|
| Base Fare | Fixed charge just for booking | ₹20 |
| Distance Fare | ₹8 per km × distance | ₹80 |
| Convenience Fee | Platform service charge | ₹5 (normal) / ₹10 (peak) |
| Waiting Charges | ₹1/min after 3 min grace | ₹0 (no wait) |
| Surge Multiplier | Peak demand multiplier | 1.0x (normal) |
| **Total** | | **₹105** |

### Minimum Fare Safety Net
No ride can go below minimum fares regardless of distance:
- Bike: ₹35 minimum
- Auto: ₹50 minimum
- Car: ₹90 minimum

---

## 6. Dynamic Surge Pricing — The Intelligence Layer

GoMobility uses a **3-signal surge engine** — smarter than simple peak-hour pricing.

### Signal 1 — Time of Day
Peak windows (configurable):
- Morning: 8 AM – 10 AM
- Evening: 6 PM – 9 PM

### Signal 2 — Real-time Demand vs Supply
The system watches **how many ride requests are coming in vs how many drivers are available**:
- Demand/Supply ratio ≥ 1.2 → surge kicks in
- Request velocity ≥ 18 requests/5 min → surge kicks in
- Volume guard: minimum 5 requests needed (prevents 2 requests ÷ 1 driver = 2.0 false spike)

### Signal 3 — Weather Conditions
Live weather from OpenWeatherMap (optional integration):
- Rain / Drizzle / Thunderstorm / Snow → 1.1x surge
- Severe storms / Tornado / Squall → 1.25x surge

### Combined Surge Logic
```
Final Surge = MAX(demand surge, weather surge)  ← Not stacked, best signal wins
Maximum Cap = 1.75x (hardcoded ceiling)
```

**Business benefit:** Surge pricing increases revenue per ride during high-demand moments AND balances supply by incentivizing more drivers to come online.

---

## 7. Driver Economics — Why Drivers Choose GoMobility

### What a Driver Earns (10km Bike Ride, Normal Conditions)
```
Passenger pays         = ₹105
- Platform Fee         = ₹1
+ Pickup Compensation  = ₹0 (within 2.5km)
─────────────────────────────
Driver takes home      = ₹104 (99% of fare!)
```

This is dramatically better than Ola/Uber (drivers get ~75–80% after 20–25% commission).

### Driver-Friendly Features
- **No commission cut** — driver keeps nearly 100% of each fare
- **Flat monthly subscription** — predictable cost, not per-ride tax
- **Pickup compensation** — if driver travels > 2.5km to pick up, they get paid extra (₹3/km for bike)
- **Waiting charges** — drivers are compensated for passenger delays (₹1/min after 3 min grace)
- **Traffic delay compensation** — extra pay if ride takes longer than estimated due to traffic
- **Incentive programs** — bonus earnings for completing daily/weekly ride targets
- **Transparent earnings** — every paisa accounted for in ride invoice

### Driver Subscription Value Proposition
```
Driver earning without GoMobility: 0 rides
Driver earning WITH GoMobility (₹699/month):
  → 15 rides/day × 26 working days = 390 rides/month
  → Average ₹90 per ride = ₹35,100 gross
  → Platform fee = ₹390 (₹1 × 390 rides, capped)
  → Net earnings = ₹34,710 per month
  → Subscription cost = ₹699 (2% of earnings)

ROI for driver: ~50x their subscription cost
```

---

## 8. Passenger Experience — Why Passengers Choose GoMobility

### Core Features
- **Instant booking** — no pre-scheduling required (though scheduled rides exist)
- **Real-time tracking** — see driver on map from acceptance to arrival
- **Ride OTP verification** — driver confirms pickup via OTP, prevents wrong pickups
- **In-ride chat** — message driver without sharing phone number
- **Multiple payment modes** — Cash / UPI / Card / In-app Wallet
- **Digital invoice** — auto-generated after ride completion
- **SOS safety button** — one tap alerts emergency contacts with location

### Subscription Value (Elite Pass Example)
```
Daily commuter: 40 rides/month, 8km avg, bike
Without subscription: 40 × ₹105 = ₹4,200
With Elite Pass (₹399):
  → 10 free rides = ₹0
  → 30 rides × 20% discount = 30 × ₹84 = ₹2,520
  → Surge protection (saves ~₹200 in peak rides)
  Total = ₹0 + ₹2,520 + ₹399 = ₹2,919
  Savings = ₹1,281/month (30% cheaper!)
```

---

## 9. Safety & Trust Infrastructure

### Driver Verification (5-Layer KYC)
All drivers must complete full KYC before going live:

| Document | Verified Via | What's Checked |
|---|---|---|
| Aadhaar | Cashfree Bharat OCR | Identity, address (no govt DB — privacy restriction) |
| PAN Card | Cashfree Bharat OCR + Govt DB | Number, name, DOB extract + cross-verify |
| Driving License | Cashfree Bharat OCR + Govt DB | DL number, class, expiry extract + cross-verify |
| Bank Account | Penny Drop (Cashfree) | Account ownership verification |
| Vehicle RC | Cashfree Bharat OCR + Govt DB | RC number, vehicle class extract + cross-verify |

All 5 must be verified → driver is activated. Partial KYC = blocked from going online.

### Passenger Safety
- **SOS System:** One tap → SMS alerts sent to up to 3 emergency contacts with live location
- **Ride OTP:** Driver cannot mark trip started without passenger confirming OTP
- **In-ride isolation:** Driver ↔ passenger chat is isolated to the active ride room — no personal number sharing

---

## 10. Technology Moat — What Makes GoMobility Defensible

| Capability | Details |
|---|---|
| **Smart Surge Engine** | 3-signal system (time + demand + weather) — most startups use only time-based |
| **Cashfree KYC Suite** | Full digital onboarding — no physical document collection needed |
| **Real-time WebSocket Layer** | Redis-backed Socket.IO — horizontally scalable (supports thousands of concurrent rides) |
| **Multi-SMS Provider** | 4 SMS providers (MSG91, Twilio, Fast2SMS, AuthKey) — automatic failover |
| **Subscription Flywheel** | Subscriptions → loyalty → repeat rides → driver earnings → driver retention |
| **Configurable Pricing** | All fare knobs controlled via environment config — no code change needed to adjust pricing |

---

## 11. Growth Levers

### Supply Growth (More Drivers)
1. Referral program (referrals table exists in DB)
2. Driver incentive programs (daily/weekly ride targets)
3. Document expiry alerts (drivers auto-notified before KYC expires)
4. Destination mode (drivers set preferred drop areas — reduces empty returns)

### Demand Growth (More Passengers)
1. Coupon campaigns (configurable discount codes with expiry and usage limits)
2. Subscription conversion funnels
3. Scheduled rides (book tomorrow's office commute tonight)
4. Referral rewards

### Revenue Growth
1. Increase convenience fee during high-demand corridors
2. Launch premium vehicle categories (premium car, EV, auto-share)
3. Corporate accounts (bulk ride bookings for companies)
4. Surge pricing optimization (currently conservative 1.75x cap — can be raised)

---

## 12. Market Positioning

| | Ola/Uber | Rapido | **GoMobility** |
|---|---|---|---|
| Driver commission | 20–25% per ride | ₹5–15 flat | ₹1–5 flat |
| Driver subscription | No | Yes (bikes) | Yes (all types) |
| Passenger subscription | Ola Pass | Rapido Prime | Yes (4 tiers) |
| Surge pricing | Yes | Limited | Yes (3-signal AI) |
| KYC | Manual/partial | Basic | Full digital (5-doc) |
| Vehicle types | Auto + Car | Bike mainly | Bike + Auto + Car |
| Primary market | Metro cities | Tier 1/2 | Tier 2/3 cities |

**GoMobility's positioning:** Driver-friendly economics (near-zero commission) as the acquisition hook, subscription revenue as the sustainable business model.

---
---

# PART B — Technical Documentation
> For Developers · DevOps · Backend Engineers · Integration Teams

---

## 1. Stack Overview

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js (ESM modules) | 18+ |
| Framework | Express.js | 5.2.1 |
| Database | PostgreSQL | Latest |
| Cache / Session | Redis (ioredis) | 5.10.1 |
| Queue | BullMQ | 5.73.4 |
| Real-time | Socket.IO + Redis Adapter | 4.8.3 |
| Authentication | JWT (jsonwebtoken) | 9.0.3 |
| File Storage | AWS S3 (multer-s3) | SDK v3 |
| Push Notifications | Firebase Admin (FCM) | 10.3.0 |
| KYC / Verification | Cashfree Verification Suite | 4.0.1 |
| Payment Gateway | Razorpay | Latest |
| SMS | MSG91 / Twilio / Fast2SMS / AuthKey | Multi-provider |
| Logging | Winston + daily-rotate-file | 3.19.0 |
| Validation | Joi + express-validator | 18.0.2 |

> **Important:** Despite the repo name `GO____Backends`, this is **Node.js**, not Go.

---

## 2. Repository Structure

```
src/
├── app.js                          # Express app, middleware, route mounting
├── server.js                       # HTTP server bootstrap, DB/Redis connect, Socket.IO init
├── config/
│   ├── envConfig.js                # SINGLE SOURCE OF TRUTH for all config — always import ENV from here
│   ├── redis.config.js             # Redis connection (ioredis)
│   ├── jwt.config.js               # JWT helpers
│   ├── s3.js                       # AWS S3 client
│   └── websocketConfig.js          # Socket.IO initialization with Redis adapter
├── routes/
│   └── index.js                    # Central route registry — mounts all module routes
├── modules/
│   ├── auth/                       # OTP signup/signin, JWT, sessions
│   ├── users/                      # Passenger profiles, addresses, emergency contacts
│   ├── drivers/                    # Driver profiles, earnings, KYC, incentives, penalties
│   ├── rides/                      # Full ride lifecycle — request → accept → complete
│   ├── wallet/                     # In-app wallet, transactions, refunds
│   ├── payments/                   # Razorpay orders, webhook verification
│   ├── subscription/               # Plans, user subscriptions, benefits
│   ├── pricing/                    # Admin pricing configuration API
│   ├── review/                     # Driver + passenger ratings
│   ├── sos/                        # Emergency SOS system
│   ├── coupons/                    # Discount code management
│   ├── support/                    # Support ticket system
│   ├── kyc/                        # Passenger KYC (Cashfree)
│   └── admin/                      # Dashboard, analytics, management
├── core/
│   ├── errors/
│   │   ├── ApiError.js             # Base error class — always throw this
│   │   ├── AuthError.js
│   │   ├── ValidationError.js
│   │   └── globalErrorHandler.js   # Express error middleware (must be last)
│   ├── middleware/
│   │   ├── auth.middleware.js      # JWT authenticate + authorize(role)
│   │   ├── apiLogger.middleware.js # DB-level request/response logging
│   │   ├── upload.middleware.js    # Multer (local)
│   │   └── s3Upload.middleware.js  # Multer-S3 (AWS)
│   ├── logger/
│   │   └── logger.js              # Winston logger — use this, not console.log
│   ├── services/
│   │   └── firebaseService.js     # FCM push notification sender
│   ├── repositories/
│   │   └── apiLog.repository.js   # Writes to api_logs table
│   └── utils/
│       ├── rideCalculator.js      # Canonical fare engine — all fare math lives here
│       └── weatherService.js      # OpenWeatherMap integration (optional)
├── infrastructure/
│   ├── database/
│   │   ├── postgres.js            # Pool singleton (import { db, pool })
│   │   └── migrations/            # 36 SQL migration files
│   ├── websocket/
│   │   ├── socket.server.js       # All socket.on() handlers
│   │   ├── socket.events.js       # Emit helpers + in-memory connection store
│   │   ├── reconnection.handler.js# Redis-backed session recovery
│   │   ├── assignment.handler.js  # Driver-to-ride assignment emissions
│   │   └── payment.handler.js     # Payment status socket emissions
│   ├── queue/
│   │   ├── rideQueue.js           # BullMQ ride completion queue
│   │   ├── payment.queue.js       # BullMQ payment queue
│   │   └── workers/
│   │       ├── notificationWorker.js    # FCM push (concurrency: 10)
│   │       ├── rideCompletionWorker.js  # Post-ride cleanup (concurrency: 5)
│   │       └── paymentWorker.js         # Wallet credit after Razorpay (concurrency: 5)
│   └── external/
│       ├── sms.provider.js        # Multi-provider SMS abstraction
│       └── payment.gateway.js     # Razorpay wrapper
└── scripts/
    └── migrate.js                 # Runs all SQL files in migrations/ folder
```

---

## 3. Module Layering Convention

Every module strictly follows:

```
controllers/  → parse req, call service, return res.json()
services/     → business logic, compose repos, emit socket/FCM
repositories/ → SQL only — one file per domain area
routes/       → express.Router, middleware chain, validators
validators/   → Joi schemas
```

**Rules:**
- Controllers never touch `db` or `pool` directly
- Repos never call other repos
- Cross-module calls: service → service only
- Errors: always `throw new ApiError(statusCode, message)` — never `res.status().json()` from service layer

---

## 4. Entry & Bootstrap Sequence

```
server.js
  ├── db.connect()          → PostgreSQL pool ready
  ├── connectRedis()        → Redis client ready
  ├── http.createServer(app)
  └── initializeSocket(server)
        ├── Socket.IO with Redis adapter
        └── setupSocketHandlers(io)

app.js
  ├── express.json()        → parse body, save rawBody for webhook
  ├── console logger        → method + URL
  ├── apiLoggerMiddleware   → intercepts res.json, writes to api_logs table
  ├── ENV.API_PREFIX routes → /api/v1 → routes/index.js
  ├── notFoundHandler
  └── globalErrorHandler    → MUST be last (4 args)
```

---

## 5. Configuration — envConfig.js

**Always import ENV from here. Never read `process.env` directly.**

```js
import { ENV } from '../../config/envConfig.js';
```

Key config sections:

| Section | Key Vars |
|---|---|
| Server | `PORT`, `NODE_ENV`, `API_PREFIX`, `BASE_URL` |
| Database | `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` |
| Redis | `REDIS_HOST`, `REDIS_PORT`, `UPSTASH_REDIS_URL` |
| JWT | `JWT_SECRET` (30d), `JWT_REFRESH_SECRET` (30d) |
| OTP | `OTP_EXPIRY_MINUTES` (5), `OTP_LENGTH` (4), `OTP_MAX_ATTEMPTS` (3) |
| SMS | `SMS_PROVIDER` → msg91 / twilio / fast2sms / authkey / console |
| Payment | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` |
| Firebase | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` |
| AWS S3 | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` (ap-south-1) |
| Cashfree KYC | `CASHFREE_CLIENT_ID`, `CASHFREE_CLIENT_SECRET`, `CASHFREE_ENV` |
| Surge | `SURGE_MAX_MULTIPLIER` (1.75), `PEAK_RATIO_THRESHOLD` (1.2) |
| Peak Hours | `PEAK_HOURS_MORNING_START` (8), `PEAK_HOURS_EVENING_START` (18) |
| Vehicle Pricing | `BIKE_BASE_FARE`, `BIKE_PER_KM`, `AUTO_BASE_FARE`, `CAR_BASE_FARE` |
| Platform Fee | `PLATFORM_FEE_BIKE` (₹1), `PLATFORM_FEE_AUTO` (₹1.5), `PLATFORM_FEE_CAR` (₹5) |
| Convenience Fee | `CONV_FEE_BIKE_NONPEAK_MIN/MAX`, `CONV_FEE_BIKE_PEAK_MIN/MAX` |
| Waiting | `WAITING_GRACE_MINUTES` (3), `WAITING_RATE_BIKE` (₹1/min) |
| Weather | `OPENWEATHER_API_KEY`, `WEATHER_SURGE_MILD` (1.1), `WEATHER_SURGE_SEVERE` (1.25) |
| Rate Limits | `RATE_LIMIT_MAX_REQUESTS` (100), `AUTH_RATE_LIMIT_MAX` (5), `OTP_RATE_LIMIT_MAX` (3) |

---

## 6. Database — PostgreSQL

### Connection
```js
import { db, pool } from '../../infrastructure/database/postgres.js';

// Direct query
const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);

// Pool proxy (same interface, lazy-resolved)
await pool.query('SELECT ...', [...]);
```

`pool` is a Proxy — it resolves `db.pool` at call-time, not import-time. This fixes the null-pool bug from early initialization.

### Migrations
```bash
npm run migrate   # runs all .sql files in src/infrastructure/database/migrations/ sorted alphabetically
```

36 migration files covering: users, drivers, rides, wallets, transactions, sessions, OTPs, subscriptions, payments, coupons, reviews, SOS, support tickets, KYC (5 driver documents + passenger), ride metadata (OTP, invoice, cancellations, rejections), driver metrics/earnings, incentives, penalties, scheduled rides, saved addresses, api_logs, referrals.

### Key Tables

| Table | Purpose |
|---|---|
| `users` | Passenger accounts |
| `drivers` | Driver profiles + verification status |
| `rides` | Ride lifecycle — all status transitions here |
| `wallets` | One per user, balance + max ₹1,00,000 |
| `transactions` | Every debit/credit with metadata |
| `subscription_plans` | Plan definitions (seeded by admin) |
| `user_subscriptions` | Which user has which plan + free_rides_used |
| `api_logs` | Every request + response stored as JSONB |
| `driver_aadhaar`, `driver_pan`, `driver_license`, `driver_bank`, `vehicle_detail` | 5-doc KYC tables |
| `ride_cancellations` | Cancellation reason + penalty |
| `ride_invoices` | Post-ride fare breakdown |
| `sos_emergency` | SOS events per ride |

---

## 7. Authentication Flow

```
POST /auth/signup   → phone → OTP generated → stored in Redis (5 min TTL)
POST /verify-signup → OTP validated → user created → JWT + refresh token returned

POST /auth/signin   → phone → OTP
POST /verify-signin → OTP → JWT + refresh token

POST /auth/refresh  → refresh token → new access token (30d)
POST /auth/logout   → session invalidated in Redis
```

JWT payload: `{ id, role: 'passenger'|'driver', phone }`

Middleware usage:
```js
import { authenticate, authorize } from '../../core/middleware/auth.middleware.js';

router.get('/profile', authenticate, controller.getProfile);
router.post('/admin-only', authenticate, authorize('admin'), controller.adminAction);
```

OTP rate limit: 3 attempts per 15 minutes per IP.

---

## 8. Fare Calculation Engine

**File:** `src/core/utils/rideCalculator.js` — never duplicate fare math anywhere else.

### Two entry points:

**`calculateEstimatedFare()`** — called at ride request time
```js
import { calculateEstimatedFare } from '../../core/utils/rideCalculator.js';

const fare = calculateEstimatedFare({
  vehicleType: 'bike',          // bike | auto | car
  distanceKm: 10,
  estimatedDurationMinutes: 30,
  pickupDistanceKm: 1.2,
  driverDailyRideCount: 5,
  rideRequests: 12,             // demand signals
  availableDrivers: 8,
  requestVelocity: 20,
  weatherSignal: null           // from weatherService.getWeatherSignal()
});
// Returns: { passenger: { estimatedFare }, driver: { netEarnings }, signals: { surgeMultiplier } }
```

**`calculateFinalRideFare()`** — called at ride completion (surge is LOCKED from request time)
```js
const finalFare = calculateFinalRideFare({
  vehicleType: 'bike',
  distanceKm: 10.3,
  estimatedDurationMinutes: 30,
  actualDurationMinutes: 45,    // real ride time
  waitedMinutes: 5,             // actual wait at pickup
  surgeMultiplier: 1.2,         // locked from request time — never recalculate
  pickupDistanceKm: 1.2,
  driverDailyRideCount: 5,
  lockedConvenienceFee: 10,     // locked at request time
  lockedIsPeak: true            // locked at request time
});
```

### Fare Formula
```
preSurgeSubtotal = baseFare + distanceFare + waitingCharges + convenienceFee
surgedFare       = preSurgeSubtotal × surgeMultiplier
finalFare        = Math.max(surgedFare, minimumFare)

driverNet = finalFare - platformFee + pickupCompensation + waitingCharges + trafficDelayCompensation
```

---

## 9. WebSocket Layer

### Initialize & Access
```js
import { getIO } from '../../config/websocketConfig.js';
const io = getIO();
```

### Room Convention
```
ride:{rideId}   → isolated room for driver + passenger during active ride
```

Both driver and passenger MUST emit `ride:join` with `{ rideId }` for tracking to work.

### Socket Event Handlers (socket.server.js)
| Client Event | Payload | Action |
|---|---|---|
| `auth:login` | `{ userId, userType }` | Register socket session in Redis |
| `auth:reconnect` | `{ userId, userType }` | Restore session, flush message queue, re-join ride rooms |
| `driver:location_update` | `{ latitude, longitude }` | Update Redis, emit `driver:map_ping` to ride room |
| `driver:availability_toggle` | `{ isAvailable }` | Update driver availability in DB + Redis |
| `ride:join` | `{ rideId }` | socket.join(`ride:${rideId}`) |
| `ride:leave` | `{ rideId }` | socket.leave(`ride:${rideId}`) |
| `chat:send` | `{ message }` | Broadcast to ride room |

### Emit Helpers (socket.events.js)
```js
import { emitToDriver, emitToPassenger, emitRideStatusUpdate } from '../websocket/socket.events.js';

emitToDriver(driverUserId, 'ride:new_request', { rideId, fare });
emitToPassenger(passengerUserId, 'ride:status_update', { rideId, status: 'accepted' });
emitRideStatusUpdate(rideId, status, data);
```

**Critical:** Driver socket sessions key on `user_id` (auth user), not `driver.id` (driver table row). Always use `driver.user_id` for socket emissions.

### Service → Socket Integration Pattern
```js
// In any service method — always wrap in safeEmit
const safeEmit = (fn) => { try { fn(); } catch(e) { logger.warn('socket emit failed:', e.message); } };

safeEmit(() => emitToPassenger(passengerId, 'ride:accepted', { rideId, driverInfo }));
// Then send FCM as backup
await firebaseService.sendNotification(passengerFcmToken, 'Driver assigned', '...');
```

Socket failure must never break the API response.

---

## 10. Background Queue (BullMQ)

Three queues, all backed by Redis:

### Notification Queue
```js
import { notificationQueue } from '../queue/rideQueue.js';

await notificationQueue.add('send-fcm', {
  fcmToken: driver.fcm_token,
  title: 'New Ride Request',
  body: 'Passenger nearby',
  data: { rideId }
});
// Worker: notificationWorker.js (concurrency: 10)
```

### Ride Completion Queue
```js
import { rideCompletionQueue } from '../queue/rideQueue.js';

await rideCompletionQueue.add('complete-ride', {
  rideId, driverId, netEarnings, couponId, finalFare
});
// Worker: updates driver stats + coupon usage (concurrency: 5)
```

### Payment Queue
```js
import { paymentQueue } from '../queue/payment.queue.js';

await paymentQueue.add('process-payment', { order });
// Worker: credits wallet after Razorpay confirmation (rate: 10/sec)
```

---

## 11. API Logging System

Every HTTP request/response is logged to `api_logs` table (added in migration 036).

**Middleware:** `src/core/middleware/apiLogger.middleware.js`
- Intercepts `res.json` — captures response body + status code
- Fires DB insert via `setImmediate` (non-blocking — API response is never delayed)
- Auto-detects module from URL path (`/api/v1/auth/...` → module = `auth`)
- Sanitizes sensitive fields: `password`, `otp`, `token`, `pin`, `secret` → `***`

**Module-level Views:**
```sql
SELECT * FROM auth_logs;         -- all auth requests
SELECT * FROM rides_logs;        -- all ride requests
SELECT * FROM error_logs;        -- all 4xx/5xx across all modules
SELECT * FROM drivers_logs WHERE status_code = 400;  -- driver 400s only
```

**Table columns:**
```
id, module, method, path, status_code, user_id, ip_address, user_agent,
request_body (JSONB), request_params (JSONB), request_query (JSONB),
response_body (JSONB), duration_ms, is_error, error_message, created_at
```

---

## 12. External Services Integration

### SMS (Multi-Provider)
Config: `SMS_PROVIDER = msg91 | twilio | fast2sms | authkey | console`

Fast2SMS specifics (already debugged):
- Endpoint: `bulkV2`
- Header: lowercase `authorization`
- Body: `{ route: 'otp', variables_values: otp, numbers: '91${phone}' }`

### Cashfree KYC
```
ENV.CASHFREE_ENV = 'sandbox' | 'production'
Face match threshold: 75% (CASHFREE_FACE_MATCH_THRESHOLD)
Name match threshold: 70% (CASHFREE_NAME_MATCH_THRESHOLD)
```
5-document flow: Aadhaar OCR → PAN OCR + Govt DB → DL OCR + Govt DB → Bank penny drop → RC OCR + Govt DB

All 4 document types use **Cashfree Bharat OCR** (`/verification/bharat-ocr`) — driver uploads image/PDF, Cashfree extracts fields automatically and cross-verifies PAN/DL/RC against govt DB in the same API call. AWS Textract is NOT used (dead config — `OCR_PROVIDER` in envConfig can be removed).

All 5 verified → `drivers.is_verified = true` → driver goes online.

### Firebase FCM
```js
import { firebaseService } from '../../core/services/firebaseService.js';

await firebaseService.sendNotification(fcmToken, title, body, dataPayload);
```
Gracefully no-ops if Firebase credentials are not configured.

### AWS S3
```
UPLOAD_PROVIDER = 'local' | 's3'
AWS_REGION = 'ap-south-1' (Mumbai)
MAX_FILE_SIZE = 5MB
```
KYC documents, profile photos — stored in S3. Local fallback for development.

### OpenWeatherMap (Optional)
If `OPENWEATHER_API_KEY` is set → weather-based surge activates automatically.
15-minute cache to minimize API calls. If not set → weather surge = 1.0 (no effect).

---

## 13. Error Handling

Always throw typed errors from services:
```js
import { ApiError, NotFoundError, ConflictError, AuthError, ValidationError } from '../../core/errors/ApiError.js';

throw new ApiError(400, 'Invalid vehicle type');
throw new NotFoundError('Ride not found');
throw new ConflictError('User already exists');
throw new AuthError('Token expired');
```

`globalErrorHandler` catches everything and returns:
```json
{ "success": false, "statuscode": 400, "message": "...", "data": {} }
```

500 errors: message hidden in production (`'Something went wrong'`), shown in development.

---

## 14. Response Shape (all endpoints)

Success:
```json
{ "success": true, "data": { ... }, "message": "..." }
```

Error:
```json
{ "success": false, "message": "...", "errors": [...], "data": {} }
```

Never deviate from this shape in new endpoints.

---

## 15. Commands

```bash
npm run dev       # nodemon src/server.js — hot reload
npm start         # node src/server.js — production
npm run migrate   # run all pending SQL migrations

# Single file syntax check (run after every edit)
node --check src/path/to/file.js
```

No working test suite — Jest + supertest installed but no test files. Do not assume tests run.

---

## 16. ESM Rules

This is a **pure ESM** project (`"type": "module"` in package.json).

```js
// ✅ Correct
import { foo } from './foo.js';       // .js extension required
import { ENV } from '../../config/envConfig.js';

// ❌ Wrong
import { foo } from './foo';          // missing .js
const foo = require('./foo');         // CommonJS — not allowed
```

---

## 17. Logging

```js
import logger from '../../core/logger/logger.js';

logger.info('Ride accepted', { rideId, driverId });
logger.warn('Slow query detected', { duration });
logger.error('Payment failed', { error: err.message });

// ❌ Never in committed code
console.log('something');
```

Logs written to: `logs/app.log` with daily rotation.

---

## 18. Adding a New Feature — Checklist

1. Stay inside the relevant module folder
2. Create: `repository` (SQL) → `service` (logic) → `controller` (thin) → `route` (wire up)
3. Throw `ApiError` variants for errors — never `res.status().json()` from service
4. Use `logger` not `console.log`
5. Import `ENV` not `process.env`
6. Add `.js` extensions to all imports
7. If new public endpoint → update `API_INTEGRATION.md`
8. If new table → add SQL migration file in `src/infrastructure/database/migrations/`
9. If new fare logic → extend `rideCalculator.js` + add `ENV.*` knob
10. If emitting socket events → wrap in `safeEmit` + also send FCM as backup
11. Run `node --check src/path/to/new-file.js` before committing
