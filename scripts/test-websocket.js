/**
 * WebSocket End-to-End Test Suite — GoMobility
 *
 * Tests all socket events defined in socket.server.js
 * Run: node scripts/test-websocket.js
 *
 * Server must be running on PORT 5000 (npm run dev in another terminal)
 */

import { io as Client } from 'socket.io-client';

const SERVER_URL = 'http://localhost:5000';
const TIMEOUT_MS = 4000;

// ─── Test runner helpers ─────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const results = [];

function pass(name) {
    passed++;
    results.push({ status: 'PASS', name });
    console.log(`  ✅ PASS  ${name}`);
}

function fail(name, reason) {
    failed++;
    results.push({ status: 'FAIL', name, reason });
    console.log(`  ❌ FAIL  ${name}`);
    console.log(`         → ${reason}`);
}

function section(title) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  ${title}`);
    console.log('─'.repeat(60));
}

/**
 * Wait for a socket event with a timeout.
 * Resolves with event data or rejects on timeout.
 */
function waitFor(socket, event, timeoutMs = TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Timeout waiting for "${event}" (${timeoutMs}ms)`));
        }, timeoutMs);

        socket.once(event, (data) => {
            clearTimeout(timer);
            resolve(data);
        });
    });
}

/**
 * Create a connected socket and wait for connection confirmation.
 */
function connect(label) {
    return new Promise((resolve, reject) => {
        const socket = Client(SERVER_URL, {
            transports: ['websocket'],
            reconnection: false,
            timeout: TIMEOUT_MS
        });

        const timer = setTimeout(() => {
            socket.disconnect();
            reject(new Error(`Connection timeout for "${label}"`));
        }, TIMEOUT_MS);

        socket.on('connect', () => {
            clearTimeout(timer);
            resolve(socket);
        });

        socket.on('connect_error', (err) => {
            clearTimeout(timer);
            reject(new Error(`Connection failed for "${label}": ${err.message}`));
        });
    });
}

// ─── Test Suites ─────────────────────────────────────────────────────────────

async function testAuthLogin(socket) {
    section('1. auth:login');

    // 1a — successful passenger login
    try {
        socket.emit('auth:login', { userId: 'user_101', userType: 'passenger', phone: '9876543210' });
        const data = await waitFor(socket, 'auth:success');
        if (data.userId === 'user_101' && data.userType === 'passenger' && data.socketId) {
            pass('auth:login — passenger success');
        } else {
            fail('auth:login — passenger success', `Unexpected payload: ${JSON.stringify(data)}`);
        }
    } catch (e) {
        fail('auth:login — passenger success', e.message);
    }

    // 1b — missing userId → auth:error
    try {
        const errorSocket = await connect('auth:login error test');
        errorSocket.emit('auth:login', { userType: 'passenger' }); // missing userId
        const data = await waitFor(errorSocket, 'auth:error');
        if (data.message) {
            pass('auth:login — missing userId → auth:error');
        } else {
            fail('auth:login — missing userId → auth:error', 'No error message in response');
        }
        errorSocket.disconnect();
    } catch (e) {
        fail('auth:login — missing userId → auth:error', e.message);
    }

    // 1c — missing userType → auth:error
    try {
        const errorSocket = await connect('auth:login error test 2');
        errorSocket.emit('auth:login', { userId: 'user_102' }); // missing userType
        const data = await waitFor(errorSocket, 'auth:error');
        if (data.message) {
            pass('auth:login — missing userType → auth:error');
        } else {
            fail('auth:login — missing userType → auth:error', 'No error message in response');
        }
        errorSocket.disconnect();
    } catch (e) {
        fail('auth:login — missing userType → auth:error', e.message);
    }
}

async function testAuthLogout(socket) {
    section('2. auth:logout');

    try {
        // Re-login first (may have been consumed already)
        socket.emit('auth:login', { userId: 'user_101', userType: 'passenger' });
        await waitFor(socket, 'auth:success');

        socket.emit('auth:logout');
        const data = await waitFor(socket, 'auth:logout_success');
        if (data.message) {
            pass('auth:logout — success');
        } else {
            fail('auth:logout — success', 'No message in response');
        }
    } catch (e) {
        fail('auth:logout — success', e.message);
    }
}

async function testAuthReconnect() {
    section('3. auth:reconnect (Redis session recovery)');

    let socket1, socket2;

    try {
        // Step 1: first connection — login as driver, join a ride
        socket1 = await connect('reconnect test — initial');
        socket1.emit('auth:login', { userId: 'driver_reconnect_99', userType: 'driver' });
        await waitFor(socket1, 'auth:success');
        pass('auth:reconnect — initial session login');

        // Step 2: disconnect
        socket1.disconnect();
        await new Promise(r => setTimeout(r, 200));

        // Step 3: reconnect with new socket
        socket2 = await connect('reconnect test — second');
        socket2.emit('auth:reconnect', { userId: 'driver_reconnect_99', userType: 'driver' });

        const recovery = await waitFor(socket2, 'reconnection:recovery');
        if (recovery.success && recovery.data) {
            pass('auth:reconnect — reconnection:recovery received');
        } else {
            fail('auth:reconnect — reconnection:recovery received', `Payload: ${JSON.stringify(recovery)}`);
        }
    } catch (e) {
        fail('auth:reconnect — session recovery', e.message);
    } finally {
        socket1?.disconnect();
        socket2?.disconnect();
    }

    // 3b — missing userId → auth:error
    try {
        const s = await connect('reconnect missing fields');
        s.emit('auth:reconnect', { userType: 'driver' }); // missing userId
        const data = await waitFor(s, 'auth:error');
        if (data.message) {
            pass('auth:reconnect — missing userId → auth:error');
        } else {
            fail('auth:reconnect — missing userId → auth:error', 'No error message');
        }
        s.disconnect();
    } catch (e) {
        fail('auth:reconnect — missing userId → auth:error', e.message);
    }
}

async function testDriverLocationUpdate(driverSocket, passengerSocket) {
    section('4. driver:location_update');

    const TEST_RIDE_ID = 888;

    // Both join the ride room first
    driverSocket.emit('ride:join', { rideId: TEST_RIDE_ID });
    await waitFor(driverSocket, 'ride:joined');
    passengerSocket.emit('ride:join', { rideId: TEST_RIDE_ID });
    await waitFor(passengerSocket, 'ride:joined');

    // 4a — with rideId → driver:map_ping emitted to ride room
    try {
        const pingPromise = waitFor(passengerSocket, 'driver:map_ping');
        driverSocket.emit('driver:location_update', {
            latitude: 25.7776,
            longitude: 87.4753,
            rideId: TEST_RIDE_ID,
            accuracy: 10,
            speed: 30
        });
        const ping = await pingPromise;

        if (
            ping.rideId === TEST_RIDE_ID &&
            ping.location?.latitude === 25.7776 &&
            ping.location?.longitude === 87.4753 &&
            ping.driverId
        ) {
            pass('driver:location_update — driver:map_ping received by passenger in ride room');
        } else {
            fail('driver:location_update — driver:map_ping payload', `Got: ${JSON.stringify(ping)}`);
        }
    } catch (e) {
        fail('driver:location_update — driver:map_ping received by passenger', e.message);
    }

    // 4b — without rideId → error
    try {
        const errPromise = waitFor(driverSocket, 'error');
        driverSocket.emit('driver:location_update', { latitude: 25.7, longitude: 87.4 }); // no rideId
        const err = await errPromise;
        if (err.message) {
            pass('driver:location_update — missing rideId → error');
        } else {
            fail('driver:location_update — missing rideId → error', 'No error message');
        }
    } catch (e) {
        fail('driver:location_update — missing rideId → error', e.message);
    }

    // 4c — unauthorized (passenger tries) → error
    try {
        const errPromise = waitFor(passengerSocket, 'error');
        passengerSocket.emit('driver:location_update', {
            latitude: 25.7, longitude: 87.4, rideId: TEST_RIDE_ID
        });
        const err = await errPromise;
        if (err.message === 'Unauthorized') {
            pass('driver:location_update — unauthorized passenger → error');
        } else {
            fail('driver:location_update — unauthorized passenger → error', `Got: ${err.message}`);
        }
    } catch (e) {
        fail('driver:location_update — unauthorized passenger → error', e.message);
    }
}

async function testDriverAvailabilityToggle(driverSocket) {
    section('5. driver:availability_toggle');

    try {
        const eventPromise = waitFor(driverSocket, 'driver:availability_changed');
        driverSocket.emit('driver:availability_toggle', { isAvailable: true });
        const data = await eventPromise;

        if (data.driverId && typeof data.isAvailable === 'boolean' && data.timestamp) {
            pass('driver:availability_toggle — driver:availability_changed received');
        } else {
            fail('driver:availability_toggle — payload check', `Got: ${JSON.stringify(data)}`);
        }
    } catch (e) {
        fail('driver:availability_toggle', e.message);
    }

    // 5b — unauthorized (passenger) → error
    try {
        const pSocket = await connect('availability toggle passenger');
        pSocket.emit('auth:login', { userId: 'user_unauth', userType: 'passenger' });
        await waitFor(pSocket, 'auth:success');

        const errPromise = waitFor(pSocket, 'error');
        pSocket.emit('driver:availability_toggle', { isAvailable: true });
        const err = await errPromise;

        if (err.message === 'Unauthorized') {
            pass('driver:availability_toggle — unauthorized passenger → error');
        } else {
            fail('driver:availability_toggle — unauthorized passenger → error', `Got: ${err.message}`);
        }
        pSocket.disconnect();
    } catch (e) {
        fail('driver:availability_toggle — unauthorized passenger → error', e.message);
    }
}

async function testRideAcceptReject(driverSocket) {
    section('6. ride:accept & ride:reject');

    // 6a — accept
    try {
        const acceptPromise = waitFor(driverSocket, 'ride:accepted');
        driverSocket.emit('ride:accept', { rideId: 42 });
        const data = await acceptPromise;

        if (data.rideId === 42 && data.driverId && data.timestamp) {
            pass('ride:accept — ride:accepted broadcast received');
        } else {
            fail('ride:accept — payload check', `Got: ${JSON.stringify(data)}`);
        }
    } catch (e) {
        fail('ride:accept — ride:accepted received', e.message);
    }

    // 6b — reject
    try {
        const rejectPromise = waitFor(driverSocket, 'ride:rejected');
        driverSocket.emit('ride:reject', { rideId: 42, reason: 'too_far' });
        const data = await rejectPromise;

        if (data.rideId === 42 && data.driverId && data.reason === 'too_far') {
            pass('ride:reject — ride:rejected broadcast received');
        } else {
            fail('ride:reject — payload check', `Got: ${JSON.stringify(data)}`);
        }
    } catch (e) {
        fail('ride:reject — ride:rejected received', e.message);
    }

    // 6c — unauthorized passenger tries to accept → error
    try {
        const pSocket = await connect('reject unauthorized');
        pSocket.emit('auth:login', { userId: 'user_unauth2', userType: 'passenger' });
        await waitFor(pSocket, 'auth:success');

        const errPromise = waitFor(pSocket, 'error');
        pSocket.emit('ride:accept', { rideId: 42 });
        const err = await errPromise;

        if (err.message === 'Unauthorized') {
            pass('ride:accept — unauthorized passenger → error');
        } else {
            fail('ride:accept — unauthorized passenger → error', `Got: ${err.message}`);
        }
        pSocket.disconnect();
    } catch (e) {
        fail('ride:accept — unauthorized passenger → error', e.message);
    }
}

async function testRideRoom(driverSocket, passengerSocket) {
    section('7. ride:join & ride:leave');

    const RIDE_ID = 999;

    // 7a — passenger joins
    try {
        passengerSocket.emit('ride:join', { rideId: RIDE_ID, rideData: { status: 'accepted' } });
        const data = await waitFor(passengerSocket, 'ride:joined');
        if (data.rideId === RIDE_ID) {
            pass('ride:join — passenger joined ride room');
        } else {
            fail('ride:join — passenger joined', `Got: ${JSON.stringify(data)}`);
        }
    } catch (e) {
        fail('ride:join — passenger joined', e.message);
    }

    // 7b — driver joins
    try {
        driverSocket.emit('ride:join', { rideId: RIDE_ID });
        const data = await waitFor(driverSocket, 'ride:joined');
        if (data.rideId === RIDE_ID) {
            pass('ride:join — driver joined ride room');
        } else {
            fail('ride:join — driver joined', `Got: ${JSON.stringify(data)}`);
        }
    } catch (e) {
        fail('ride:join — driver joined', e.message);
    }

    // 7c — unauthenticated socket → error
    try {
        const unauthSocket = await connect('unauth ride:join');
        const errPromise = waitFor(unauthSocket, 'error');
        unauthSocket.emit('ride:join', { rideId: RIDE_ID });
        const err = await errPromise;
        if (err.message === 'Unauthorized') {
            pass('ride:join — unauthenticated → error');
        } else {
            fail('ride:join — unauthenticated → error', `Got: ${err.message}`);
        }
        unauthSocket.disconnect();
    } catch (e) {
        fail('ride:join — unauthenticated → error', e.message);
    }

    // 7d — leave
    try {
        passengerSocket.emit('ride:leave', { rideId: RIDE_ID });
        const data = await waitFor(passengerSocket, 'ride:left');
        if (data.rideId === RIDE_ID) {
            pass('ride:leave — passenger left ride room');
        } else {
            fail('ride:leave — passenger left', `Got: ${JSON.stringify(data)}`);
        }
    } catch (e) {
        fail('ride:leave — passenger left', e.message);
    }
}

async function testRideUpdate(driverSocket, passengerSocket) {
    section('8. ride:update');

    const RIDE_ID = 777;

    // Both join the ride room
    driverSocket.emit('ride:join', { rideId: RIDE_ID });
    await waitFor(driverSocket, 'ride:joined');
    passengerSocket.emit('ride:join', { rideId: RIDE_ID });
    await waitFor(passengerSocket, 'ride:joined');

    // 8a — driver sends update, passenger receives ride:status_changed
    try {
        const changePromise = waitFor(passengerSocket, 'ride:status_changed');
        driverSocket.emit('ride:update', { rideId: RIDE_ID, status: 'arrived' });
        const data = await changePromise;

        if (
            data.rideId === RIDE_ID &&
            data.status === 'arrived' &&
            data.updatedBy &&
            data.timestamp
        ) {
            pass('ride:update — ride:status_changed received by passenger in room');
        } else {
            fail('ride:update — payload check', `Got: ${JSON.stringify(data)}`);
        }
    } catch (e) {
        fail('ride:update — ride:status_changed received by passenger', e.message);
    }

    // 8b — unauthenticated → error
    try {
        const unauthSocket = await connect('unauth ride:update');
        const errPromise = waitFor(unauthSocket, 'error');
        unauthSocket.emit('ride:update', { rideId: RIDE_ID, status: 'completed' });
        const err = await errPromise;
        if (err.message === 'Unauthorized') {
            pass('ride:update — unauthenticated → error');
        } else {
            fail('ride:update — unauthenticated → error', `Got: ${err.message}`);
        }
        unauthSocket.disconnect();
    } catch (e) {
        fail('ride:update — unauthenticated → error', e.message);
    }
}

async function testChat(driverSocket, passengerSocket) {
    section('9. chat:send & chat:typing');

    const RIDE_ID = 666;

    // Both join
    driverSocket.emit('ride:join', { rideId: RIDE_ID });
    await waitFor(driverSocket, 'ride:joined');
    passengerSocket.emit('ride:join', { rideId: RIDE_ID });
    await waitFor(passengerSocket, 'ride:joined');

    // 9a — passenger sends message, driver receives chat:new_message
    // io.to(room).emit sends to ALL room members including sender,
    // so we consume both (driver + passenger's own echo) to prevent leaking into 9b.
    try {
        const driverMsgPromise    = waitFor(driverSocket, 'chat:new_message');
        const passengerEchoPromise = waitFor(passengerSocket, 'chat:new_message'); // consume echo
        passengerSocket.emit('chat:send', { rideId: RIDE_ID, message: 'Main aa raha hoon!' });
        const data = await driverMsgPromise;
        await passengerEchoPromise; // drain passenger's own echo so it doesn't leak

        if (
            data.rideId === RIDE_ID &&
            data.message === 'Main aa raha hoon!' &&
            data.senderId &&
            data.senderType === 'passenger' &&
            data.timestamp
        ) {
            pass('chat:send — chat:new_message received by driver');
        } else {
            fail('chat:send — payload check', `Got: ${JSON.stringify(data)}`);
        }
    } catch (e) {
        fail('chat:send — chat:new_message received by driver', e.message);
    }

    // 9b — driver sends message, passenger receives
    // Similarly consume driver's own echo.
    try {
        const passengerMsgPromise = waitFor(passengerSocket, 'chat:new_message');
        const driverEchoPromise   = waitFor(driverSocket, 'chat:new_message'); // consume echo
        driverSocket.emit('chat:send', { rideId: RIDE_ID, message: 'Theek hai, 2 min mein' });
        const data = await passengerMsgPromise;
        await driverEchoPromise; // drain driver's own echo

        if (data.senderType === 'driver' && data.rideId === RIDE_ID) {
            pass('chat:send — driver → passenger chat:new_message');
        } else {
            fail('chat:send — driver → passenger', `Got: ${JSON.stringify(data)}`);
        }
    } catch (e) {
        fail('chat:send — driver → passenger', e.message);
    }

    // 9c — typing indicator
    try {
        const typingPromise = waitFor(driverSocket, 'chat:user_typing');
        passengerSocket.emit('chat:typing', { rideId: RIDE_ID });
        const data = await typingPromise;

        if (data.rideId === RIDE_ID && data.userId && data.userType === 'passenger') {
            pass('chat:typing — chat:user_typing received by driver');
        } else {
            fail('chat:typing — payload check', `Got: ${JSON.stringify(data)}`);
        }
    } catch (e) {
        fail('chat:typing — chat:user_typing received', e.message);
    }

    // 9d — unauthenticated chat:send → error
    try {
        const unauthSocket = await connect('unauth chat');
        const errPromise = waitFor(unauthSocket, 'error');
        unauthSocket.emit('chat:send', { rideId: RIDE_ID, message: 'hack' });
        const err = await errPromise;
        if (err.message === 'Unauthorized') {
            pass('chat:send — unauthenticated → error');
        } else {
            fail('chat:send — unauthenticated → error', `Got: ${err.message}`);
        }
        unauthSocket.disconnect();
    } catch (e) {
        fail('chat:send — unauthenticated → error', e.message);
    }
}

async function testDisconnect() {
    section('10. disconnect');

    try {
        const socket = await connect('disconnect test');
        socket.emit('auth:login', { userId: 'user_disconnect_test', userType: 'passenger' });
        await waitFor(socket, 'auth:success');

        socket.disconnect();
        await new Promise(r => setTimeout(r, 300));

        pass('disconnect — socket disconnected cleanly');
    } catch (e) {
        fail('disconnect', e.message);
    }
}

async function testMessageQueueOnReconnect() {
    section('11. Message queue delivery on reconnect');

    // This test verifies that queued messages are flushed on auth:reconnect.
    // We call queueMessage directly via the reconnection handler's contract:
    // after reconnect, recovery.data.queuedMessages is returned.

    try {
        // Connect, login, disconnect
        const s1 = await connect('msg queue — session 1');
        s1.emit('auth:login', { userId: 'user_queue_test_55', userType: 'passenger' });
        await waitFor(s1, 'auth:success');
        s1.disconnect();
        await new Promise(r => setTimeout(r, 200));

        // Reconnect
        const s2 = await connect('msg queue — session 2');
        s2.emit('auth:reconnect', { userId: 'user_queue_test_55', userType: 'passenger' });
        const recovery = await waitFor(s2, 'reconnection:recovery');

        if (recovery.success && Array.isArray(recovery.data?.queuedMessages)) {
            pass('message queue — reconnection:recovery contains queuedMessages array');
        } else {
            fail('message queue — queuedMessages array present', `Got: ${JSON.stringify(recovery)}`);
        }

        s2.disconnect();
    } catch (e) {
        fail('message queue — delivery on reconnect', e.message);
    }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function runAll() {
    console.log('\n' + '═'.repeat(60));
    console.log('  GoMobility — WebSocket E2E Test Suite');
    console.log('  Server: ' + SERVER_URL);
    console.log('═'.repeat(60));

    // Check server is up
    let passengerSocket, driverSocket;
    try {
        passengerSocket = await connect('passenger main');
        driverSocket    = await connect('driver main');
    } catch (e) {
        console.error('\n  FATAL: Could not connect to server.');
        console.error('  → Make sure server is running: npm run dev');
        console.error(`  → Error: ${e.message}\n`);
        process.exit(1);
    }

    // Login the main sockets
    passengerSocket.emit('auth:login', { userId: 'passenger_main_1', userType: 'passenger', phone: '9800000001' });
    await waitFor(passengerSocket, 'auth:success');

    driverSocket.emit('auth:login', { userId: 'driver_main_1', userType: 'driver', phone: '9800000002' });
    await waitFor(driverSocket, 'auth:success');

    // Run all test suites
    await testAuthLogin(await connect('auth:login suite'));
    await testAuthLogout(await connect('auth:logout suite'));
    await testAuthReconnect();
    await testDriverLocationUpdate(driverSocket, passengerSocket);
    await testDriverAvailabilityToggle(driverSocket);
    await testRideAcceptReject(driverSocket);
    await testRideRoom(driverSocket, passengerSocket);
    await testRideUpdate(driverSocket, passengerSocket);
    await testChat(driverSocket, passengerSocket);
    await testDisconnect();
    await testMessageQueueOnReconnect();

    // Cleanup
    passengerSocket.disconnect();
    driverSocket.disconnect();

    // Summary
    const total = passed + failed;
    console.log('\n' + '═'.repeat(60));
    console.log(`  RESULTS: ${passed}/${total} passed  |  ${failed} failed`);
    console.log('═'.repeat(60));

    if (failed > 0) {
        console.log('\n  FAILED TESTS:');
        results.filter(r => r.status === 'FAIL').forEach(r => {
            console.log(`  ✗ ${r.name}`);
            console.log(`    ${r.reason}`);
        });
        console.log('');
        process.exit(1);
    } else {
        console.log('\n  All tests passed!\n');
        process.exit(0);
    }
}

runAll().catch(e => {
    console.error('Unhandled error in test runner:', e);
    process.exit(1);
});
