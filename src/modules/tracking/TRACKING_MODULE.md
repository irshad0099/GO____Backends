# 🚗 Tracking Module Documentation

## Overview
Public ride tracking system that allows anyone with a tracking token to view:
- **Live driver location** (real-time via Socket.io)
- **Ride details** (driver info, passenger, pickup/dropoff locations)
- **Route history** (where driver went, distance traveled, duration)

---

## 📊 Database Schema

### 1. Rides Table Update
```sql
ALTER TABLE rides ADD COLUMN tracking_token VARCHAR(50) UNIQUE;
ALTER TABLE rides ADD COLUMN tracking_enabled BOOLEAN DEFAULT true;
```

### 2. New Table: `ride_location_history`
```sql
CREATE TABLE ride_location_history (
  id UUID PRIMARY KEY,
  ride_id UUID REFERENCES rides(id),
  latitude DECIMAL(10,8),
  longitude DECIMAL(10,8),
  accuracy FLOAT,
  timestamp TIMESTAMP,
  created_at TIMESTAMP
);
```

---

## 🔌 API Endpoints

### Public Endpoints (No Auth Required)

#### 1. Get Live Tracking Data
```
GET /api/tracking/public/{trackingToken}

Response:
{
  "rideId": "uuid",
  "status": "started" | "completed" | "assigned",
  "trackingToken": "xyz123...",
  "driver": {
    "id": "uuid",
    "name": "John Doe",
    "phone": "+919999999999",
    "rating": 4.8,
    "vehicle": {
      "number": "MH01AB1234",
      "type": "sedan",
      "color": "white",
      "image": "url"
    }
  },
  "passenger": {
    "id": "uuid",
    "name": "Passenger Name",
    "phone": "+918888888888"
  },
  "location": {
    "pickup": { "lat": 19.0760, "lng": 72.8777 },
    "dropoff": { "lat": 19.0915, "lng": 72.8984 },
    "current": {
      "latitude": 19.0835,
      "longitude": 72.8880,
      "timestamp": "2026-05-24T10:30:45Z",
      "accuracy": 5.2
    }
  },
  "fare": {
    "estimated": 250,
    "final": 275
  },
  "route": [
    { "latitude": 19.0760, "longitude": 72.8777, "timestamp": "2026-05-24T10:20:00Z" },
    { "latitude": 19.0835, "longitude": 72.8880, "timestamp": "2026-05-24T10:30:45Z" }
  ],
  "routeStats": {
    "totalDistance": 3.45,
    "totalDuration": 12,
    "pointCount": 45,
    "startTime": "2026-05-24T10:20:00Z",
    "endTime": "2026-05-24T10:32:00Z"
  }
}
```

#### 2. Get Route History
```
GET /api/tracking/public/{trackingToken}/history

Response:
{
  "rideId": "uuid",
  "status": "completed",
  "route": [
    { "latitude": 19.0760, "longitude": 72.8777, "timestamp": "2026-05-24T10:20:00Z" },
    ...
  ],
  "stats": {
    "totalDistance": 3.45,
    "totalDuration": 12,
    "pointCount": 45,
    "startTime": "2026-05-24T10:20:00Z",
    "endTime": "2026-05-24T10:32:00Z"
  },
  "location": {
    "pickup": { "lat": 19.0760, "lng": 72.8777 },
    "dropoff": { "lat": 19.0915, "lng": 72.8984 }
  },
  "timestamps": {
    "startedAt": "2026-05-24T10:20:00Z",
    "completedAt": "2026-05-24T10:32:00Z"
  }
}
```

### Protected Endpoints (Auth Required)

#### 3. Generate Tracking Link
```
POST /api/tracking/generate

Body:
{
  "rideId": "uuid"
}

Response:
{
  "token": "abc12xyz45def",
  "trackingLink": "https://yourapp.com/track/abc12xyz45def",
  "shareableUrl": "https://yourapp.com/track/abc12xyz45def"
}
```

#### 4. Disable Tracking
```
POST /api/tracking/{trackingToken}/disable

Response:
{
  "success": true
}
```

---

## 🔄 Real-Time Updates (Socket.io)

### Broadcasting Driver Location

**From Driver (in your ride controller):**
```javascript
socket.emit('ride:location-update', {
  rideId: 'uuid',
  latitude: 19.0835,
  longitude: 72.8880,
  accuracy: 5.2
});
```

**To All Trackers (Implement in Socket.io handlers):**
```javascript
// Broadcasting to all tracking viewers
io.to(`tracking:${trackingToken}`).emit('location-update', {
  latitude: 19.0835,
  longitude: 72.8880,
  timestamp: new Date()
});
```

---

## 📱 Integration Steps

### 1. Run Migration
```bash
npm run migrate -- scripts/migrations/001_add_tracking_tables.sql
```

### 2. Generate Tracking Link When Ride is Created
```javascript
// In rideService.js, after ride creation:
import TrackingService from '../modules/tracking/services/trackingService.js';

const trackingService = new TrackingService();
const trackingData = await trackingService.generateTrackingLink(rideId);

// Return tracking link to frontend
ride.trackingLink = trackingData.trackingLink;
```

### 3. Record Location Updates
```javascript
// When driver sends location update
import TrackingService from '../modules/tracking/services/trackingService.js';

const trackingService = new TrackingService();
await trackingService.recordLocation(rideId, latitude, longitude, accuracy);
```

### 4. Broadcast to Trackers via Socket.io
```javascript
// In your Socket.io location handler:
const trackingToken = ride.tracking_token;
io.to(`tracking:${trackingToken}`).emit('location-update', {
  latitude,
  longitude,
  timestamp: new Date()
});
```

---

## 🎯 Usage Flow

### Rider Perspective
1. **Request ride** → System generates unique tracking token
2. **Share link** → Rider sends link to family/friends
3. **Live tracking** → Anyone with link can see driver location in real-time
4. **Ride complete** → Route history is accessible

### Family Member Perspective
1. **Receive link** → Click on `https://yourapp.com/track/xyz123`
2. **View live tracking** → See driver location on map
3. **See route** → After ride completes, view full route taken

### Admin Perspective
1. View all rides with `/api/admin/rides` (already exists)
2. Can access any tracking data using the ride's tracking token

---

## 📂 File Structure
```
src/modules/tracking/
├── controllers/
│   └── trackingController.js
├── services/
│   └── trackingService.js
├── repositories/
│   └── trackingRepository.js
├── routes/
│   └── trackingRoutes.js
├── index.js
└── TRACKING_MODULE.md (this file)
```

---

## 🔐 Security Considerations

- ✅ Token-based access (no auth needed, just share the token)
- ✅ Random secure token generation (12-character alphanumeric)
- ✅ Tracking can be disabled manually
- ✅ Expired rides can have tracking disabled
- ✅ Public endpoints don't reveal sensitive info

---

## 🚀 Next Steps

1. **Run migration** to add database tables
2. **Integrate with rides module** to generate tracking links
3. **Connect Socket.io** for real-time location updates
4. **Frontend implementation** for web/mobile tracking page
5. **QR code generation** (optional) for easy sharing

---

## 📞 Support
For issues or questions about the tracking module, check:
- `trackingRepository.js` - Database queries
- `trackingService.js` - Business logic
- `trackingController.js` - API endpoints
