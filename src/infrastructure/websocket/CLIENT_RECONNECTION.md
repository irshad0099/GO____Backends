# Client-Side Reconnection & Data Persistence Guide

## Overview

Server restarts aur network disconnections se data loss ko prevent karne ke liye proper client-side implementation zaroori hai.

## Problem Statement

❌ **Server restart → Socket disconnect → Data loss**

Ab ye nahi hoga kyunki:
- ✅ Server side data Redis mein persist hota hai (24-hour TTL)
- ✅ Client side automatic reconnection handle karta hai
- ✅ Reconnection pe previous state recover hota hai
- ✅ Missed messages queue mein hote hain aur delivery hoti hai

## Client Implementation

### 1. Socket.IO Client Setup (React Example)

```javascript
// src/services/socketService.js

import io from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.reconnectionAttempts = 0;
    this.maxReconnectionAttempts = 10;
  }

  /**
   * Initialize socket connection
   */
  connect(userId, userType, phone) {
    this.socket = io('http://localhost:5000', {
      // Reconnection settings
      reconnection: true,
      reconnectionDelay: 1000,           // Start with 1 second
      reconnectionDelayMax: 5000,        // Max 5 seconds
      reconnectionAttempts: 10,          // Try 10 times
      
      // Connection timeout
      connectTimeout: 10000,             // 10 second timeout
      
      // Transport settings
      transports: ['websocket', 'polling'],
      
      // Authentication
      auth: {
        userId,
        userType,
        phone
      }
    });

    // Handle initial connection
    this.socket.on('connect', () => {
      console.log('🔌 Socket connected:', this.socket.id);
      this.reconnectionAttempts = 0;
      
      // Send authentication
      this.socket.emit('auth:login', { userId, userType, phone });
    });

    // Handle reconnection
    this.socket.on('connect_error', (error) => {
      this.reconnectionAttempts++;
      console.warn(`⚠️ Connection error (attempt ${this.reconnectionAttempts}):`, error);
    });

    // Handle successful reconnection
    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`✅ Reconnected after ${attemptNumber} attempts`);
      
      // Emit reconnection event to recover state
      this.socket.emit('auth:reconnect', { userId, userType });
    });

    // Handle reconnection failure
    this.socket.on('reconnect_failed', () => {
      console.error('❌ Failed to reconnect after max attempts');
      // Show user a notification to refresh manually
    });

    // Handle recovery data
    this.socket.on('reconnection:recovery', (data) => {
      console.log('📬 Recovery data received:', data);
      
      // Update UI with recovered state
      if (data.data?.activeRide) {
        this.onRideRecovered(data.data.activeRide);
      }
      
      // Re-render UI with previous state
      this.onStateRecovered(data.data);
    });

    // Handle disconnection
    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      // Socket.IO will automatically attempt to reconnect
    });

    // Error handler
    this.socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
    });

    return this.socket;
  }

  /**
   * Join ride for real-time updates
   */
  joinRide(rideId, rideData = {}) {
    this.socket.emit('ride:join', { rideId, rideData });

    // Listen for ride status updates
    this.socket.on('ride:status_changed', (data) => {
      console.log('Ride status:', data.status);
      this.onRideStatusUpdate(data);
    });

    // Listen for driver location updates
    this.socket.on('ride:driver_location_update', (data) => {
      console.log('Driver location:', data.location);
      this.onDriverLocationUpdate(data);
    });
  }

  /**
   * Leave ride room
   */
  leaveRide(rideId) {
    this.socket.emit('ride:leave', { rideId });
  }

  /**
   * Update driver location
   */
  updateLocation(latitude, longitude) {
    this.socket.emit('driver:location_update', { latitude, longitude });
  }

  /**
   * Send chat message
   */
  sendMessage(rideId, message) {
    this.socket.emit('chat:send', { rideId, message });
  }

  /**
   * Disconnect socket
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  // Callbacks (override these in your app)
  onStateRecovered(data) {
    console.log('State recovered:', data);
  }

  onRideRecovered(rideData) {
    console.log('Ride recovered:', rideData);
  }

  onRideStatusUpdate(data) {
    console.log('Ride status updated:', data);
  }

  onDriverLocationUpdate(data) {
    console.log('Driver location updated:', data);
  }
}

export default new SocketService();
```

### 2. React Hook for Socket Management

```javascript
// src/hooks/useSocket.js

import { useEffect, useRef, useCallback } from 'react';
import socketService from '../services/socketService';

export const useSocket = (userId, userType, phone) => {
  const isConnected = useRef(false);
  const [socketState, setSocketState] = React.useState({
    isConnected: false,
    isReconnecting: false,
    recoveredData: null
  });

  useEffect(() => {
    // Initialize socket
    const socket = socketService.connect(userId, userType, phone);

    // Handle connection state
    socket.on('auth:success', () => {
      setSocketState(prev => ({ ...prev, isConnected: true, isReconnecting: false }));
      isConnected.current = true;
    });

    // Handle recovery
    socket.on('reconnection:recovery', (data) => {
      setSocketState(prev => ({
        ...prev,
        isConnected: true,
        isReconnecting: false,
        recoveredData: data.data
      }));
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      setSocketState(prev => ({ ...prev, isConnected: false, isReconnecting: true }));
    });

    return () => {
      // Don't disconnect on component unmount - keep connection alive
      // socketService.disconnect();
    };
  }, [userId, userType, phone]);

  const joinRide = useCallback((rideId, rideData) => {
    if (socketState.isConnected) {
      socketService.joinRide(rideId, rideData);
    }
  }, [socketState.isConnected]);

  const leaveRide = useCallback((rideId) => {
    socketService.leaveRide(rideId);
  }, []);

  const updateLocation = useCallback((latitude, longitude) => {
    if (socketState.isConnected) {
      socketService.updateLocation(latitude, longitude);
    }
  }, [socketState.isConnected]);

  return {
    ...socketState,
    joinRide,
    leaveRide,
    updateLocation,
    socket: socketService.socket
  };
};
```

### 3. Usage in Component

```javascript
// src/pages/RidePage.jsx

import { useSocket } from '../hooks/useSocket';

export function RidePage() {
  const { userId, userType, phone } = useAuth();
  const { isConnected, recoveredData, joinRide, updateLocation } = useSocket(userId, userType, phone);
  
  const [rideData, setRideData] = React.useState(null);

  useEffect(() => {
    // If recovering from server restart
    if (recoveredData?.activeRide) {
      setRideData(recoveredData.activeRide);
      console.log('✅ Ride recovered from previous session');
    } else {
      // Fetch current ride from API
      fetchCurrentRide();
    }
  }, [recoveredData]);

  useEffect(() => {
    if (rideData && isConnected) {
      // Join ride room when connected
      joinRide(rideData.rideId, rideData);
    }
  }, [rideData, isConnected, joinRide]);

  // Update location every 5 seconds
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      navigator.geolocation.getCurrentPosition(position => {
        updateLocation(
          position.coords.latitude,
          position.coords.longitude
        );
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [isConnected, updateLocation]);

  if (!isConnected) {
    return <div>⏳ Connecting to server...</div>;
  }

  if (!rideData) {
    return <div>Loading ride data...</div>;
  }

  return (
    <div className="ride-container">
      <div className="ride-status">
        Status: {rideData.status}
        {rideData.status === 'started' && <span className="pulse">● Live</span>}
      </div>

      <div className="driver-info">
        <h3>{rideData.driverName}</h3>
        <p>📍 Real-time location tracking active</p>
      </div>
    </div>
  );
}
```

## Data Flow During Server Restart

```
┌─────────────┐
│   Client    │  - Has active ride
│  (React)    │  - Socket connected
└──────┬──────┘
       │
       ├─ emit: 'ride:join', { rideId }
       │
       ▼
┌─────────────────────────────────┐
│  Backend - Server Running       │
│  ✅ Session stored in Redis     │
│  ✅ Active ride in Redis        │
│  ✅ Location history in Redis   │
└──────┬──────────────────────────┘
       │
       ├─ Server restarts!
       │
       ▼
┌─────────────────────────────────┐
│  Redis (Data Persisted)         │  ← All data still here!
│  ✅ session:{userId}            │
│  ✅ active_ride:{userId}        │
│  ✅ msg_queue:{userId}          │
│  ✅ location_history:{driverId} │
└─────────────────────────────────┘
       ▲
       │
       ├─ Server restarts
       │
       ▼
┌──────┬──────────────────────────┐
│  Client notices disconnect     │
│  Automatic reconnection starts │
└──────┬──────────────────────────┘
       │
       ├─ emit: 'auth:reconnect'
       │
       ▼
┌──────┬──────────────────────────────┐
│  Backend recovering state         │
│  1. Check Redis for session      │
│  2. Check Redis for active ride  │
│  3. Retrieve queued messages     │
│  4. Re-join ride room            │
└──────┬──────────────────────────────┘
       │
       ├─ emit: 'reconnection:recovery'
       │ {
       │   session: {...},
       │   activeRide: {...},
       │   queuedMessages: [...]
       │ }
       │
       ▼
┌──────────────────────────────────┐
│ Client receives recovery data   │
│ ✅ Re-renders with same state   │
│ ✅ Rejoins ride room            │
│ ✅ Gets all missed messages     │
│ ✅ Continues real-time updates  │
└──────────────────────────────────┘
```

## Queued Messages Example

```javascript
// During disconnection, server queues messages:
// msg_queue:user123 = [
//   { event: 'chat:new_message', data: {...} },
//   { event: 'ride:status_changed', data: {...} },
//   { event: 'ride:driver_location_update', data: {...} }
// ]

// On reconnection, client receives all:
socket.on('reconnection:recovery', (data) => {
  // data.data.queuedMessages contains all missed events
  data.data.queuedMessages.forEach(msg => {
    // Process each missed message
    handleMessage(msg.event, msg.data);
  });
});
```

## Configuration

### Redis TTL Settings (24 hours)

```javascript
// src/infrastructure/websocket/reconnection.handler.js

const SESSION_TTL = 86400;        // 24 hours
// Messages automatically expire after this time
// Active rides: 3600 (1 hour - rides don't last long)
```

### Client Reconnection Attempts

```javascript
reconnectionAttempts: 10,         // Try 10 times
reconnectionDelay: 1000,          // Start with 1s
reconnectionDelayMax: 5000,       // Max 5s between attempts
// Total timeout: ~50 seconds before giving up
```

## Best Practices

1. **Don't disconnect on page navigation** - Keep socket alive across page changes
2. **Listen for connection state** - Show UI indicators (✅ Connected / ⏳ Reconnecting)
3. **Handle recovery data** - Update UI state from `recoveredData`
4. **Implement offline queue** - Queue messages locally if socket disconnected
5. **Test server restarts** - Kill and restart server during active rides

## Testing

### Test 1: Server Restart During Active Ride
```bash
1. Start ride
2. In terminal: Ctrl+C (kill server)
3. Wait 3-5 seconds
4. Restart server: npm run dev
5. Client should reconnect automatically
6. Ride state should be restored
```

### Test 2: Network Loss
```bash
1. Start ride
2. Disable WiFi/Network
3. Wait 10 seconds
4. Re-enable network
5. Client should reconnect automatically
6. Queued messages should deliver
```

## Troubleshooting

### Messages not queuing?
- Check Redis is running: `redis-cli ping`
- Verify `MESSAGE_QUEUE_PREFIX` key in Redis

### Recovery data not received?
- Check client listener: `socket.on('reconnection:recovery', ...)`
- Verify server is emitting: `socket.emit('reconnection:recovery', ...)`

### Duplicate messages?
- Ensure you clear queue after processing: `clearMessageQueue(userId)`

## Summary

```
✅ Server restarts → Data persists in Redis
✅ Network loss → Automatic reconnection
✅ Missed messages → Queued and delivered on reconnect
✅ Active ride → Automatically rejoined
✅ UI state → Recovered from previous session
```

**Zero data loss on server restart!** 🚀
