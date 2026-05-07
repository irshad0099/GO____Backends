// test-passenger.js
import { io } from "socket.io-client";

// Passenger Token from your Postman request
const PASSENGER_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1NGYzOThiYS1lZDRjLTQwZDYtYTc5YS0xNTIyZTU3ZTY5NjUiLCJwaG9uZSI6Ijk4NzY1NDMyMTAiLCJyb2xlIjoicGFzc2VuZ2VyIiwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTc3ODE4ODA1OCwiZXhwIjoxNzc4Mjc0NDU4fQ.3Q8ujPJ9D4ztMghgu-nqbCjJg4BOjuamCmMjXhvBwSQ";
const BASE_URL = "https://api.gomobility.co.in";

const socket = io(BASE_URL, {
    auth: { token: PASSENGER_TOKEN },
    extraHeaders: {
        "Origin": BASE_URL
    }
});

socket.on("connect", () => {
    console.log("✅ Connected as PASSENGER!");

    // Step 1: Login
    socket.emit("auth:login", {});
    console.log("📡 Emitted auth:login. Ready to book a ride via Postman!\n");
});

socket.on("auth:success", (data) => {
    console.log("🔓 Auth Success:", data.message);
    console.log("👉 Now go to Postman and hit POST /api/v1/rides/request\n");
});

// ─── LISTENERS FOR PASSENGER EVENTS ──────────────────────────────

// 1. Driver Accepts Ride (Instant Socket Ack)
socket.on("ride:accepted", (data) => {
    console.log("🔔 [EVENT] ride:accepted -> Driver matched! Waiting for DB confirmation...");
});

// 2. Driver Formally Assigned (DB Updated)
socket.on("ride:driver_assigned", (data) => {
    console.log("\n🚗 [EVENT] ride:driver_assigned -> DRIVER IS ON THE WAY!");
    console.log(`Name: ${data.driverName} | Vehicle: ${data.vehicleColor} ${data.vehicleModel} (${data.vehicleNumber})`);

    // Auto-Join Ride Room (Crucial for live tracking)
    socket.emit("ride:join", { rideId: data.rideId });
    console.log(`📡 Emitted ride:join for Room ${data.rideId}`);
});

// 3. Room Joined Confirmation
socket.on("ride:joined", (data) => {
    console.log("🚪 [EVENT] ride:joined -> You are now receiving live tracking updates.");
});

// 4. Live Location Updates (from driver)
socket.on("driver:map_ping", (data) => {
    console.log(`📍 [EVENT] driver:map_ping -> Driver is at ${data.location.latitude}, ${data.location.longitude} (Speed: ${data.speed}km/h)`);
});

// 5. Ride Status Updates (Arrived, Started, Completed)
socket.on("ride:status_update", (data) => {
    console.log(`\n🔄 [EVENT] ride:status_update -> Status changed to: ${data.status.toUpperCase()}`);

    if (data.status === "completed" || data.status === "cancelled") {
        socket.emit("ride:leave", { rideId: data.rideId });
        console.log("📡 Emitted ride:leave and exited the tracking room.");
        console.log("🏁 Ride journey finished!");
    }
});

// 6. ETA Updates
socket.on("ride:eta_update", (data) => {
    console.log(`⏳ [EVENT] ride:eta_update -> Driver arriving in ${data.etaMinutes} mins (${data.distanceKm} km away)`);
});

// 7. Payment Summary (when completed)
socket.on("ride:payment_settled", (data) => {
    console.log("\n💳 [EVENT] ride:payment_settled -> Payment summary received:");
    console.log(JSON.stringify(data, null, 2));
});

// Errors
socket.on("error", (err) => {
    console.error("❌ Socket Error:", err);
});
socket.on("connect_error", (err) => {
    console.error("Connection Error:", err.message);
});
