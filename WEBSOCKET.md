# WebSocket/Socket.IO Real-Time Implementation Guide

## Overview

The GoMobility backend now has a comprehensive WebSocket (Socket.IO) infrastructure for real-time features including:

- 🚗 **Driver Location Tracking** - Real-time driver location updates for passengers
- 📍 **Ride Status Updates** - Instant notifications of ride status changes
- 💬 **In-Ride Chat** - Real-time messaging between driver and passenger
- 🚗 **Ride Requests** - Drivers receive new ride requests in real-time
- 🟢 **Driver Availability** - Toggle driver online/offline status
- 📢 **Notifications** - Real-time event notifications

## Architecture

### Components

1. **Socket.IO Server** (`src/config/websocketConfig.js`)
   - Initializes Socket.IO with Redis adapter for horizontal scaling
   - Configurable CORS, transports, and timeouts
   - Automatic Redis adapter setup with fallback to in-memory

2. **Event Handlers** (`src/infrastructure/websocket/socket.server.js`)
   - Connection lifecycle management
   - Authentication, driver, ride, and chat event handlers
   - Real-time message broadcasting

3. **Socket Events API** (`src/infrastructure/websocket/socket.events.js`)
   - Core utilities for emitting events
   - Driver location management
   - User/socket registration and lookup
   - Event emission helpers

## Usage

### 1. Authenticating with Socket.IO

**Client-side (React/Frontend):**
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000', {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5
});

// Authenticate after connection
socket.emit('auth:login', {
  userId: user.id,
  userType: 'driver', // or 'passenger'
  phone: user.phone
});

socket.on('auth:success', (data) => {
  console.log('Connected:', data);
});

socket.on('auth:error', (error) => {
  console.error('Auth failed:', error);
});
```

### 2. Driver Events

#### Update Location
**Client-side:**
```javascript
// Send location every 5 seconds
setInterval(() => {
  socket.emit('driver:location_update', {
    latitude: driverLat,
    longitude: driverLng
  });
}, 5000);

// Receive location updates (for display, debugging)
socket.on('driver:location_updated', (data) => {
  console.log('Driver location:', data);
});
```

**Backend Usage:**
```javascript
import { updateDriverLocation, emitDriverLocation } from './infrastructure/websocket';

// Update driver location in Redis
await updateDriverLocation(driverId, { latitude: 28.6139, longitude: 77.2090 }, true);

// Emit to passenger tracking the ride
emitDriverLocation(rideId, driverId, passengerId, { latitude: 28.6139, longitude: 77.2090 });
```

#### Toggle Availability
**Client-side:**
```javascript
socket.emit('driver:availability_toggle', {
  isAvailable: true // or false
});

socket.on('driver:availability_changed', (data) => {
  console.log('Driver availability:', data.isAvailable);
});
```

#### Accept/Reject Ride
**Client-side:**
```javascript
// Accept ride
socket.emit('ride:accept', {
  rideId: 'ride_123'
});

// Reject ride
socket.emit('ride:reject', {
  rideId: 'ride_123',
  reason: 'Too far away'
});
```

### 3. Ride Events

#### Join Ride Room
**Client-side:**
```javascript
// When ride starts, join the ride room for real-time updates
socket.emit('ride:join', {
  rideId: 'ride_123'
});

socket.on('ride:joined', (data) => {
  console.log('Joined ride room:', data);
});
```

#### Receive Ride Status Updates
**Client-side:**
```javascript
socket.on('ride:status_changed', (data) => {
  console.log('Ride status:', data.status); // 'accepted', 'started', 'completed', etc.
});
```

**Backend Usage:**
```javascript
import { emitRideStatusUpdate } from './infrastructure/websocket';

// Emit ride status to both driver and passenger
emitRideStatusUpdate(rideId, driverId, passengerId, 'started', {
  startTime: new Date(),
  // additional metadata
});
```

#### Send Ride Update
**Client-side:**
```javascript
socket.emit('ride:update', {
  rideId: 'ride_123',
  status: 'started' // or 'completed', 'cancelled', etc.
});
```

### 4. Chat Events

#### Send Message
**Client-side:**
```javascript
socket.emit('chat:send', {
  rideId: 'ride_123',
  message: 'I am 2 minutes away'
});

socket.on('chat:new_message', (data) => {
  console.log(data.senderType, ':', data.message);
});
```

**Backend Usage:**
```javascript
import { emitChatMessage } from './infrastructure/websocket';

emitChatMessage(rideId, userId, 'driver', 'I have arrived');
```

#### Typing Indicator
**Client-side:**
```javascript
socket.emit('chat:typing', {
  rideId: 'ride_123'
});

socket.on('chat:user_typing', (data) => {
  console.log(data.userType, 'is typing...');
});
```

### 5. Broadcasting New Ride Requests

**Backend Usage (in Ride Service):**
```javascript
import { emitRideRequest } from './infrastructure/websocket';

// When a new ride is created
const newRide = await rideService.createRide(passengerData);

// Broadcast to all available drivers
emitRideRequest(
  newRide.id,
  newRide.passengerId,
  newRide.pickupLocation,
  newRide.dropoffLocation,
  newRide.estimatedFare
);
```

**Client-side (Driver):**
```javascript
socket.on('ride:new_request', (data) => {
  console.log('New ride request!', {
    rideId: data.rideId,
    pickupLocation: data.pickupLocation,
    estimatedFare: data.estimatedFare
  });
  
  // Show notification and let driver accept/reject
});
```

## Backend Integration

### Using Socket Events in Services

```javascript
// src/modules/rides/services/rideService.js

import {
  emitRideStatusUpdate,
  emitRideRequest,
  isUserOnline
} from '../../../infrastructure/websocket';

export class RideService {
  async startRide(rideId) {
    const ride = await this.rideRepository.findById(rideId);
    
    // Update status in DB
    await this.rideRepository.update(rideId, { status: 'started' });
    
    // Emit to driver and passenger in real-time
    emitRideStatusUpdate(
      rideId,
      ride.driverId,
      ride.passengerId,
      'started',
      { startTime: new Date() }
    );
    
    return ride;
  }

  async acceptRideRequest(rideId, driverId) {
    const ride = await this.rideRepository.findById(rideId);
    
    await this.rideRepository.update(rideId, {
      status: 'accepted',
      driverId,
      acceptedAt: new Date()
    });
    
    // Notify both parties
    emitRideStatusUpdate(rideId, driverId, ride.passengerId, 'accepted', {
      acceptedAt: new Date(),
      driverName: driver.name,
      vehicleNumber: driver.vehicleNumber
    });
  }
}
```

## Advanced Features

### User Online Status Check
```javascript
import { isUserOnline } from './infrastructure/websocket';

// In a service
if (isUserOnline(passengerId)) {
  emitToPassenger(passengerId, 'notification:important', data);
}
```

### Get Connected Users Count
```javascript
import { getConnectedUsersCount } from './infrastructure/websocket';

const connectedCount = getConnectedUsersCount();
console.log(`${connectedCount} users connected`);
```

### Available Drivers Lookup
```javascript
import { getAvailableDrivers } from './infrastructure/websocket';

const availableDrivers = await getAvailableDrivers();
// Returns array of { driverId, location, isAvailable, updatedAt }
```

## Configuration

Edit `src/config/envConfig.js` to customize Socket.IO settings:

```javascript
// Ping timeouts (milliseconds)
SOCKET_PING_TIMEOUT: 60000      // Default: 60s
SOCKET_PING_INTERVAL: 25000     // Default: 25s

// SMS Provider (if using Real-time SMS notifications)
SMS_PROVIDER: 'fast2sms'        // or 'msg91', 'twilio', 'console'
```

## Redis Adapter for Scaling

The WebSocket system uses Redis adapter for horizontal scaling. When multiple server instances run:

- All instances share real-time data via Redis
- Broadcasting works across all servers
- Driver location updates are cached in Redis with 1-hour TTL

### Manual Redis Check
```javascript
// In a service
import redis from './config/redis.config.js';

const drivers = await redis.get('available_drivers');
if (drivers) {
  const driverList = JSON.parse(drivers);
  // Use driver list
}
```

## Error Handling

All socket handlers include proper error logging:

```javascript
socket.on('ride:update', (data) => {
  try {
    // Handle event
  } catch (error) {
    logger.error('❌ Ride update error', {
      socketId: socket.id,
      error: error.message
    });
    socket.emit('error', { message: error.message });
  }
});
```

## Testing WebSocket Locally

### Using Socket.IO Testing Tools

**Option 1: Using socket.io-client in browser console**
```javascript
const socket = io('http://localhost:5000');
socket.emit('auth:login', { userId: '123', userType: 'driver', phone: '9876543210' });
socket.on('auth:success', console.log);
```

**Option 2: Using socket.io-client CLI**
```bash
npm install -g socket.io-client
socket.io-client http://localhost:5000
```

## Troubleshooting

### Socket connections not working
1. Check Redis is running: `redis-cli ping` → should return `PONG`
2. Verify CORS settings in `websocketConfig.js`
3. Check logs for connection errors: `grep "Socket" logs/app.log`

### Real-time updates not syncing across servers
- Ensure Redis adapter is initialized properly
- Check Redis connection status
- Verify `createAdapter(pubClient, subClient)` is called

### High memory usage with many connections
- Adjust `maxHttpBufferSize` in `websocketConfig.js`
- Implement connection limits or room limits
- Monitor connected sockets: `getConnectedUsersCount()`

## Production Deployment

### Recommended Settings
```javascript
// websocketConfig.js
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL, // Use specific domain, not '*'
    credentials: true
  },
  transports: ['websocket'], // Only WebSocket in production
  pingInterval: 30000,
  pingTimeout: 10000,
  maxHttpBufferSize: 1e6
});
```

### Monitoring
- Track `getConnectedUsersCount()` as a metric
- Log all connection/disconnection events
- Monitor Redis adapter health
- Set up alerts for socket errors

## Summary

The WebSocket implementation provides:
- ✅ Real-time driver location tracking
- ✅ Instant ride status updates
- ✅ In-ride chat functionality
- ✅ Horizontal scaling with Redis
- ✅ Proper error handling and logging
- ✅ Production-ready setup

Use the exported functions from `src/infrastructure/websocket/` throughout your services to emit events and maintain real-time connectivity.
