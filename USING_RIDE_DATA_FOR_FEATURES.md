# 💡 Using Ride Data for Smart Features

## Overview
Complete guide on leveraging `rides`, `ride_otps`, and location data for notifications, tracking, and engagement.

---

## 1. 📍 Real-Time Driver Location Features

### Feature: Live Map Tracking
**Use:** `driver_current_latitude` and `driver_current_longitude` from rides table

```javascript
// Every 2-3 seconds, emit driver location to passenger
const updatePassengerMap = async (rideId) => {
  const ride = await findRideById(rideId);
  
  io.to(`ride:${rideId}`).emit('driver_location_update', {
    driverLat: ride.driver_current_latitude,
    driverLng: ride.driver_current_longitude,
    pickupLat: ride.pickup_latitude,
    pickupLng: ride.pickup_longitude,
    dropoffLat: ride.dropoff_latitude,
    dropoffLng: ride.dropoff_longitude,
  });
};
```

### Feature: Distance-Based Notifications
**Use:** Calculate distance from driver to passenger

```javascript
import geolib from 'geolib';

const sendLocationNotifications = async (rideId) => {
  const ride = await findRideById(rideId);
  
  const distance = geolib.getDistance(
    { latitude: ride.driver_current_latitude, longitude: ride.driver_current_longitude },
    { latitude: ride.pickup_latitude, longitude: ride.pickup_longitude }
  );
  
  const distanceKm = distance / 1000;
  
  // Send different notifications based on distance
  if (distanceKm < 0.1) {
    await sendNotification(ride.passenger_fcm_token,
      "🚗 Driver Arrived!",
      `${ride.driver_name} is here. Look for ${ride.vehicle_number}`
    );
  } else if (distanceKm < 0.5) {
    await sendNotification(ride.passenger_fcm_token,
      "📍 Driver is Close",
      `${distanceKm.toFixed(2)} km away - About ${Math.ceil(distanceKm * 2)} minutes`
    );
  } else if (distanceKm < 1) {
    await sendNotification(ride.passenger_fcm_token,
      "🚕 Driver on the Way",
      `${distanceKm.toFixed(2)} km away`
    );
  }
};
```

### Feature: ETA Calculation
**Use:** Distance + vehicle speed to calculate ETA

```javascript
const calculateETA = (driverLat, driverLng, pickupLat, pickupLng, vehicleType) => {
  const distance = geolib.getDistance(
    { latitude: driverLat, longitude: driverLng },
    { latitude: pickupLat, longitude: pickupLng }
  ) / 1000; // Convert to km
  
  // Different speeds for different vehicle types
  const speeds = {
    bike: 30,    // km/h
    auto: 25,
    car: 35,
    xl: 32,
    premium: 35,
    luxury: 40
  };
  
  const speed = speeds[vehicleType] || 30;
  const minutes = Math.ceil((distance / speed) * 60);
  
  return {
    distance,
    estimatedMinutes: minutes
  };
};
```

---

## 2. 🔐 OTP Integration Features

### Feature: Smart OTP Notifications
**Use:** ride_otps table to track OTP status

```javascript
export const handleOTPFlow = async (rideId) => {
  // 1. Generate OTP when driver arrives
  const otpResult = await generateRideOTP(rideId, passengerPhone);
  
  // 2. Notify passenger immediately
  await sendNotification(passengerFcmToken,
    "🔐 Share OTP with Driver",
    `Your OTP: ${otpResult.otpCode}. Valid for 10 minutes.`
  );
  
  // 3. Start OTP expiry warning (8 minutes after generation)
  setTimeout(async () => {
    const otp = await findLatestOtp(rideId);
    if (otp && !otp.is_verified) {
      await sendNotification(passengerFcmToken,
        "⏰ OTP Expiring Soon",
        "OTP will expire in 2 minutes"
      );
    }
  }, 8 * 60 * 1000);
  
  // 4. Notify if OTP expires without verification
  setTimeout(async () => {
    const otp = await findLatestOtp(rideId);
    if (otp && !otp.is_verified) {
      await sendNotification(passengerFcmToken,
        "❌ OTP Expired",
        "Request a new OTP to start the ride"
      );
    }
  }, 10 * 60 * 1000);
};
```

### Feature: OTP Attempt Tracking
**Use:** ride_otps.attempts to track failed attempts

```javascript
const handleOTPAttempt = async (rideId, enteredOtp) => {
  const result = await verifyRideOTP(rideId, enteredOtp);
  
  if (!result.verified) {
    const otp = await findLatestOtp(rideId);
    
    if (otp.attempts >= otp.max_attempts - 1) {
      // Last attempt
      await sendNotification(driverFcmToken,
        "⚠️ Last OTP Attempt",
        "One more wrong attempt and OTP will be invalid"
      );
    }
    
    if (otp.attempts >= otp.max_attempts) {
      // Max attempts exceeded
      await sendNotification(passengerFcmToken,
        "❌ OTP Attempts Exceeded",
        "Request a new OTP"
      );
      
      // Auto-cancel ride if OTP fails
      await cancelRide(rideId, 'system', 'OTP verification failed');
    }
  }
};
```

---

## 3. 🎯 Engagement Notifications with Location

### Feature: Smart Engagement Based on Location
**Combine:** Location data + Engagement notifications

```javascript
const sendSmartEngagementNotifications = async () => {
  // Get all drivers with active rides
  const activeRides = await db.query(
    `SELECT r.*, d.user_id, u.fcm_token 
     FROM rides r 
     JOIN drivers d ON r.driver_id = d.id
     JOIN users u ON d.user_id = u.id
     WHERE r.status = 'in_progress'`
  );
  
  for (const ride of activeRides) {
    // Calculate distance to destination
    const toDestination = geolib.getDistance(
      { latitude: ride.driver_current_latitude, longitude: ride.driver_current_longitude },
      { latitude: ride.dropoff_latitude, longitude: ride.dropoff_longitude }
    ) / 1000;
    
    // Smart notification based on ride progress
    if (toDestination < 2) {
      // Near destination
      await sendNotification(ride.fcm_token,
        "🏁 Almost There!",
        `${Math.ceil(toDestination)}km to destination. Great job! 👏`
      );
    } else if (toDestination > 10) {
      // Long ride - engagement message
      await sendNotification(ride.fcm_token,
        "💪 Keep Going!",
        "You're doing great! 👍"
      );
    }
  }
};
```

### Feature: Passenger Engagement During Wait
**Use:** pickup location + current time

```javascript
const sendPassengerWaitingNotifications = async () => {
  // Get all waiting passengers
  const waitingPassengers = await db.query(
    `SELECT r.*, u.fcm_token, d.user_id as driver_id
     FROM rides r
     JOIN users u ON r.passenger_id = u.id
     JOIN drivers d ON r.driver_id = d.id
     WHERE r.status = 'driver_arrived' 
     AND r.driver_arrived_at < NOW() - INTERVAL '2 minutes'`
  );
  
  for (const ride of waitingPassengers) {
    const waitMinutes = Math.floor(
      (new Date() - new Date(ride.driver_arrived_at)) / 60000
    );
    
    if (waitMinutes === 2) {
      await sendNotification(ride.fcm_token,
        "📍 Driver is Waiting",
        `${ride.driver_name} has been waiting for 2 minutes at ${ride.pickup_location_name}`
      );
    } else if (waitMinutes === 5) {
      await sendNotification(ride.fcm_token,
        "⏰ Driver Still Waiting",
        `${ride.driver_name} is waiting for you. Please hurry!`
      );
    }
  }
};
```

---

## 4. 🚗 Driver-Focused Smart Features

### Feature: Route Deviation Detection
**Use:** pickup + dropoff locations vs driver's current path

```javascript
const detectRouteDeviation = async (rideId) => {
  const ride = await findRideById(rideId);
  
  // Get direct route distance
  const directDistance = geolib.getDistance(
    { latitude: ride.pickup_latitude, longitude: ride.pickup_longitude },
    { latitude: ride.dropoff_latitude, longitude: ride.dropoff_longitude }
  ) / 1000;
  
  // Get actual distance traveled so far
  const actualDistance = ride.actual_distance_km || 0;
  
  const deviation = actualDistance - directDistance;
  
  // Alert if deviation > 20%
  if (deviation > directDistance * 0.2) {
    await sendNotification(ride.passenger_fcm_token,
      "⚠️ Route Check",
      `Driver has gone ${deviation.toFixed(1)}km off route`
    );
    
    // Log for fraud detection
    await logRouteDeviation(rideId, deviation);
  }
};
```

### Feature: Driver Performance Tracking
**Use:** Location updates + OTP data

```javascript
const trackDriverPerformance = async (rideId) => {
  const ride = await findRideById(rideId);
  const otp = await findLatestOtp(rideId);
  
  const performance = {
    onTimeArrival: ride.driver_arrived_at ? true : false,
    otpVerified: otp ? otp.is_verified : false,
    otpAttempts: otp ? otp.attempts : 0,
    routeDeviation: ride.actual_distance_km - ride.distance_km,
    completionTime: ride.completed_at ? 
      (new Date(ride.completed_at) - new Date(ride.started_at)) / 60000 : 
      null
  };
  
  return performance;
};
```

---

## 5. 📊 Analytics & Reporting

### Feature: Location Analytics
**Use:** ride_otps.verified_at + ride timestamps

```javascript
const getLocationAnalytics = async (driverId, days = 7) => {
  const { rows } = await db.query(
    `SELECT 
      COUNT(*) as total_rides,
      AVG(distance_km) as avg_distance,
      AVG(EXTRACT(EPOCH FROM (started_at - driver_arrived_at))/60) as avg_wait_time,
      COUNT(CASE WHEN payment_status = 'completed' THEN 1 END) as completed_rides,
      AVG(CASE WHEN is_peak THEN surge_multiplier ELSE 1 END) as avg_surge
     FROM rides
     WHERE driver_id = $1
     AND created_at > NOW() - INTERVAL '7 days'
     AND status != 'cancelled'`,
    [driverId]
  );
  
  return rows[0];
};
```

### Feature: OTP Reliability Report
**Use:** ride_otps table

```javascript
const getOtpReliability = async () => {
  const { rows } = await db.query(
    `SELECT 
      COUNT(*) as total_otps,
      COUNT(CASE WHEN is_verified THEN 1 END) as verified_otps,
      AVG(attempts) as avg_attempts,
      COUNT(CASE WHEN attempts > max_attempts THEN 1 END) as failed_otps,
      ROUND(100.0 * COUNT(CASE WHEN is_verified THEN 1 END) / COUNT(*), 2) as success_rate
     FROM ride_otps
     WHERE created_at > NOW() - INTERVAL '7 days'`
  );
  
  return rows[0];
};
```

---

## 6. 🔔 Notification Strategy with All Data

### Passenger Journey Notifications
```javascript
const PASSENGER_NOTIFICATIONS = {
  // Before ride starts
  'ride_requested': async (ride) => ({
    title: '🚕 Searching for Driver',
    body: `Searching in ${ride.pickup_location_name}. Estimated fare: ₹${ride.estimated_fare}`
  }),
  
  'driver_assigned': async (ride) => ({
    title: '✅ Driver Found!',
    body: `${ride.driver_name} in ${ride.vehicle_number} is on the way`
  }),
  
  'driver_near': async (ride) => {
    const distance = geolib.getDistance(
      { latitude: ride.driver_current_latitude, longitude: ride.driver_current_longitude },
      { latitude: ride.pickup_latitude, longitude: ride.pickup_longitude }
    ) / 1000;
    return {
      title: '📍 Driver Approaching',
      body: `${distance.toFixed(1)}km away`
    };
  },
  
  'driver_arrived': async (ride) => ({
    title: '🚗 Driver Arrived!',
    body: `${ride.driver_name} is waiting. Share OTP to start.`
  }),
  
  // During ride
  'ride_started': async (ride) => ({
    title: '🚀 Ride Started',
    body: `Heading to ${ride.dropoff_location_name}`
  }),
  
  // After ride ends
  'ride_completed': async (ride) => ({
    title: '✨ Ride Completed',
    body: `Trip completed! You paid ₹${ride.final_fare}`
  })
};
```

---

## 7. 🛠️ Implementation Checklist

- [ ] Location tracking real-time on maps
- [ ] Distance-based notifications (0.5km, 1km, 2km milestones)
- [ ] ETA calculation and updates
- [ ] OTP generation and tracking
- [ ] OTP expiry warnings
- [ ] Route deviation alerts
- [ ] Driver performance metrics
- [ ] Wait time tracking
- [ ] Smart engagement notifications based on location
- [ ] Analytics and reporting

---

## 📝 Summary

**Available Data for Features:**
- ✅ Driver's real-time location (updated via WebSocket)
- ✅ Pickup & dropoff locations (static)
- ✅ OTP with expiry and attempt tracking
- ✅ Ride status and timestamps
- ✅ Distance and duration data
- ✅ FCM tokens for notifications

**Use Cases Covered:**
1. Live map tracking ✅
2. Distance-based notifications ✅
3. ETA calculations ✅
4. OTP lifecycle management ✅
5. Driver performance tracking ✅
6. Route deviation detection ✅
7. Smart engagement notifications ✅
8. Analytics and reporting ✅

All data is already being captured and updated properly! 🎉
