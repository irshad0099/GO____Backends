# GO Mobility — Price Algorithm: Kaise Kaam Karta Hai (Full Documentation)

Yeh document explain karta hai ki GO Mobility ka pricing algorithm backend mein kahan-kahan spread hai, kaunsi file mein kya ho rha hai, estimated fare kaise nikalta hai, final fare kaise nikalta hai, passenger ko kya dikhta hai, driver ko kya dikhta hai — with real test cases.

---

## 1. Files Ka Overview — Kahan Kya Hai

### File Structure:

```
src/
  config/
    envConfig.js                          ← SAB pricing values yahan se aati hain (ENV)
  core/
    utils/
      rideCalculator.js                   ← MAIN CALCULATOR — sab formulas yahan hain
      weatherService.js                   ← WEATHER API — OpenWeatherMap se real-time weather
  modules/
    rides/
      routes/rideRoutes.js                ← API endpoints define hain
      controllers/rideController.js       ← Request handle karta hai, service ko call karta hai
      services/rideService.js             ← BUSINESS LOGIC — demand + weather signals, estimated/final fare
      repositories/ride.repository.js     ← DB QUERIES — real demand count, drivers, rides
```

### Kaunsi File Mein Kya Calculate Ho Rha Hai:

| File | Kya karta hai |
|------|--------------|
| `envConfig.js` | Sab rates, thresholds, fees, peak hours, weather config — sab `.env` se padhta hai. Kuch bhi hardcode nahi. |
| `rideCalculator.js` | Pure math: peak detect karna (time + demand + weather), surge calculate karna, fare formula, waiting charges, cancellation, etc. |
| `weatherService.js` | OpenWeatherMap API se real-time weather fetch karta hai, 15 min cache rakhta hai, rain/storm detect karta hai. |
| `ride.repository.js` | Database se real data laata hai — last 10 min ki ride requests, per-minute velocity, nearby drivers, driver ki aaj ki rides. |
| `rideService.js` | Sab combine karta hai — DB se demand signals laao, weather signal laao, calculator ko bhejo, fare nikalo, ride create karo, completion pe final fare nikalo. |
| `rideController.js` | HTTP request handle karta hai, body se data uthata hai, service ko call karta hai, JSON response bhejta hai. |

---

## 2. Pricing Flow — Step by Step

### 2A. ESTIMATED FARE (Jab Rider Ride Request Karta Hai ya calculate-fare API call karta hai)

```
Rider ne app pe pickup/dropoff select kiya
         |
         v
POST /api/v1/rides/calculate-fare   (estimate — booking nahi hoti)
  ya
POST /api/v1/rides/request          (actual booking — ride create hoti hai)
         |
         v
rideController.js → rideService.calculateFare() ya requestRide()
         |
         v
Step 1: Distance nikalo (Haversine formula — pickup se dropoff lat/lng)
Step 2: Duration nikalo (distance / average speed from ENV)
Step 3: PARALLEL mein 4 signals fetch karo:
         |
         ├── countRecentRideRequests()  → last 10 min mein kitni rides request hui is area mein?
         ├── getRequestVelocity()       → last 5 min mein per minute kitni requests aa rhi hain?
         ├── findNearbyDrivers()        → kitne drivers available hain radius mein?
         └── getWeatherSignal()         → OpenWeatherMap se current weather (Rain? Storm? Clear?)
         |
         v
Step 4: Peak Detect karo (TIME + DEMAND + WEATHER combined):
         |
         ├── Time Peak: Kya abhi 8-10 AM ya 6-9 PM hai?
         ├── Demand Peak: Kya requests >= 5 (volume guard) AND ratio >= 1.2?
         ├── Weather Peak: Kya Rain/Thunderstorm/Snow chal rha hai?
         └── Combined: isPeak = TimePeak OR DemandPeak OR WeatherPeak
         |
         v
Step 5: Surge calculate karo:
         |
         ├── Demand Surge: volume guard + ratio based (1.0x - 1.75x)
         ├── Weather Surge: Rain = 1.1x, Thunderstorm = 1.25x
         ├── Final Surge = max(demandSurge, weatherSurge) — higher wala use hota hai
         └── Cap: 1.75x maximum ALWAYS
         |
         v
Step 6: ESTIMATED FARE FORMULA:
         |
         Estimated Fare = max(
             (BaseFare + DistanceFare + ConvenienceFee) x Surge,
             MinimumFare
         )
         |
         v
Step 7: (sirf /request pe) Ride DB mein save karo (surge_multiplier lock hota hai)
Step 8: Response bhejo — passenger ko fare breakdown + driver ko earnings breakdown
```

### 2B. FINAL FARE (Jab Ride Complete Hoti Hai)

```
Driver ne "Complete Ride" dabaya
         |
         v
PATCH /api/v1/rides/:rideId/status  { status: "completed" }
         |
         v
rideService.updateRideStatus()
         |
         v
Step 1: Ride ka data DB se laao (timestamps include)
Step 2: ACTUAL values calculate karo:
         |
         ├── waitedMinutes = started_at - driver_arrived_at  (real waiting)
         └── actualDuration = completed_at - started_at      (real ride time)
         |
         v
Step 3: LOCKED surge use karo (request time wala, recalculate NAHI karte)
         |
         v
Step 4: FINAL FARE FORMULA:
         |
         Final Fare = max(
             (BaseFare + DistanceFare + WaitingCharges + ConvenienceFee) x LockedSurge,
             MinimumFare
         )
         |
         v
Step 5: Driver earnings calculate karo:
         |
         Driver Net = FinalFare - PlatformFee + PickupCompensation + WaitingEarnings + TrafficCompensation
         |
         v
Step 6: DB mein actual_fare aur final_fare update karo
Step 7: Driver ki total_rides aur total_earnings update karo
```

---

## 3. Peak Detection — Kaise Decide Hota Hai Peak Hai Ya Nahi

### 4 Layers:

#### Layer 1: Time-based Peak
```
Morning Peak: 8 AM - 10 AM   (ENV se configurable)
Evening Peak: 6 PM - 9 PM    (ENV se configurable)

Agar current time in windows mein hai → isTimePeak = true
```

#### Layer 2: Demand-based Peak (with Volume Guard)
```
Step 1: rideRequests >= MIN_DEMAND_REQUESTS (default 5)?
        Agar NAHI → demand peak = false, CHAHE ratio kitna bhi ho

Step 2: Agar HAA → check:
        - demandSupplyRatio >= 1.2?  (rideRequests / availableDrivers)
        - requestVelocity >= 18?     (requests per minute)
        Agar koi bhi true → isDemandPeak = true
```

**Kyun Volume Guard Zaroori Hai:**
```
Bina volume guard:  2 requests / 1 driver = ratio 2.0 → PEAK (galat!)
With volume guard:  2 requests / 1 driver = volume 2 < 5 → NOT PEAK (sahi!)
                    20 requests / 10 drivers = ratio 2.0, volume 20 >= 5 → PEAK (sahi!)
```

#### Layer 3: Weather-based Peak (Real-time API)
```
OpenWeatherMap API se current weather fetch hota hai pickup location ka.

Weather Peak conditions (ENV se configurable):
  - Rain, Drizzle          → Mild weather peak (surge 1.1x)
  - Thunderstorm, Snow     → Severe weather peak (surge 1.25x)
  - Squall, Tornado        → Severe weather peak (surge 1.25x)
  - Clear, Clouds, Mist    → No weather peak

Response 15 min cached rehta hai (~11km area ke liye) — har request pe API nahi call hoti.
Agar API key nahi hai ya API down hai → weather silently skip hota hai, koi error nahi.
```

#### Layer 4: Combined Decision
```
isPeak = isTimePeak OR isDemandPeak OR isWeatherPeak

Peak Reasons (can combine):
- "peak_hour"                         → sirf time peak
- "high_demand"                       → sirf demand peak
- "bad_weather"                       → sirf weather peak
- "peak_hour_and_high_demand"         → time + demand
- "peak_hour_and_bad_weather"         → time + weather
- "high_demand_and_bad_weather"       → demand + weather
- "peak_hour_and_high_demand_and_bad_weather" → teeno peak
- "normal_load"                       → kuch nahi
```

#### Peak Ka Effect:
| Signal | Surge Badhta Hai? | Convenience Fee Badhti Hai? |
|--------|-------------------|---------------------------|
| Sirf Time Peak | NAHI | HAA (peak band use hota hai) |
| Sirf Demand Peak | HAA (demand surge) | HAA |
| Sirf Weather Peak | HAA (weather surge 1.1x/1.25x) | HAA |
| Demand + Weather | HAA (higher of both) | HAA |
| No Peak | NAHI | NAHI (non-peak band) |

---

## 4. Surge Algorithm — Detail

### Demand Surge:
```
demandSupplyRatio = rideRequests / availableDrivers

Volume Guard: agar rideRequests < 5 → demand surge = 1.0x

Agar volume sufficient hai:
  ratio <= 1.1  →  surge = 1.0x  (no surge)
  ratio 1.1-1.3 →  surge = 1.1x - 1.2x  (linear increase)
  ratio > 1.3   →  surge = 1.2x + progressive increase
  MAXIMUM CAP   →  1.75x (kabhi bhi isse zyada nahi hoga)
```

### Weather Surge:
```
Clear/Clouds    → 1.0x  (no weather surge)
Rain/Drizzle    → 1.1x  (mild, ENV: WEATHER_SURGE_MILD)
Thunderstorm    → 1.25x (severe, ENV: WEATHER_SURGE_SEVERE)
Snow/Squall     → 1.25x (severe)
```

### Final Surge = max(demandSurge, weatherSurge)
Dono stack NAHI hote — jo zyada hai woh apply hota hai. Cap 1.75x.

**Examples:**
| Scenario | Demand Surge | Weather Surge | Final Surge |
|----------|-------------|---------------|-------------|
| Normal day, 2 req/1 drv | 1.0x (low volume) | 1.0x (clear) | **1.0x** |
| Rain, low demand | 1.0x | 1.1x | **1.1x** (weather wins) |
| Thunderstorm, low demand | 1.0x | 1.25x | **1.25x** (weather wins) |
| High demand, clear | 1.43x | 1.0x | **1.43x** (demand wins) |
| High demand + rain | 1.43x | 1.1x | **1.43x** (demand already higher) |
| Low demand + thunderstorm | 1.0x | 1.25x | **1.25x** (weather wins) |
| 30 req / 10 drv + storm | 1.75x (capped) | 1.25x | **1.75x** (demand wins, capped) |

---

## 5. Fare Components — Sab Kuch Detail Mein

### 5A. Base Fare + Distance Fare (ENV se)
| Vehicle | Base Fare | Per KM | Minimum Fare |
|---------|-----------|--------|-------------|
| Bike | Rs.20 | Rs.8/km | Rs.35 |
| Auto | Rs.30 | Rs.12/km | Rs.50 |
| Car/Cab | Rs.50 | Rs.15/km | Rs.90 |

### 5B. Convenience Fee (Peak vs Non-Peak, ENV se)
| Vehicle | Non-Peak | Peak |
|---------|----------|------|
| Bike | Rs.5 | Rs.10 - Rs.12 |
| Auto | Rs.12 - Rs.15 | Rs.20 - Rs.25 |
| Car | Rs.20 - Rs.25 | Rs.30 - Rs.50 |

Peak band mein exact value demand ratio ke basis pe decide hoti hai (low ratio = min, high ratio = max).
Peak trigger hota hai agar TIME peak hai, ya DEMAND peak hai, ya WEATHER peak hai — koi bhi ek hone pe peak band use hoga.

### 5C. Waiting Charges (Final Fare Mein — actual wait se)
```
Grace Period: Pehle 3 minute FREE
Uske baad:
  Bike: Rs.1/min
  Auto: Rs.1.5/min
  Car:  Rs.2/min
```

### 5D. Traffic Delay Compensation (Driver ko milta hai)
```
Grace: Estimated time + 30 minutes tak koi charge nahi
Uske baad:
  Bike: Rs.0.5/min
  Auto: Rs.1/min
  Car:  Rs.1.5/min
```

### 5E. Pickup Distance Compensation (Driver ko milta hai)
```
2.5 km tak FREE (default search radius)
Uske baad:
  Bike: Rs.3/extra km
  Auto: Rs.5/extra km
  Car:  Rs.7/extra km
```

### 5F. Platform Fee (Driver se katta hai)
```
Bike: Rs.1/ride
Auto: Rs.1.5/ride
Car:  Rs.5/ride
Daily Cap: Pehle 10 rides tak hi charge hota hai. 11th ride se FREE.
```

### 5G. Cancellation Penalty
```
Agar rider cancel kare jab driver 500m ke andar hai:
  Penalty: Rs.50
  Driver ko: Rs.40 (80%)
  Platform ko: Rs.10 (20%)

Agar driver 500m se zyada dur hai: No penalty
```

---

## 6. Passenger Ko Kya Dikhta Hai vs Driver Ko Kya Dikhta Hai

### PASSENGER dekhta hai (Ride Request pe):
```json
{
  "estimatedFare": 187,           ← "Aapki ride ka estimated fare"
  "baseFare": 30,                 ← "Base charge"
  "distanceFare": 120,            ← "10 km x Rs.12/km"
  "convenienceFee": 20,           ← "Platform convenience fee"
  "surgeMultiplier": 1.1,         ← "Barish hai, thoda surge"
  "waitingCharges": 0,            ← estimate pe 0, final mein actual
  "isPeak": true,                 ← "Peak chal rha hai"
  "peakReason": "peak_hour_and_bad_weather"
}
```

### DRIVER dekhta hai (Ride Accept pe):
```json
{
  "grossFare": 187,               ← "Ride ka total fare"
  "platformFee": 1.5,             ← "Platform fee katega"
  "pickupDistanceCompensation": 0,← "Extra pickup compensation" (agar dur se aaya)
  "waitingEarnings": 0,           ← "Waiting ke paise" (final mein actual)
  "trafficDelayCompensation": 0,  ← "Traffic delay ke paise" (final mein actual)
  "netEarnings": 185.5,           ← "Aapki kamai: Rs.185.5"
  "dailyRideCount": 3,            ← "Aaj ki 3rd ride"
  "platformFeeCapRide": 10        ← "10 rides ke baad platform fee free"
}
```

### SIGNALS mein yeh dikhta hai (debug/admin ke liye):
```json
{
  "demandSupplyRatio": 0.3,
  "requestVelocity": 2,
  "surgeCap": 1.75,
  "demandSurge": 1.0,
  "weatherSurge": 1.1,
  "appliedSurge": 1.1,
  "isPeak": true,
  "peakReason": "peak_hour_and_bad_weather",
  "isTimePeak": true,
  "timeWindow": "morning_peak",
  "isDemandPeak": false,
  "isWeatherPeak": true,
  "weatherCondition": "Rain",
  "weatherSeverity": "mild"
}
```

### COMPLETION pe (Final Fare):

**PASSENGER ko dikhta hai:**
```
"Aapka final fare: Rs.165"
  - Base: Rs.30
  - Distance: Rs.120
  - Waiting (2 min charged): Rs.3
  - Convenience: Rs.12
  - Surge: 1.0x
```

**DRIVER ko dikhta hai:**
```
"Aapki kamai: Rs.166.5"
  - Ride fare: Rs.165
  - Platform fee: -Rs.1.5
  - Waiting earnings: +Rs.3
  - Traffic compensation: Rs.0
  - Pickup compensation: Rs.0
```

---

## 7. TEST CASES — Real Numbers

### TEST CASE 1: Normal Auto Ride — Peak Hour, Low Demand, No Rain

**Scenario:**
- Vehicle: Auto
- Distance: 10 km, Duration: ~24 min
- Time: 9 AM (morning peak)
- Weather: Clear (no weather peak)
- Area mein: 3 ride requests, 10 drivers available
- Pickup distance: 1.5 km
- Driver ki aaj ki 3rd ride

**ESTIMATED FARE (ride request pe):**
```
Peak Detection:
  - Time Peak: YES (9 AM = morning peak)
  - Demand Peak: NO (3 requests < 5 minimum volume)
  - Weather Peak: NO (Clear sky)
  - Combined: isPeak = YES (reason: "peak_hour")
  - Demand Surge: 1.0x (low volume)
  - Weather Surge: 1.0x (clear)
  - Applied Surge: 1.0x

Calculation:
  BaseFare     = Rs.30
  DistanceFare = 10 km x Rs.12 = Rs.120
  ConvFee      = Rs.20 (peak band, but min value kyunki low ratio)
  Surge        = 1.0x

  EstimatedFare = (30 + 120 + 20) x 1.0 = Rs.170
```

| | Passenger Dekhta Hai | Driver Dekhta Hai |
|---|---|---|
| Fare | Rs.170 (estimated) | Rs.170 (gross) |
| Surge | 1.0x (no surge) | — |
| Convenience | Rs.20 | — |
| Platform Fee | — | -Rs.1.5 |
| Pickup Comp | — | Rs.0 (1.5km < 2.5km free) |
| **Net** | **Rs.170 pay karega** | **Rs.168.5 milega** |

**FINAL FARE (ride complete pe):**
- Rider ne 5 min wait karaya (3 min grace, 2 min charged)
- Ride 30 min mein complete hui (no traffic delay)

```
  WaitingCharges = 2 min x Rs.1.5 = Rs.3
  ConvFee        = Rs.12 (non-peak band, kyunki surge was 1.0)

  FinalFare = (30 + 120 + 3 + 12) x 1.0 = Rs.165
```

| | Passenger Final | Driver Final |
|---|---|---|
| Fare | Rs.165 | Rs.165 (gross) |
| Waiting | Rs.3 charged | Rs.3 earned |
| Platform Fee | — | -Rs.1.5 |
| **Net** | **Rs.165 pay karega** | **Rs.166.5 milega** |

---

### TEST CASE 2: Bike Ride — Peak Hour + High Demand + Rain (Surge Active)

**Scenario:**
- Vehicle: Bike
- Distance: 5 km, Duration: ~10 min
- Time: 9 AM (morning peak)
- Weather: Rain (mild weather peak, surge 1.1x)
- Area mein: 20 ride requests, 10 drivers available, velocity 25 req/min
- Pickup distance: 4 km (driver dur se aa rha)
- Driver ki aaj ki 8th ride

**ESTIMATED FARE (ride request pe):**
```
Peak Detection:
  - Time Peak: YES (9 AM)
  - Demand Peak: YES (20 requests >= 5, ratio 2.0 >= 1.2, velocity 25 >= 18)
  - Weather Peak: YES (Rain = mild)
  - Combined: isPeak = YES (reason: "peak_hour_and_high_demand_and_bad_weather")
  - Demand Surge: 1.48x (ratio 2.0 → progressive formula)
  - Weather Surge: 1.1x (rain = mild)
  - Applied Surge: 1.48x (demand wins — max of 1.48 vs 1.1)

Calculation:
  BaseFare     = Rs.20
  DistanceFare = 5 km x Rs.8 = Rs.40
  ConvFee      = Rs.11.33 (peak band Rs.10-12, scaled by ratio)
  Surge        = 1.48x

  EstimatedFare = (20 + 40 + 11.33) x 1.48 = Rs.106 (rounded)
```

| | Passenger Dekhta Hai | Driver Dekhta Hai |
|---|---|---|
| Fare | Rs.106 (estimated) | Rs.106 (gross) |
| Surge | 1.48x | — |
| Convenience | Rs.11.33 | — |
| Platform Fee | — | -Rs.1 |
| Pickup Comp | — | +Rs.4.50 (4km - 2.5km = 1.5km x Rs.3) |
| **Net** | **Rs.106 pay karega** | **Rs.109.5 milega** |

**FINAL FARE (ride complete pe):**
- Rider ne 8 min wait karaya (3 min grace, 5 min charged)
- Ride 15 min mein complete hui
- Surge locked at 1.28x from request time

```
  WaitingCharges = 5 min x Rs.1 = Rs.5
  ConvFee        = Rs.10.37 (peak band, scaled)

  FinalFare = (20 + 40 + 5 + 10.37) x 1.28 = Rs.96 (rounded)
```

| | Passenger Final | Driver Final |
|---|---|---|
| Fare | Rs.96 | Rs.96 (gross) |
| Waiting | Rs.5 charged | Rs.5 earned |
| Platform Fee | — | -Rs.1 |
| Pickup Comp | — | +Rs.4.50 |
| **Net** | **Rs.96 pay karega** | **Rs.104.5 milega** |

---

### TEST CASE 3: Car Ride — Thunderstorm + Low Demand (Weather Surge Wins)

**Scenario:**
- Vehicle: Car/Cab
- Distance: 15 km, Duration: ~26 min
- Time: 2 PM (off-peak hours)
- Weather: Thunderstorm (severe weather peak, surge 1.25x)
- Area mein: 4 ride requests, 8 drivers (low demand, volume < 5)
- Pickup distance: 2 km
- Driver ki aaj ki 6th ride

**ESTIMATED FARE (ride request pe):**
```
Peak Detection:
  - Time Peak: NO (2 PM = off-peak)
  - Demand Peak: NO (4 requests < 5 minimum volume)
  - Weather Peak: YES (Thunderstorm = severe)
  - Combined: isPeak = YES (reason: "bad_weather")
  - Demand Surge: 1.0x (low volume, no demand surge)
  - Weather Surge: 1.25x (thunderstorm = severe)
  - Applied Surge: 1.25x (weather wins)

Calculation:
  BaseFare     = Rs.50
  DistanceFare = 15 km x Rs.15 = Rs.225
  ConvFee      = Rs.30 (peak band Rs.30-50, min value kyunki low ratio)
  Surge        = 1.25x

  EstimatedFare = (50 + 225 + 30) x 1.25 = Rs.381 (rounded)
```

| | Passenger Dekhta Hai | Driver Dekhta Hai |
|---|---|---|
| Fare | Rs.381 (estimated) | Rs.381 (gross) |
| Surge | 1.25x (thunderstorm) | — |
| Weather | Thunderstorm | — |
| Convenience | Rs.30 | — |
| Platform Fee | — | -Rs.5 |
| Pickup Comp | — | Rs.0 (2km < 2.5km free) |
| **Net** | **Rs.381 pay karega** | **Rs.376 milega** |

**Yeh case important hai:** Off-peak hour hai, demand bhi low hai, lekin SIRF thunderstorm ki wajah se 1.25x surge lag rha hai. Bina weather detection ke fare Rs.305 hota (no surge). Weather ne Rs.76 extra add kiya.

---

### TEST CASE 4: Car Ride — Peak Hour + Extreme Demand + Traffic Jam

**Scenario:**
- Vehicle: Car/Cab
- Distance: 25 km, Duration: ~43 min estimated
- Time: 9 AM (morning peak)
- Weather: Clear
- Area mein: 30 ride requests, 10 drivers available, velocity 30 req/min
- Pickup distance: 5 km (driver bahut dur se aa rha)
- Driver ki aaj ki 12th ride (platform fee cap already reached!)
- Actual ride duration: 90 min (MASSIVE traffic jam)
- Rider ne 2 min wait karaya (grace mein, koi charge nahi)

**ESTIMATED FARE (ride request pe):**
```
Peak Detection:
  - Time Peak: YES (9 AM)
  - Demand Peak: YES (30 req >= 5, ratio 3.0, velocity 30)
  - Weather Peak: NO (Clear)
  - Combined: "peak_hour_and_high_demand"
  - Demand Surge: 1.75x (MAX CAP hit)
  - Weather Surge: 1.0x
  - Applied Surge: 1.75x

Calculation:
  BaseFare     = Rs.50
  DistanceFare = 25 km x Rs.15 = Rs.375
  ConvFee      = Rs.50 (peak band max Rs.30-50, full max at high ratio)
  Surge        = 1.75x

  EstimatedFare = (50 + 375 + 50) x 1.75 = Rs.831 (rounded)
```

| | Passenger Dekhta Hai | Driver Dekhta Hai |
|---|---|---|
| Fare | Rs.831 (estimated) | Rs.831 (gross) |
| Surge | 1.75x (MAX) | — |
| Convenience | Rs.50 | — |
| Platform Fee | — | Rs.0 (12th ride > 10 cap, FREE!) |
| Pickup Comp | — | +Rs.17.50 (5km - 2.5km = 2.5km x Rs.7) |
| **Net** | **Rs.831 pay karega** | **Rs.848.5 milega** |

**FINAL FARE (ride complete pe):**
- 2 min wait (grace mein, 0 charge)
- 90 min actual duration (estimated 43 + 30 grace = 73 min tak free, 17 min traffic overage)
- Surge locked at 1.75x

```
  WaitingCharges   = 0 (2 min < 3 min grace)
  ConvFee          = Rs.40 (peak band scaled)
  TrafficOverage   = 90 - (43+30) = 17 min overage
  TrafficComp      = 17 x Rs.1.5 = Rs.25.5 (DRIVER ko milega)

  FinalFare = (50 + 375 + 0 + 40) x 1.75 = Rs.814 (rounded)

  Driver Net = 814 - 0(no platform fee) + 17.5(pickup) + 0(waiting) + 25.5(traffic) = Rs.857
```

| | Passenger Final | Driver Final |
|---|---|---|
| Fare | Rs.814 | Rs.814 (gross) |
| Waiting | Rs.0 (grace mein) | Rs.0 |
| Platform Fee | — | Rs.0 (cap reached) |
| Pickup Comp | — | +Rs.17.50 |
| Traffic Comp | — | +Rs.25.50 (17 min extra) |
| **Net** | **Rs.814 pay karega** | **Rs.857 milega** |

**Important:** Traffic delay compensation SIRF driver ko milta hai. Passenger ka fare traffic se nahi badhta (unfair hoga rider ke liye). Driver ko yeh extra platform deta hai as protection.

---

## 8. Cancellation Scenario

### Case A: Driver 300m dur hai, rider cancel karta hai
```
300m <= 500m threshold → Penalty lagega
  Rider se: Rs.50 kata jayega
  Driver ko: Rs.40 milega (80%)
  Platform ko: Rs.10 milega (20%)
```

### Case B: Driver 700m dur hai, rider cancel karta hai
```
700m > 500m threshold → No penalty
  Rider se: Rs.0
  Driver ko: Rs.0
  Free cancellation
```

---

## 9. Platform Fee Daily Cap — Example

| Ride # | Platform Fee | Driver Actually Pays |
|--------|-------------|---------------------|
| 1st | Rs.1.5 (auto) | Rs.1.5 |
| 5th | Rs.1.5 | Rs.1.5 |
| 10th | Rs.1.5 | Rs.1.5 (last charged ride) |
| 11th | Rs.0 | Rs.0 (FREE! cap reached) |
| 15th | Rs.0 | Rs.0 (FREE!) |
| 20th | Rs.0 | Rs.0 (FREE all day!) |

Driver jitni zyada rides karega, utna fayda — 10 ke baad no commission!

---

## 10. Weather Service — Kaise Kaam Karta Hai

### Architecture:
```
Fare request aaya (pickup lat/lng ke saath)
         |
         v
weatherService.getWeatherSignal(lat, lng)
         |
         ├── Cache check (15 min, ~11km area)
         │   ├── Cache HIT → cached data return (no API call)
         │   └── Cache MISS → OpenWeatherMap API call
         │                            |
         │                            v
         │              https://api.openweathermap.org/data/2.5/weather
         │                            |
         │                            v
         │              Response: { weather: [{ main: "Rain" }], temp, humidity }
         │                            |
         │                            v
         │              Cache mein save karo (15 min ke liye)
         |
         v
Return: { isWeatherPeak: true, weatherCondition: "Rain", severity: "mild", weatherSurge: 1.1 }
```

### Weather Conditions → Surge Mapping:
| Weather | Peak? | Severity | Surge |
|---------|-------|----------|-------|
| Clear | NO | none | 1.0x |
| Clouds | NO | none | 1.0x |
| Mist/Haze/Fog | NO | none | 1.0x |
| Drizzle | YES | mild | 1.1x |
| Rain | YES | mild | 1.1x |
| Thunderstorm | YES | severe | 1.25x |
| Snow | YES | severe | 1.25x |
| Squall | YES | severe | 1.25x |
| Tornado | YES | severe | 1.25x |

### Failsafe:
- API key nahi hai → weather skip, no error
- API down hai → weather skip, no error, log warning
- Cache expired → fresh API call
- Sab conditions ENV se configurable

---

## 11. Key Business Rules — Summary

| Rule | Detail |
|------|--------|
| Surge tab hi lagta hai | Jab REAL demand sufficient ho (>= 5 requests) AND ratio high ho, YA weather kharab ho |
| 2 request / 1 driver = no surge | Volume guard prevent karta hai false surge |
| Time peak = higher convenience fee | But NO surge. Peak hours mein convenience fee peak band se aati hai |
| Weather peak = surge + peak fee | Rain 1.1x, Thunderstorm 1.25x. Convenience fee bhi peak band se |
| Demand + Weather stack nahi hote | max(demandSurge, weatherSurge) — jo zyada woh apply |
| Surge LOCK hota hai | Request time pe jo surge tha, wahi final fare mein use hoga. Ride ke beech mein change nahi hota |
| Waiting 3 min free | Driver arrive hone ke baad 3 min grace, uske baad per min charge |
| Traffic 30 min grace | Estimated + 30 min tak koi extra charge nahi |
| Traffic comp sirf driver ko | Passenger ka fare traffic se nahi badhta, driver ko platform compensate karta hai |
| Platform fee cap 10 rides | Pehle 10 rides tak fee lagti hai, uske baad free |
| Minimum fare always apply | Chahe distance kitna bhi kam ho, minimum fare se neeche nahi jayega |
| Sab ENV se configurable | Koi bhi value .env file se change kar sakte ho bina code change kiye |

---

## 12. ENV Variables — Quick Reference

```env
# Vehicle Pricing
BIKE_BASE_FARE=20          AUTO_BASE_FARE=30          CAR_BASE_FARE=50
BIKE_PER_KM=8              AUTO_PER_KM=12             CAR_PER_KM=15
BIKE_MINIMUM_FARE=35       AUTO_MINIMUM_FARE=50       CAR_MINIMUM_FARE=90

# Surge
SURGE_MAX_MULTIPLIER=1.75
PEAK_RATIO_THRESHOLD=1.2
PEAK_VELOCITY_THRESHOLD=18
MIN_DEMAND_REQUESTS=5
DEMAND_WINDOW_MINUTES=10
VELOCITY_WINDOW_MINUTES=5

# Peak Hours
PEAK_HOURS_MORNING_START=8    PEAK_HOURS_MORNING_END=10
PEAK_HOURS_EVENING_START=18   PEAK_HOURS_EVENING_END=21

# Weather (Plug & Play — sirf API key set karo)
OPENWEATHER_API_KEY=your_key_here
WEATHER_CACHE_MINUTES=15
WEATHER_PEAK_CONDITIONS=Rain,Drizzle,Thunderstorm,Snow,Squall,Tornado
WEATHER_SEVERE_CONDITIONS=Thunderstorm,Snow,Squall,Tornado
WEATHER_SURGE_MILD=1.1
WEATHER_SURGE_SEVERE=1.25

# Platform Fee
PLATFORM_FEE_BIKE=1    PLATFORM_FEE_AUTO=1.5    PLATFORM_FEE_CAR=5
PLATFORM_FEE_DAILY_CAP=10

# Waiting
WAITING_GRACE_MINUTES=3
WAITING_RATE_BIKE=1    WAITING_RATE_AUTO=1.5    WAITING_RATE_CAR=2

# Traffic Delay
TRAFFIC_GRACE_BUFFER_MINUTES=30
TRAFFIC_RATE_BIKE=0.5    TRAFFIC_RATE_AUTO=1    TRAFFIC_RATE_CAR=1.5

# Pickup Compensation
PICKUP_BASE_RADIUS_KM=2.5
PICKUP_COMP_BIKE=3    PICKUP_COMP_AUTO=5    PICKUP_COMP_CAR=7

# Convenience Fee (peak/non-peak bands per vehicle)
CONV_FEE_BIKE_NONPEAK_MIN=5     CONV_FEE_BIKE_NONPEAK_MAX=5
CONV_FEE_BIKE_PEAK_MIN=10       CONV_FEE_BIKE_PEAK_MAX=12
CONV_FEE_AUTO_NONPEAK_MIN=12    CONV_FEE_AUTO_NONPEAK_MAX=15
CONV_FEE_AUTO_PEAK_MIN=20       CONV_FEE_AUTO_PEAK_MAX=25
CONV_FEE_CAR_NONPEAK_MIN=20     CONV_FEE_CAR_NONPEAK_MAX=25
CONV_FEE_CAR_PEAK_MIN=30        CONV_FEE_CAR_PEAK_MAX=50

# Cancellation
CANCELLATION_PENALTY=50
CANCELLATION_DISTANCE_THRESHOLD=500
CANCELLATION_DRIVER_SHARE_PERCENT=80
CANCELLATION_PLATFORM_SHARE_PERCENT=20

# Speed (for duration estimation)
SPEED_BIKE=30    SPEED_AUTO=25    SPEED_CAR=35
```

Koi bhi value change karo `.env` mein — code touch karne ki zaroorat nahi. Server restart pe naye rates apply ho jayenge.

---

## 13. API Endpoints — Pricing Related

| Method | Endpoint | Kya Karta Hai | Request Body |
|--------|----------|--------------|-------------|
| POST | `/api/v1/rides/calculate-fare` | Fare estimate (booking nahi hoti) | `{ vehicleType, pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude }` |
| POST | `/api/v1/rides/request` | Ride book karo + estimated fare | Same as above + `pickupAddress, dropoffAddress, paymentMethod` |
| PATCH | `/api/v1/rides/:rideId/status` | Status update — "completed" pe final fare | `{ status: "completed" }` |
| GET | `/api/v1/rides/:rideId` | Ride details — estimated + final fare | — |

`calculate-fare` aur `request` — dono **same formula, same flow** use karte hain. Bas `calculate-fare` sirf dikhata hai, `request` DB mein ride bhi create karta hai.

---

## NOTE: Weather API Integration — Kahan Set Karna Hai

Weather feature **Plug & Play** hai. Activate karne ke liye:

**Step 1:** OpenWeatherMap pe free account banao: https://openweathermap.org/api
- Sign up karo
- "Current Weather Data" free tier select karo (1000 calls/day free)
- API Keys section se apni key copy karo

**Step 2:** `.env` file mein yeh ek line add karo:
```env
OPENWEATHER_API_KEY=your_actual_api_key_here
```

**Step 3:** Server restart karo. Bas. Weather detection auto-activate ho jayega.

**Agar key nahi doge** → weather feature silently disabled rehta hai, koi error nahi aayega, baaki sab normal chalega (time + demand based peak detection kaam karti rehti hai).

**File jahan weather API integrated hai:**
```
src/core/utils/weatherService.js     ← API call + cache logic
src/modules/rides/services/rideService.js  ← gatherDemandSignals() mein parallel call
src/core/utils/rideCalculator.js     ← detectPeak() + calculateEstimatedFare() mein weather signal use
src/config/envConfig.js              ← OPENWEATHER_API_KEY + weather thresholds
```

---

*Last Updated: March 2026*
*Algorithm Version: v3.0 — Dynamic Peak Detection (Time + Demand + Weather) + Volume Guard + Locked Surge + Real-time Weather API*
