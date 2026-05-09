# 🚕 Driver Frontend Implementation Guide

This document is a **Ready-to-Implement Guide** for Frontend Developers (React Native, Flutter, Kotlin, Swift, etc.) building the Driver App for GoMobility.

It maps exactly **Which Screen > Which Button > What API/Socket to call > What to listen for**.

---

## 🛠 Prerequisites

1. **Authentication:**
   - All REST APIs must have Header: `Authorization: Bearer <DRIVER_JWT_TOKEN>`
   - The WebSocket connection must be initialized with the token:
     ```javascript
     const socket = io("https://api.gomobility.co.in", {
         auth: { token: "<DRIVER_JWT_TOKEN>" }
     });
     ```

2. **Base URL:** `https://api.gomobility.co.in`

---

## 📱 1. Startup & Home Screen

**Scenario:** Driver opens the app.
**Action:** Establish WebSocket connection.
1. `socket.connect()`
2. **Emit:** `socket.emit('auth:login', { phone: "driver_phone" })`
3. **Listen:** `socket.on('auth:success')` 
   - *UI Update:* Show the Home Screen Map.

**Scenario:** Driver toggles duty (Online/Offline).
**UI Action:** "Go Online" / "Go Offline" Toggle Switch.
1. **REST API:** `PATCH /api/v1/drivers/duty`
   - *Body:* `{ "is_on_duty": true/false }`
2. **Socket Emit:** `socket.emit('driver:availability_toggle', { isAvailable: true/false })`

**Scenario:** Driver is Online (Waiting for rides).
**UI Action:** Background Location Service (Runs every 10-15 seconds).
1. **Socket Emit:** `socket.emit('driver:idle_location', { latitude, longitude })`
   - *Note:* Do NOT stop emitting this until the driver goes offline or accepts a ride.

---

## 🔔 2. Incoming Ride Request Screen

**Scenario:** A passenger requests a ride nearby.
**Listen:** `socket.on('ride:new_request', (data) => { ... })`
- *Data received:* `rideId`, `pickupLocation`, `dropoffLocation`, `estimatedFare`, `passengerName`.
**UI Action:** Show a ringing modal/bottom-sheet with "Accept" and "Decline" buttons.

### If Driver clicks "Decline":
1. **REST API:** `POST /api/v1/rides/:rideId/reject`
   - *Body:* `{ "reason": "Too far" }` (Optional)
2. **Socket Emit:** `socket.emit('ride:reject', { rideId, reason })`
3. *UI Update:* Close ringing modal, return to Home Screen.

### If Driver clicks "Accept" (CRITICAL FLOW):
**Fire these 3 things immediately:**
1. **Socket Emit:** `socket.emit('ride:accept', { rideId })` *(Instant UI feedback)*
2. **REST API:** `POST /api/v1/rides/:rideId/accept` 
   - *API Response contains OTP:* `{ message: "...", otp: "4821" }`. 
   - **Important:** Save this OTP in state for displaying later.
3. **Socket Emit:** `socket.emit('ride:join', { rideId })`
   - *Why?* This joins the private room with the passenger for live tracking.

**Listen:** `socket.on('ride:assignment_confirmed')`
- Confirms the backend has locked the ride to this driver.
- *UI Update:* Navigate to **"Heading to Pickup"** Screen.

---

## 🗺 3. Heading to Pickup Screen

**Scenario:** Driver is navigating to the passenger.
**UI Action:** Show Google Map routing to Pickup. Background Location Service runs.
1. **Socket Emit:** `socket.emit('driver:location_update', { rideId, latitude, longitude, speed, accuracy })`
   - *Frequency:* Every 3 to 5 seconds.
   - *Why?* Updates the passenger's screen showing the driver's car moving.

**Scenario:** Driver reaches the Pickup location.
**UI Action:** Driver clicks **"Arrived"** button.
1. **REST API:** `PATCH /api/v1/rides/:rideId/status`
   - *Body:* `{ "status": "driver_arrived" }`
2. *UI Update:* Change screen state to "Waiting for Passenger / Enter OTP".

---

## 🔐 4. Start Ride (OTP Verification) Screen

**Scenario:** Passenger sits in the car. Driver asks for the 4-digit OTP.
**UI Action:** Show 4 input boxes. Driver enters OTP and clicks **"Start Trip"**.
1. **REST API:** `POST /api/v1/rides/:rideId/verify-otp`
   - *Body:* `{ "otp": "entered_otp" }`
2. **Handling Response:**
   - If `200 OK`: Ride is successfully started. Status becomes `in_progress`.
   - If `400 Bad Request`: Show "Invalid OTP" error to driver.
3. *UI Update:* Navigate to **"In Progress (Heading to Destination)"** Screen.

---

## 🚗 5. In Progress (Driving to Destination)

**Scenario:** Driver is driving to the drop-off location.
**UI Action:** Show Google Map routing to Drop-off.
1. **Socket Emit:** `socket.emit('driver:location_update', { rideId, latitude, longitude, speed, accuracy })`
   - *Frequency:* Every 3 to 5 seconds.
   - *Why?* This allows the backend to calculate the EXACT distance driven for dynamic fare calculation.

**Listen (Optional but recommended):** `socket.on('ride:fare_update', (data) => { ... })`
- Displays the live-updating meter (fare) on the driver's screen.

---

## 🏁 6. Ride Completion

**Scenario:** Driver reaches the destination.
**UI Action:** Driver clicks **"Complete Ride"** or "End Trip" button.
1. **REST API:** `POST /api/v1/rides/:rideId/complete`
   - *Body:* `{ "final_distance": 12.5 }` (Pass distance if frontend calculates it, otherwise backend does it).
   - *Response:* Returns `finalFare`.
2. **Socket Emit:** `socket.emit('ride:leave', { rideId })`
   - *Why?* Disconnects the driver from that ride's live tracking room.
3. *UI Update:* Show Payment Summary / Fare Collection Screen.

---

## ⚠️ 7. Ride Cancellation (Exceptions)

**Scenario:** Driver wants to cancel the ride (e.g., passenger didn't show up).
**UI Action:** Click **"Cancel Ride"**, select reason.
1. **REST API:** `POST /api/v1/rides/:rideId/cancel`
   - *Body:* `{ "reason": "Passenger no-show" }`
2. **Socket Emit:** `socket.emit('ride:leave', { rideId })`
3. *UI Update:* Return to Home Screen.

---

## 🔄 8. App Restart / Network Recovery (CRITICAL)

**Scenario:** The app gets killed, phone restarts, or internet drops for 5 minutes during an active ride.
**When App Opens/Foregrounds:**
1. Re-initialize WebSocket connection.
2. **Socket Emit:** `socket.emit('auth:reconnect', { userId, userType: 'driver' })`
3. **REST API:** `GET /api/v1/rides/current`
   - *Why?* This returns the current active ride if the driver was in the middle of one.
4. **Handling Response:**
   - If API returns a ride with status `driver_assigned` -> Go to Pickup Screen.
   - If API returns status `driver_arrived` -> Go to OTP Screen.
   - If API returns status `in_progress` -> Go to Driving Screen.
5. **Socket Emit:** `socket.emit('ride:join', { rideId })` to restore live tracking.

---

### 📝 Developer Cheat Sheet (Quick Reference)

| User Action | Socket Emit | REST API Call | Socket Listen |
| :--- | :--- | :--- | :--- |
| Open App | `auth:login` | - | `auth:success` |
| Go Online | `driver:availability_toggle`| `PATCH /drivers/duty` | - |
| Idle Wait | `driver:idle_location` | - | `ride:new_request` |
| Accept Ride | `ride:accept` & `ride:join` | `POST /rides/:id/accept` | `ride:assignment_confirmed`|
| Decline Ride | `ride:reject` | `POST /rides/:id/reject` | - |
| Driving to Pickup| `driver:location_update` | - | - |
| Arrived | - | `PATCH /rides/:id/status` | - |
| Start Trip (OTP)| - | `POST /rides/:id/verify-otp`| - |
| Driving to Drop | `driver:location_update` | - | `ride:fare_update` |
| Complete Ride | `ride:leave` | `POST /rides/:id/complete` | - |
| Cancel Ride | `ride:leave` | `POST /rides/:id/cancel` | - |
| App Reconnect | `auth:reconnect` & `ride:join`| `GET /rides/current` | - |
