import { io } from "socket.io-client";

// The token from Postman
const PASSENGER_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1NGYzOThiYS1lZDRjLTQwZDYtYTc5YS0xNTIyZTU3ZTY5NjUiLCJwaG9uZSI6Ijk4NzY1NDMyMTAiLCJyb2xlIjoicGFzc2VuZ2VyIiwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTc3ODI2MzU4OCwiZXhwIjoxNzc4MzQ5OTg4fQ.E6mXWS6cah_WV3MIWACZXgdvaQPmK7T1tKsFmy8AMwg";
const BASE_URL = "https://api.gomobility.co.in";

if (!PASSENGER_TOKEN) {
    console.error("❌ PASSENGER_TOKEN is missing!");
    console.error("Usage: node test-passenger-simulator.js <YOUR_ACCESS_TOKEN>");
    process.exit(1);
}

const socket = io(BASE_URL, {
    auth: { token: PASSENGER_TOKEN },
    extraHeaders: {
        "Origin": BASE_URL
    }
});

let currentRideId = null;
let pollInterval = null;

async function callApi(endpoint, method, body = null) {
    console.log(`\n🌐 [API] ${method} ${endpoint}`);
    const options = {
        method,
        headers: {
            "Authorization": `Bearer ${PASSENGER_TOKEN}`,
            "Content-Type": "application/json"
        }
    };
    if (body) options.body = JSON.stringify(body);

    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, options);
        const data = await response.json();
        return { status: response.status, data };
    } catch (err) {
        console.error(`❌ [API ERROR]:`, err.message);
        return { status: 500, data: null };
    }
}

async function requestRide() {
    console.log("\n🚀 Requesting a new ride...");
    const rideData = {
        vehicleType: "car",
        pickupLatitude: 30.73142080,
        pickupLongitude: 77.640599840,
        pickupAddress: "Connaught Place, New Delhi",
        dropoffLatitude: 28.5355,
        dropoffLongitude: 77.2410,
        dropoffAddress: "Nehru Place, New Delhi",
        paymentMethod: "cash"
    };

    const { status, data } = await callApi("/api/v1/rides/request", "POST", rideData);

    if (status === 201) {
        currentRideId = data.data.rideId;
        console.log(`✅ Ride requested successfully! Ride ID: ${currentRideId}`);
        console.log("⏳ Waiting for a driver to accept the ride...");
    } else {
        console.error("❌ Failed to request ride:", data);
        process.exit(1);
    }
}

async function fetchOtpLoop() {
    console.log("\n🔄 Starting OTP Polling. Driver should hit /generate-otp now.");
    pollInterval = setInterval(async () => {
        if (!currentRideId) return;

        const { status, data } = await callApi(`/api/v1/rides/${currentRideId}`, "GET");
        if (status === 200 && data.data && data.data.otp) {
            console.log(`\n==============================================`);
            console.log(`🔐 OTP RECEIVED FROM SERVER: ${data.data.otp}`);
            console.log(`==============================================`);
            console.log("👉 Tell the driver developer to use this OTP to Start the ride via /verify-otp!");
            clearInterval(pollInterval);
        }
    }, 3000);
}

socket.on("connect", () => {
    console.log("✅ Connected to Socket as PASSENGER!");
    socket.emit("auth:login", {});
});

socket.on("auth:success", (data) => {
    console.log("🔓 Auth Success. Initiating auto ride request...");
    requestRide();
});

socket.on("ride:accepted", (data) => {
    console.log("\n🔔 [EVENT] ride:accepted -> Driver matched! Waiting for DB confirmation...");
});

socket.on("ride:driver_assigned", (data) => {
    console.log(`\n🚗 [EVENT] ride:driver_assigned -> DRIVER ${data.driverName} IS ON THE WAY!`);
    socket.emit("ride:join", { rideId: data.rideId });
    console.log(`📡 Emitted ride:join for Room ${data.rideId}`);
});

socket.on("ride:joined", (data) => {
    console.log("🚪 [EVENT] ride:joined -> Room joined for live tracking.");
});

socket.on("driver:map_ping", (data) => {
    process.stdout.write(`📍 [Ping] Driver at ${data.location.latitude}, ${data.location.longitude}\r`);
});

socket.on("ride:status_update", (data) => {
    console.log(`\n🔄 [EVENT] ride:status_update -> Status changed to: ${data.status.toUpperCase()}`);

    if (data.status === "driver_arrived") {
        console.log("\n🚙 Driver Arrived at pickup!");
        fetchOtpLoop();
    }

    if (data.status === "in_progress") {
        if (pollInterval) clearInterval(pollInterval);
        console.log("\n▶️ Ride Started! Enjoy your journey.");
    }

    if (data.status === "completed" || data.status === "cancelled") {
        if (pollInterval) clearInterval(pollInterval);
        socket.emit("ride:leave", { rideId: currentRideId });
        console.log("\n🏁 Ride finished! Exiting simulator.");
        setTimeout(() => process.exit(0), 1000);
    }
});

socket.on("ride:otp_verified", (data) => {
    console.log(`\n✅ [EVENT] ride:otp_verified -> ${data.message}`);
});

socket.on("error", (err) => console.error("\n❌ Socket Error:", err));
socket.on("connect_error", (err) => console.error("\n❌ Connection Error:", err.message));
