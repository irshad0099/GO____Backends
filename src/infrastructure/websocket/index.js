export {
    registerSocketUser,
    unregisterSocketUser,
    getSocketUser,
    getUserSockets,
    getAvailableDrivers,
    updateDriverLocation,
    emitToUser,
    emitToDriver,
    emitToPassenger,
    broadcastEvent,
    emitRideStatusUpdate,
    emitDriverLocation,
    emitRideRequest,
    emitChatMessage,
    setupRideRoom,
    leaveRideRoom,
    getConnectedUsersCount,
    isUserOnline
} from './socket.events.js';

export { setupSocketHandlers } from './socket.server.js';
