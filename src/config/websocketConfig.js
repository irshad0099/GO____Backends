import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import redis from './redis.config.js';
import { ENV } from './envConfig.js';
import logger from '../core/logger/logger.js';

let io;

export const initializeSocketIO = (server) => {
    io = new Server(server, {
        cors: {
            origin: ENV.CORS_ORIGIN === '*' ? '*' : ENV.CORS_ORIGIN.split(','),
            methods: ['GET', 'POST'],
            credentials: true
        },
        transports: ['websocket', 'polling'],
        pingInterval: ENV.SOCKET_PING_INTERVAL,
        pingTimeout: ENV.SOCKET_PING_TIMEOUT,
        maxHttpBufferSize: 1e6, // 1MB
    });

    // Redis adapter for horizontal scaling
    try {
        const pubClient = redis.duplicate();
        const subClient = redis.duplicate();

        Promise.all([pubClient.connect(), subClient.connect()])
            .then(() => {
                io.adapter(createAdapter(pubClient, subClient));
                logger.info('✅ Redis adapter initialized for Socket.IO');
            })
            .catch(err => {
                logger.warn('⚠️ Redis adapter not available, using in-memory adapter', { error: err.message });
            });
    } catch (error) {
        logger.warn('⚠️ Redis adapter initialization failed, using in-memory adapter', { error: error.message });
    }

    // Connection event
    io.on('connection', (socket) => {
        logger.debug('🔌 Socket connected', { socketId: socket.id });

        socket.on('disconnect', () => {
            logger.debug('🔌 Socket disconnected', { socketId: socket.id });
        });

        socket.on('error', (error) => {
            logger.error('❌ Socket error', { socketId: socket.id, error });
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error('Socket.IO not initialized. Call initializeSocketIO first.');
    }
    return io;
};

export default {
    initializeSocketIO,
    getIO
};
