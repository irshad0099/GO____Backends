# GO Mobility — Pricing Engine: Complete Guide
### Stakeholders + Developers dono ke liye | v4.0 | April 2026

---

# PART A — NON-TECHNICAL GUIDE
### (Business / Product / Stakeholders ke liye — koi code nahi)

---

## A1. Fare Kab Decide Hota Hai

```
Passenger ride book karta hai
    → Estimated fare dikhta hai aur LOCK ho jaata hai

Ride complete hoti hai
    → Final fare calculate hota hai (actual waiting + traffic se)
```

> **Important:** Surge multiplier, convenience fee, aur isPeak (peak tha ya nahi) — yeh teen cheezein
> booking ke time LOCK ho jaati hain. Ride ke beech demand 3x ho jaaye, toofan aa jaaye — fare base
> nahi badlega. Sirf waiting charges aur traffic bonus real-time mein add hote hain.

---

## A2. Passenger Ka Fare Kaise Banta Hai

```
┌──────────────────────────────────────────────────────────┐
│  BASE FARE          →  Vehicle type ka fixed start charge
│  + DISTANCE FARE    →  km × rate per km
│  + WAITING CHARGES  →  7 min grace ke BAAD (driver ko bhi milta hai)
│                    ──────────────────────────────────────
│  = PRE-SURGE SUBTOTAL
│  × SURGE            →  1.0x to 1.75x (peak/demand/weather)
│                    ──────────────────────────────────────
│  = RIDE AMOUNT      (minimum fare se NEECHE nahi jayega)
│  + CONVENIENCE FEE  →  Platform charge (peak/off-peak + distance tier)
│  + GST              →  5% on fare (jab enabled ho)
│                    ──────────────────────────────────────
│  = PASSENGER PAYS
└──────────────────────────────────────────────────────────┘
```

### Saare Vehicle Types Ke Rates (DB Mein Hain — Admin Change Kar Sakta Hai):

| | Bike | Auto | Car | XL | Premium | Luxury |
|--|------|------|-----|-----|---------|--------|
| **Base Fare** | ₹20 | ₹30 | ₹50 | ₹80 | ₹120 | ₹200 |
| **Per KM** | ₹8 | ₹12 | ₹15 | ₹20 | ₹28 | ₹40 |
| **Minimum Fare** | ₹35 | ₹50 | ₹90 | ₹120 | ₹200 | ₹350 |
| **Seats** | 1 | 3 | 4 | 6-7 | 4 (luxury) | 4 (BMW/Merc class) |

---

## A3. Convenience Fee — Distance Se Badlti Hai

Sirf km ka hisaab nahi — **kitni door wali ride hai** uske hisaab se fee ka tier badlta hai:

| Distance Band | Multiplier | Matlab |
|---|---|---|
| 0–3 km (Short) | 0.75x | Base se thodi kam (short hop) |
| 3–7 km (Standard) | 1.0x | Normal base fee |
| 7–15 km (Long) | 1.2x | Thodi zyada |
| 15+ km (Very Long) | 1.4x | Long haul surcharge |

**Aur peak vs off-peak base alag hoti hai:**

| Vehicle | Off-Peak Base | Peak Base |
|---|---|---|
| Bike | ₹5 | ₹10 |
| Auto | ₹10 | ₹20 |
| Car | ₹20 | ₹35 |
| XL | ₹30 | ₹55 |
| Premium | ₹40 | ₹70 |
| Luxury | ₹60 | ₹100 |

**Final convenience fee = base × distance multiplier**

```
Example: Auto, 5 km (standard tier 1.0x), off-peak
  = ₹10 × 1.0 = ₹10

Example: Car, 10 km (long tier 1.2x), peak
  = ₹35 × 1.2 = ₹42
```

---

## A4. Surge — Kab Aur Kitna

System **3 signals** check karta hai:

### Signal 1 — Time (Ghadi Dekhta Hai)
```
Subah  8 AM – 10 AM  →  Morning Peak
Shaam  6 PM –  9 PM  →  Evening Peak
Baaki sab            →  Off-peak
```
Peak time mein sirf convenience fee ka peak band lagta hai. Surge alag se demand se aata hai.

### Signal 2 — Demand (Aas-paas Ki Activity)
```
Demand / Drivers = Ratio

Ratio ≤ 1.1          →  No surge (1.0x)
Ratio 1.1 – 1.3      →  Gradual surge (1.1x – 1.2x)
Ratio > 1.3          →  Progressive surge (capped at 1.75x)
```

**Volume Guard:** Area mein 5 se kam requests hain to surge nahi lagega, chahe ratio kitna bhi ho.

```
Example:
  2 requests, 1 driver → ratio 2.0 → lekin 2 < 5 threshold → NO SURGE
  20 requests, 10 drivers → ratio 2.0, volume ≥ 5 → SURGE LAGEGA
```

### Signal 3 — Weather (Live Mausam Check)
```
Clear/Cloudy/Fog   →  1.0x (no surge)
Baarish/Drizzle    →  1.1x
Toofan/Heavy Snow  →  1.25x
```

### Teen Signals Milke Final Surge:
```
Demand Surge aur Weather Surge STACK NAHI HOTE — jo bada ho woh lagta hai.

Final Surge = max(Demand Surge, Weather Surge)
Absolute cap = 1.75x (non-subscriber)
```

| Situation | Demand | Weather | Final |
|---|---|---|---|
| Normal din, clear | 1.0x | 1.0x | **1.0x** |
| Sirf baarish, low demand | 1.0x | 1.1x | **1.1x** |
| High demand, clear | 1.43x | 1.0x | **1.43x** |
| High demand + baarish | 1.43x | 1.1x | **1.43x** (demand jeet gaya) |
| Low demand + toofan | 1.0x | 1.25x | **1.25x** (weather jeet gaya) |
| Extreme + toofan | 1.75x | 1.25x | **1.75x** (capped) |

---

## A5. Driver Ki Kamai — Alag Formula

```
DRIVER KAMAI = RIDE FARE (floor amount)
             - Platform Fee   (company ka hissa, per ride)
             - GST on fee     (jab GST enabled ho)
             + Pickup Bonus   (door se aaya to)
             + Waiting Bonus  (passenger late aaya to)
             + Traffic Bonus  (jam mein phansa to)
```

### Platform Fee (Driver Se Katta Hai):
| Vehicle | Per Ride | Daily Cap |
|---|---|---|
| Bike | ₹1 | Pehli 10 rides tak |
| Auto | ₹1.5 | Pehli 10 rides tak |
| Car | ₹5 | Pehli 10 rides tak |
| XL | ₹8 | Pehli 10 rides tak |
| Premium | ₹12 | Pehli 10 rides tak |
| Luxury | ₹20 | Pehli 10 rides tak |

**11th ride se koi fee nahi — poora fare driver ka.**

### Waiting Bonus (Driver Ko — Passenger Bhi Deta Hai):
```
Pehle 7 minute BILKUL FREE (grace period)
Uske baad:
  Bike    → ₹1/min
  Auto    → ₹1.5/min
  Car     → ₹2/min
  XL      → ₹2.5/min
  Premium → ₹3/min
  Luxury  → ₹4/min
```

### Traffic Delay Bonus (Sirf Driver Ko — Passenger Ka Fare Nahi Badhta):
```
Estimated time + 30 min tak koi extra nahi
Uske baad:
  Bike    → ₹0.5/min
  Auto    → ₹1/min
  Car     → ₹1.5/min
  XL      → ₹2/min
  Premium → ₹2.5/min
  Luxury  → ₹3/min
```

### Pickup Bonus (Driver Ko — Passenger Ka Fare Nahi Badhta):
```
Pehle 2.5 km FREE (free zone)
Uske baad:
  Bike    → ₹2/extra km
  Auto    → ₹3/extra km
  Car     → ₹4/extra km
  XL      → ₹5/extra km
  Premium → ₹6/extra km
  Luxury  → ₹8/extra km
```

---

## A6. Subscription Plans

### Plans Aur Benefits:

| Plan | Keemat | Free Rides/Month | Conv Fee Discount | Surge Cap |
|---|---|---|---|---|
| **Basic Pass** | ₹99/month | 0 | ≤6km FREE, beyond 50% off | 1.25x max |
| **Prime Pass** | ₹199/month | 2 | ≤6km FREE, beyond 50% off | 1.25x max |
| **Elite Pass** | ₹399/month | 4 | ≤6km FREE, beyond 50% off | **1.1x max** |
| **Annual Pass** | ₹999/year | 2 | ≤6km FREE, beyond 50% off | 1.25x max |

> Free rides har 30 din mein automatically reset hoti hain.

### Convenience Fee Discount Kaise Kaam Karta Hai:
```
Subscriber ke liye convenience fee:

Ride ≤ 6 km  →  Convenience fee = ₹0 (completely free!)
Ride > 6 km  →  Standard fee ka 50% off milta hai

Non-subscriber:
  Auto, 5 km, off-peak → ₹10 × 1.0 = ₹10 lagega
Subscriber (Basic/Prime/Elite/Annual):
  Auto, 5 km → ₹0 (under 6km free zone!)
  Auto, 10 km → ₹10 × 1.2 × 50% = ₹6 (half of standard ₹12)
```

### Surge Cap Kaise Kaam Karta Hai:
```
Normal demand surge: 1.48x chal raha hai

Basic/Prime/Annual subscriber: max 1.25x lagega (1.48 cap ho ke 1.25)
Elite subscriber: max 1.1x lagega (1.48 cap ho ke 1.1)
Non-subscriber: 1.48x lagega (global cap 1.75x)
```

### Priority Order (Kya Pehle Lagta Hai):
```
1. Free ride available hai? → Fare = ₹0, coupon skip hoga
2. Free ride nahi hai → Convenience fee discount apply karo
3. Coupon → uske baad
```

---

## A7. Real Examples — Har Scenario

---

### Example 1 — Simple Auto Ride, Normal Din, Koi Peak Nahi

- Auto, 5 km, dopahar 2 baje, clear sky
- 3 requests, 8 drivers, no subscription

```
Peak Check:
  Time: 2 PM → Normal ✗
  Demand: 3 < 5 minimum → No surge ✗
  Weather: Clear ✗
  → Surge = 1.0x, isPeak = false

Fare:
  Base        = ₹30
  Distance    = 5 km × ₹12 = ₹60
  Subtotal    = ₹90 × 1.0 = ₹90
  Conv Fee    = ₹10 × 1.0 (standard tier) = ₹10  [off-peak base]
  ─────────────────────────────
  Passenger   = ₹100

Driver:
  ₹90 − ₹1.5 (platform fee) = ₹88.5
```

---

### Example 2 — Same Ride, Morning Peak (8 AM), Low Demand

- Auto, 5 km, subah 8 baje, clear sky
- 3 requests, 8 drivers (too few for demand surge)

```
Peak Check:
  Time: 8 AM → Morning Peak ✓
  Demand: 3 < 5 minimum → No demand surge ✗
  Weather: Clear ✗
  → isPeak = true (fee changes), Surge = 1.0x

Fare:
  Base        = ₹30
  Distance    = 5 km × ₹12 = ₹60
  Subtotal    = ₹90 × 1.0 = ₹90
  Conv Fee    = ₹20 × 1.0 (standard tier) = ₹20  [PEAK base]
  ─────────────────────────────
  Passenger   = ₹110

Difference from Example 1: ₹10 zyada — sirf peak convenience fee ki wajah se.
Surge nahi laga, kyunki demand volume low tha.
```

---

### Example 3 — Morning Peak + High Demand + Baarish (Sab Active)

- Auto, 5 km, subah 9 baje
- Baarish, 20 requests, 10 drivers

```
Peak Check:
  Time: 9 AM → Morning Peak ✓
  Demand: 20 ≥ 5, ratio = 2.0 → Demand surge 1.48x ✓
  Weather: Baarish → 1.1x ✓
  → Surge = max(1.48, 1.1) = 1.48x

Fare:
  Base        = ₹30
  Distance    = 5 km × ₹12 = ₹60
  Subtotal    = ₹90 × 1.48 = ₹133.2
  Conv Fee    = ₹20 × 1.0 = ₹20  [peak base]
  ─────────────────────────────
  Passenger   = ₹153.2

Driver:
  ₹133.2 − ₹1.5 = ₹131.7
```

---

### Example 4 — Sirf Toofan, Demand Low

- Car, 10 km, dopahar 3 baje
- Toofan, lekin sirf 4 requests, 8 drivers

```
Peak Check:
  Time: 3 PM → Normal ✗
  Demand: 4 < 5 minimum → No demand surge ✗
  Weather: Toofan → 1.25x ✓
  → Surge = 1.25x, isPeak = false

Fare:
  Base        = ₹50
  Distance    = 10 km × ₹15 = ₹150
  Subtotal    = ₹200 × 1.25 = ₹250
  Conv Fee    = ₹20 × 1.2 (long tier) = ₹24  [off-peak base]
  ─────────────────────────────
  Passenger   = ₹274

Bina toofan: ₹200 + ₹24 = ₹224
Toofan ne ₹50 add kiya.
```

---

### Example 5 — Rider Ne Wait Karaya (7 Min Grace)

- Auto, 8 km, shaam peak, no surge
- Driver 15 minute wait kiya (7 min free, 8 min charged)

```
Estimated Fare (booking time):
  Base + Distance + Conv = (30 + 96) × 1.0 + 20 = ₹146
  Waiting = ₹0 (estimate mein nahi hota)
  Dikhta hai: ~₹146

Final Fare (ride complete pe):
  Waiting = 8 min × ₹1.5 = ₹12 (sirf 8 min charged, 7 free)
  Total   = (30 + 96 + 12) × 1.0 + 20 = ₹158

  Passenger dega: ₹158
  Driver kamai:   ₹138 (fare) − ₹1.5 (fee) + ₹12 (waiting) = ₹148.5
```

---

### Example 6 — Traffic Jam (Driver Ko Bonus, Passenger Ko Nahi)

- Car, 20 km, estimated 35 min
- Actual 90 min lagi (traffic jam)
- Traffic grace: 35 + 30 = 65 min tak free → 25 min overage

```
Final Fare:
  Base + Distance + Conv = (50 + 300) × 1.0 + 24 = ₹374
  Passenger pays: ₹374  (traffic se fare nahi bada)

Driver Kamai:
  ₹350 (fare floor) − ₹5 (platform fee) + ₹37.5 (25 min × ₹1.5) = ₹382.5
  Traffic bonus sirf driver ko gaya — passenger pe koi extra nahi.
```

---

### Example 7 — Subscription Wala User (Elite Pass, 10 km)

- Auto, 10 km, peak demand surge 1.43x chal raha hai
- User ke paas Elite Pass (surge cap 1.1x, conv fee discount)

```
Bina Subscription:
  Base + Distance = ₹30 + ₹120 = ₹150
  × Surge 1.43 = ₹214.5
  + Conv Fee = ₹20 × 1.2 (long tier) = ₹24  [peak]
  Total = ₹238.5

Elite Pass Ke Saath:
  Surge cap = 1.1x (1.43 ko 1.1 pe rok diya)
  Base + Distance = ₹150 × 1.1 = ₹165
  Conv Fee: 10 km > 6km free zone
    Standard = ₹20 × 1.2 = ₹24 → 50% off = ₹12
  Total = ₹165 + ₹12 = ₹177

Elite ne bachaye: ₹238.5 − ₹177 = ₹61.5 ek ride mein!
```

---

### Example 8 — Prime Pass + Free Ride + Coupon

- User ke paas 1 free ride bachi hai (Prime Pass)
- ₹30 off coupon bhi hai

```
Fare calculate hua: ₹180
Free ride apply → Fare = ₹0
Coupon? → SKIP (already ₹0 — coupon kahan lagega?)

Final: ₹0
Coupon waste nahi hoga — system ne use kiya hi nahi.
```

---

### Example 9 — Subscription + Coupon Dono (Free Ride Nahi Bachi)

- Car, 10 km, normal time, no surge
- Annual Pass (conv fee discount) + SAVE20 coupon (₹20 off)

```
Normal conv fee: ₹20 × 1.2 = ₹24
Annual subscriber: 10 km > 6km → 50% off → ₹12

Base fare: (50 + 150) × 1.0 = ₹200
+ Conv fee after subscription = ₹12
After subscription = ₹212

Coupon (SAVE20): ₹212 − ₹20 = ₹192

Sequence: Subscription pehle, coupon baad mein.
```

---

### Example 10 — Pickup Bonus (Driver Bahut Door Se Aaya)

- Bike ride, driver 6 km door se aaya
- Free zone = 2.5 km → Extra = 3.5 km

```
Pickup Compensation:
  3.5 km × ₹2/km = ₹7

Passenger ka fare: koi change nahi
Driver ko extra: ₹7 upar se
```

---

### Example 11 — Short Ride, Minimum Fare Rule

- Auto, 1 km, normal din

```
Base ₹30 + Distance ₹12 = ₹42
Minimum fare = ₹50

₹42 < ₹50 → Minimum fare apply → Passenger pays ₹50
```

---

### Example 12 — Driver Ki 11th Ride (Platform Fee Cap)

- Auto driver, aaj 10 rides kar chuka hai
- 11th ride ka fare: ₹200

```
Rides 1–10:  ₹200 − ₹1.5 (platform fee) = ₹198.5
Ride 11+:    ₹200 − ₹0   (cap reached!)  = ₹200

Jitni zyada rides, utna better driver ke liye.
```

---

### Example 13 — Cancellation Penalty

- Driver 200m door hai, rider cancel karta hai

```
Threshold = 300m. Driver 200m < 300m → Penalty LAGEGI.

₹50 rider se deduct
  Driver ko: ₹40 (80%)
  Platform:  ₹10 (20%)
```

- Driver 700m door hai, rider cancel karta hai

```
700m > 300m → Free cancellation. Driver abhi itna door hai to fair nahi.
```

---

### Example 14 — GPS Real-Time Distance (Actual vs Estimated)

Pehle: Google Maps ka estimated distance use hota tha.
Ab: Driver ka GPS actual chali distance track karta hai.

```
OTP confirm → GPS tracking shuru (Redis mein)
↓
Har driver location ping → distance accumulate (10m se kam ignore — GPS jitter)
↓
Ride complete → Actual GPS distance from Redis use karo
  Agar GPS unreliable (< 2 pings ya < 100m total) → estimated distance fallback

Example:
  Google Maps ne kaha: 8 km
  Driver ne shortcut liya: Actual 6.2 km tracked
  → Passenger ne 6.2 km ka fare diya, 8 ka nahi ✓
```

---

## A8. Kya Kabhi Nahi Badlega Ride Ke Beech

```
Locked at booking time:
  ✓ Surge multiplier
  ✓ Convenience fee
  ✓ isPeak flag
  ✓ Subscriber tier + benefits

Real-time mein add hota hai:
  → Waiting charges (actual minutes logged)
  → Traffic delay bonus (sirf driver ko)
```

---

## A9. Quick Reference Table

| Situation | Passenger | Driver |
|---|---|---|
| Normal din, off-peak | Standard fare | Standard kamai |
| Peak time (8-10, 6-9) | Conv fee zyada | Same |
| High demand surge | Fare × surge (locked at booking) | More kamai |
| Baarish | 1.1x surge | More kamai |
| Toofan | 1.25x surge | More kamai |
| Rider ne wait karaya (>7min) | Waiting charge add | + Waiting bonus |
| Traffic jam | Koi extra nahi | + Traffic bonus |
| Driver door se aaya | Koi extra nahi | + Pickup bonus |
| Basic/Prime/Annual sub | Conv fee 50% off (>6km), surge 1.25x max | Same |
| Elite sub | Conv fee 50% off, surge 1.1x max | Same |
| Free ride | ₹0 | Company pays |
| 11th+ ride (driver) | Same | Platform fee free |
| Cancellation (driver <300m) | ₹50 penalty | ₹40 milta hai |
| Short ride | Minimum fare | Minimum se kam nahi |

---
---

# PART B — TECHNICAL GUIDE
### (Developers ke liye — Architecture, Code Flow, Files)

---

## B1. Architecture — Sab Kuch DB-Driven Hai

**Koi hardcoded pricing value code mein nahi hai.** Sab kuch PostgreSQL mein hai.
Admin dashboard se koi bhi value change karo — 5 minute mein cache refresh ho jaata hai, deploy nahi karna.

```
┌─────────────────────────────────────────────────────────────────────┐
│  PostgreSQL — 7 Pricing Tables                                      │
│  (source of truth — seed in migration 040_create_pricing_config.sql)│
└────────────────────────┬────────────────────────────────────────────┘
                         │ App boot pe / cache miss pe
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  pricingConfigLoader.js                                             │
│  - buildSnapshot() — 6 parallel DB queries                         │
│  - In-memory CACHE object (TTL: 300s from pricing_settings)        │
│  - getPricingConfig() — sync accessor (throws if not init'd)       │
│  - ensurePricingConfig() — async-safe (deduplicates concurrent     │
│    loads with LOAD_PROMISE)                                         │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  rideCalculator.js — Pure fare math (no DB calls, no side effects)  │
│  Functions:                                                         │
│  - calculateEstimatedFare()   — booking time                       │
│  - calculateFinalRideFare()   — completion time                    │
│  - calculateConvenienceFee()  — subscriber-aware                   │
│  - calculateSurgeByDemandSupply()                                   │
│  - calculateWaitingCharges()                                        │
│  - calculateTrafficDelayCompensation()                             │
│  - calculatePickupCompensation()                                   │
│  - calculatePlatformFee()                                          │
│  - calculateGst()                                                  │
│  - detectPeak()                                                    │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  rideService.js — Orchestrator                                      │
│  - gatherDemandSignals() — DB + Redis + Weather API                │
│  - requestRide() — estimate + lock + save                          │
│  - updateRideStatus() — status transitions, GPS tracking           │
│  - calculateCompletionFare() — final fare at completion            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## B2. DB Tables — Kya Kahan Hai

### `pricing_vehicle_config` — Har vehicle ka base data
```sql
vehicle_type          -- 'bike','auto','car','xl','premium','luxury'
base_fare             -- Fixed start charge
per_km_rate           -- Per km rate
minimum_fare          -- Floor fare
platform_fee          -- Per ride company cut
platform_fee_daily_cap -- Ride count cap (default 10)
avg_speed_kmph        -- For ETA calculation
pickup_free_km        -- Free pickup radius (2.5 km default)
pickup_rate_per_km    -- Rate beyond free radius
waiting_grace_minutes -- Free waiting window (7 min)
waiting_rate_per_min  -- Charge after grace
traffic_grace_minutes -- Traffic free buffer (30 min)
traffic_rate_per_min  -- Rate after traffic grace
```

### `pricing_convenience_fee` — Peak vs off-peak base
```sql
vehicle_type    -- FK to pricing_vehicle_config
off_peak_base   -- Base convenience fee (normal time)
peak_base       -- Base convenience fee (peak time)
```
Joined automatically in `fetchVehicleConfigs()` query.

### `pricing_distance_tiers` — Distance multipliers (global, all vehicles)
```sql
tier_name    -- 'short','standard','long','very_long'
min_km       -- Band start
max_km       -- Band end (NULL = unbounded)
multiplier   -- Applied on conv fee base (0.75 / 1.0 / 1.2 / 1.4)
```

### `pricing_subscriber_rules` — Per subscription tier
```sql
tier_name            -- 'none','basic','standard','premium','annual'
free_km              -- Free conv fee zone (6 km for all subscribers)
discount_pct_beyond  -- % off beyond free_km (50% for all subscribers)
surge_cap            -- Max surge this tier sees (1.25 / 1.1 for elite)
```

### `pricing_gst_config` — Single row toggle
```sql
gst_enabled        -- FALSE by default (toggle when GST registration done)
rider_rate_pct     -- 5.00 (SAC 9964)
platform_rate_pct  -- 18.00 (SAC 9985)
```

### `pricing_penalty_config` — Driver offense rules
```sql
offense_type      -- 'wrong_vehicle_rc','category_misrep','route_deviation','excess_cancellation'
offense_count     -- 1st, 2nd, 3rd offense
penalty_amount    -- Wallet deduction
suspension_days   -- 0 = no suspension
requires_rekyc    -- Force re-verification
is_permanent_ban  -- Account termination
rider_refund_amount -- Refund to passenger on this offense
```

### `pricing_settings` — Misc key-value knobs
```
surge_max_multiplier        -- 1.75 (global surge cap)
peak_ratio_threshold        -- 1.2 (demand/supply ratio to trigger)
peak_velocity_threshold     -- 18 (req/min velocity trigger)
min_demand_requests         -- 5 (volume guard)
peak_hours_morning_start/end -- 8, 10
peak_hours_evening_start/end -- 18, 21
weather_surge_mild/severe   -- 1.1, 1.25
cancellation_penalty        -- 50
cancellation_distance_threshold -- 300 (meters)
cancellation_driver_share_pct   -- 80
cancellation_platform_share_pct -- 20
config_cache_ttl_seconds    -- 300 (5 min in-memory cache)
```

---

## B3. Code Flow — requestRide()

```
POST /api/v1/rides/request
  → rideController
    → rideService.requestRide()

1. Active ride check (conflict guard)

2. Geocoding (address → lat/lng if needed)

3. Google Maps API — getDistanceAndDuration()
   Returns: distanceKm, durationMinutes

4. gatherDemandSignals()
   Parallel:
   - rideRepo.countRecentRideRequests()    → rideRequests
   - rideRepo.getRequestVelocity()         → requestVelocity
   - getCachedNearbyDrivers() / findNearby → nearbyDrivers (Redis cached)
   - getWeatherSignal()                    → weatherSignal (OpenWeather API)

5. subscriptionService.getActiveSubscription()
   → subscriberTier, isSubscribed, freeRidesLeft

6. rideCalculator.calculateEstimatedFare({
     vehicleType, distanceKm, pickupDistanceKm,
     rideRequests, availableDrivers, requestVelocity,
     weatherSignal,
     subscriberTier, isSubscribed,
     driverDailyRideCount
   })
   → fare.passenger.estimatedFare
   → fare.signals.surgeMultiplier
   → fare.passenger.convenienceFee
   → fare.passenger.isPeak

7. rideRepo.create() — save ride with locked fields:
   locked_is_subscribed, locked_subscriber_tier,
   locked_surge_cap, locked_is_peak,
   locked_convenience_fee, surge_multiplier

8. Socket emit → nearby drivers (emitRideRequest)
   FCM push → nearby drivers

9. Return estimatedFare to passenger
```

---

## B4. Code Flow — updateRideStatus() → in_progress

```
Driver confirms OTP → status: 'in_progress'

  → startRideTracking(rideId, driverLat, driverLon)
     Redis hash: ride:tracking:{rideId}
       lastLat, lastLon, totalKm=0, pingCount=0
       TTL: 7200s (2 hours)

  → Socket emit ride:status_changed to ride room
  → FCM to passenger
```

---

## B5. Code Flow — driver:location_update (Socket)

```
socket.on('driver:location_update', { latitude, longitude, rideId })

1. updateDriverLocation() → Redis

2. io.to(`ride:${rideId}`).emit('driver:map_ping', ...)
   (ONLY to that ride's room — NOT io.emit broadcast)

3. ETA calculation:
   - findRideById() → ride.status, target lat/lng
   - calculateDistance() → distKm
   - calculateDuration() → etaMinutes (uses avgSpeedKmph from DB)
   - io.to(`ride:${rideId}`).emit('ride:eta_update', ...)

4. GPS tracking (only if in_progress):
   - addTrackingPoint(rideId, lat, lon)
     → calculateDistance from lastLat/lastLon
     → if segment < 0.01 km → skip (GPS jitter)
     → update Redis totalKm, lastLat, lastLon
     → TTL refresh
```

---

## B6. Code Flow — calculateCompletionFare()

```
Driver completes ride → status: 'completed'

1. getActualDistance(rideId) from Redis
   - Returns null if: < 2 pings OR totalKm < 0.1 (unreliable GPS)
   - Returns tracked km (2 decimal places)

2. trackedKm = actualKm ?? ride.distance_km (estimated fallback)

3. rideCalculator.calculateFinalRideFare({
     vehicleType,
     distanceKm: trackedKm,           ← actual GPS or estimated
     waitedMinutes,                   ← from ride.waited_minutes
     actualDurationMinutes,           ← from ride.actual_duration
     estimatedDurationMinutes,
     surgeMultiplier: ride.surge_multiplier,
     lockedConvenienceFee: ride.locked_convenience_fee,
     lockedIsPeak: ride.locked_is_peak,
     lockedSubscriberTier,
     lockedIsSubscribed,
     lockedSurgeCap: ride.locked_surge_cap,
     driverDailyRideCount,
     pickupDistanceKm: ride.driver_pickup_distance_km
   })

4. Save to rides:
   actual_distance_km = trackedKm
   fare_before_gst, passenger_total
   gst_on_fare, gst_on_platform_fee
   waiting_charges, traffic_compensation, pickup_compensation

5. clearRideTracking(rideId) → delete Redis key

6. Wallet debit (passenger), Wallet credit (driver)
7. Invoice create
8. FCM + Socket notify both parties
```

---

## B7. Fare Formula — Exact Math

```
distanceFare      = distanceKm × perKmRate

preSurge          = baseFare + distanceFare + waitingCharges
surgedFare        = preSurge × surgeMultiplier
fareFloor         = max(surgedFare, minimumFare)

convenieceFee     = convenienceBase(peak/offPeak) × distanceTierMultiplier
                    [subscriber: free if ≤freeKm, else (1 - discountPct) × standardFee]

fareBeforeGst     = fareFloor + convenienceFee

gstOnFare         = fareBeforeGst × 5% (if enabled)
passengerTotal    = fareBeforeGst + gstOnFare

gstOnPlatformFee  = platformFee × 18% (if enabled)
driverNet         = fareFloor
                    - platformFee
                    - gstOnPlatformFee
                    + pickupCompensation
                    + waitingCharges
                    + trafficDelayCompensation

NOTE: convenienceFee is NOT in driverNet — it's GO's revenue only.
NOTE: waitingCharges is in BOTH passenger total (via preSurge) AND driver net.
NOTE: pickupCompensation and trafficComp are in driver net only — passenger doesn't pay these.
```

---

## B8. Admin — Pricing Change Karna

All pricing is updatable via Admin API without deploy:

```
PATCH /api/v1/admin/pricing/vehicle/:vehicleType
  Body: { base_fare, per_km_rate, waiting_grace_minutes, ... }
  → pricingConfig.repository.updateVehicleConfig()
  → reloadPricingConfig()  ← cache invalidate + rebuild

PATCH /api/v1/admin/pricing/convenience-fee/:vehicleType
  Body: { off_peak_base, peak_base }
  → updateConvenienceFee()

PATCH /api/v1/admin/pricing/subscriber-rules/:tierName
  Body: { free_km, discount_pct_beyond, surge_cap }
  → updateSubscriberRule()

PATCH /api/v1/admin/pricing/gst
  Body: { gst_enabled, rider_rate_pct, platform_rate_pct }
  → updateGstConfig()

PUT /api/v1/admin/pricing/settings/:key
  Body: { value, value_type }
  → upsertSetting()
```

Cache TTL is `config_cache_ttl_seconds` setting (default 300s).
After admin update, `reloadPricingConfig()` is called immediately — no wait needed.

---

## B9. File Map — Kahan Kya Hai

```
src/
├── modules/pricing/
│   ├── services/
│   │   ├── pricingConfigLoader.js   ← DB → in-memory cache, all getters
│   │   └── Pricingservice.js        ← calculateFare API handler logic
│   ├── repositories/
│   │   └── pricingConfig.repository.js  ← Raw SQL: fetch + update functions
│   ├── controllers/
│   │   ├── pricingController.js     ← GET /calculate-fare
│   │   └── pricingAdminController.js← PATCH admin endpoints
│   └── routes/
│       ├── pricingRoutes.js
│       └── pricingAdminRoutes.js
│
├── core/utils/
│   └── rideCalculator.js            ← Pure fare math (uses pricingConfigLoader)
│
├── modules/rides/services/
│   └── rideService.js               ← requestRide, updateRideStatus, completion
│
├── infrastructure/websocket/
│   ├── socket.server.js             ← driver:location_update → addTrackingPoint
│   └── rideTracking.js              ← Redis GPS accumulation (start/add/get/clear)
│
└── infrastructure/database/migrations/
    ├── 040_create_pricing_config.sql ← All 7 pricing tables + full seed data
    ├── 041_alter_rides_for_pricing_v3.sql ← Locked fields, GST cols, pending_recoveries
    ├── 047_add_actual_distance_to_rides.sql ← actual_distance_km column
    └── 048_update_subscription_plans.sql   ← Free rides + discount values update
```

---

## B10. Critical Rules — Jo Break Karna Mana Hai

1. **Convenience fee is post-surge** — `fareBeforeGst = fareFloor + convFee`, not before
2. **convFee is NOT in driverNet** — driver sirf `fareFloor` se kamaata hai, convFee nahi
3. **Subscriber tier at ride time se lock hota hai** — mid-ride subscription expire hone se fare nahi badlega
4. **Location ping to ride room only** — `io.to('ride:${rideId}').emit(...)` use karo, `io.emit(...)` nahi. Dono (driver + passenger) ko ride:join karna mandatory hai.
5. **GPS tracking sirf in_progress mein** — `startRideTracking` sirf OTP confirm pe, `addTrackingPoint` sirf `status === 'in_progress'` pe
6. **Pricing config throw karta hai agar init nahi hua** — `initPricingConfig()` app boot pe call hona zaroori hai (server.js mein hai)
7. **Pickup compensation passenger total mein nahi** — driver-only compensation hai
8. **Traffic compensation passenger total mein nahi** — driver-only bonus hai

---

*Last Updated: April 2026 — GO Mobility Pricing Engine v4.0*
*DB-driven — koi bhi fare value change karne ke liye admin API use karo, code edit mat karo*
