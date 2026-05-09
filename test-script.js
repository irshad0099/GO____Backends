// test-script.js
import { io } from "socket.io-client";

// Driver Token (Update if expired)
const DRIVER_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxZTc0NDg3ZC0wMmQwLTRlNWQtYWUxYi1jNmQ4ODJiODBkZmUiLCJwaG9uZSI6IjkyMDAwMDAwMDEiLCJyb2xlIjoiZHJpdmVyIiwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTc3ODE4NjI4MCwiZXhwIjoxNzc4MjcyNjgwfQ.fv2kJiD-Bbv3fca5hFcPxJaSYeJHf88vansENzhMMHQ";
const BASE_URL = "https://api.gomobility.co.in";

// Connect to production server
const socket = io(BASE_URL, {
    auth: { token: DRIVER_TOKEN },
    extraHeaders: {
        "Origin": BASE_URL
    }
});

let locationInterval = null;
let idleLocationInterval = null;

// Helper function to call REST APIs
async function callApi(endpoint, method, body = null) {
    console.log(`\n🌐 [API CALL] ${method} ${BASE_URL}${endpoint}`);
    const options = {
        method,
        headers: {
            "Authorization": `Bearer ${DRIVER_TOKEN}`,
            "Content-Type": "application/json"
        }
    };
    if (body) options.body = JSON.stringify(body);
    
    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, options);
        const data = await response.json();
        console.log(`✅ [API RESPONSE] ${response.status}:`, data);
        return { status: response.status, data };
    } catch (err) {
        console.error(`❌ [API ERROR]:`, err.message);
    }
}

socket.on("connect_error", (err) => {
    console.log("Connection Error:", err.message);
});

socket.on("disconnect", (reason) => {
    console.log("Disconnected:", reason);
    if (locationInterval) clearInterval(locationInterval);
    if (idleLocationInterval) clearInterval(idleLocationInterval);
});

socket.on("connect", () => {
    console.log("✅ Connected as driver!");
    
    // Step 1: Login
    socket.emit("auth:login", {});
    console.log("📡 Emitted auth:login, waiting for ride requests...\n");

    // Listen for auth:success
    socket.on("auth:success", (data) => {
        console.log("🔓 Auth Success:", data);

        console.log("📍 Starting Idle Location updates (every 5s)...");
        let idleLat = 28.7041;
        let idleLng = 77.1025;
        
        idleLocationInterval = setInterval(() => {
            idleLat += 0.0001; // simulate movement
            socket.emit("driver:idle_location", {
                latitude: idleLat,
                longitude: idleLng
            });
        }, 5000);
    });

    // ─── STEP 3: RIDE REQUEST RECEIVED ──────────────────────────────
    socket.on("ride:new_request", async (data) => {
        console.log("\n🚀 [1] NEW RIDE REQUEST RECEIVED!");
        console.log(`Ride ID: ${data.rideId} | Passenger: ${data.passengerName || 'Unknown'} | Fare: ₹${data.estimatedFare}`);
        
        // Simulating driver looking at screen for 2 seconds...
        setTimeout(async () => {
            console.log("\n👍 [2] ACCEPTING RIDE...");
            
            // Step 4a: Socket Emit ride:accept
            socket.emit("ride:accept", { rideId: data.rideId });
            console.log("📡 Emitted ride:accept");

            // Step 4b: REST API POST /rides/:id/accept
            await callApi(`/api/v1/rides/${data.rideId}/accept`, "POST");

        }, 2000);
    });

    // Listen for socket confirmation
    socket.on("ride:accepted", (data) => {
        console.log("📩 Received ride:accepted (socket ack)");
    });

    // ─── STEP 4: ASSIGNMENT CONFIRMED ──────────────────────────────
    socket.on("ride:assignment_confirmed", (data) => {
        console.log("\n✅ [3] RIDE ASSIGNMENT CONFIRMED by Server!");
        console.log(`Passenger: ${data.passengerName}`);
        if (data.otp) {
            console.log(`🔐 OTP (Driver's Copy): ${data.otp}`);
        }
        
        // Step 5: Join Ride Room
        socket.emit("ride:join", { rideId: data.rideId });
        console.log(`📡 Emitted ride:join for Room ${data.rideId}`);
    });

    // ─── STEP 5: JOINED ROOM ──────────────────────────────
    socket.on("ride:joined", (data) => {
        console.log("\n🚪 [4] JOINED RIDE ROOM:", data.message);
        
        // Stop idle location updates since we are now in a ride
        if (idleLocationInterval) clearInterval(idleLocationInterval);
        
        // Step 6: Start Live Location Tracking
        let lat = 28.7041;
        let lng = 77.1025;
        console.log("📍 Starting Live Location updates (every 3s)...");
        
        locationInterval = setInterval(() => {
            lat += 0.0001; // simulate movement
            socket.emit("driver:location_update", {
                rideId: data.rideId,
                latitude: lat,
                longitude: lng,
                speed: 15,
                accuracy: 5
            });
        }, 3000);

        // ─── STEP 7: SIMULATE RIDE FLOW (Arrived -> Start -> Complete) ───
        
        // Simulate Driver Arrived (after 5 seconds)
        setTimeout(async () => {
            console.log("\n🚙 [5] SIMULATING: Driver Arrived at Pickup");
            await callApi(`/api/v1/rides/${data.rideId}/status`, "PATCH", { status: "driver_arrived" });
        }, 5000);

        // Simulate Ride Started (after 10 seconds)
        setTimeout(async () => {
            console.log("\n▶️ [6] SIMULATING: Ride Started");
            await callApi(`/api/v1/rides/${data.rideId}/status`, "PATCH", { status: "in_progress" });
        }, 10000);

        // Simulate Ride Completed (after 15 seconds)
        setTimeout(async () => {
            console.log("\n🏁 [7] SIMULATING: Ride Completed");
            await callApi(`/api/v1/rides/${data.rideId}/status`, "PATCH", { status: "completed" });
            
            // Step 9: Leave Room & Stop Tracking
            clearInterval(locationInterval);
            socket.emit("ride:leave", { rideId: data.rideId });
            console.log("📡 Emitted ride:leave and stopped location updates.\n");

            // Resume idle location updates
            console.log("📍 Resuming Idle Location updates...");
            let idleLat = 28.7041;
            let idleLng = 77.1025;
            idleLocationInterval = setInterval(() => {
                idleLat += 0.0001;
                socket.emit("driver:idle_location", {
                    latitude: idleLat,
                    longitude: idleLng
                });
            }, 5000);

            console.log("🎉 END TO END RIDE FLOW COMPLETED! 🎉");
        }, 15000);
    });

    // Listen for Status Updates
    socket.on("ride:status_update", (data) => {
        console.log(`\n🔄 [STATUS UPDATE] Ride ${data.rideId} is now: ${data.status}`);
    });

    // Listen for Earnings Credited
    socket.on("driver:earnings_credited", (data) => {
        console.log(`\n💰 [EARNINGS] You earned ₹${data.earnings} for ride!`);
    });

    // Listen for any errors
    socket.on("error", (err) => {
        console.error("\n❌ Socket Error:", err);
    });
});
