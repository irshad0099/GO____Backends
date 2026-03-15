import pkg from 'pg';
const { Pool } = pkg;
import { ENV } from '../../config/envConfig.js';
import logger from '../../core/logger/logger.js';

class Database {
    constructor() {
        this.pool = null;
        this.connected = false;
    }

    async connect() {
        try {
            const dbConfig = {
                user: ENV.DB_USER,
                host: ENV.DB_HOST,
                database: ENV.DB_NAME,
                password: ENV.DB_PASSWORD,
                port: ENV.DB_PORT,
                max: ENV.DB_POOL_MAX || 20,
                idleTimeoutMillis: ENV.DB_POOL_IDLE || 30000,
                connectionTimeoutMillis: ENV.DB_POOL_CONNECTION || 5000,
            };

            console.log('🔌 Connecting to database with config:', {
                host: dbConfig.host,
                database: dbConfig.database,
                user: dbConfig.user,
                port: dbConfig.port
            });

            this.pool = new Pool(dbConfig);

            // Test connection
            const client = await this.pool.connect();
            this.connected = true;
            console.log('✅ PostgreSQL connected successfully');
            logger.info('✅ PostgreSQL connected successfully');
            client.release();

            this.pool.on('error', (err) => {
                console.error('Unexpected PostgreSQL pool error:', err);
                logger.error('Unexpected PostgreSQL pool error:', err);
                this.connected = false;
            });

            return this.pool;
        } catch (error) {
            console.error('❌ PostgreSQL connection failed:', error.message);
            logger.error('❌ PostgreSQL connection failed:', error);
            this.connected = false;
            throw error;
        }
    }

    async query(text, params) {
        // IMPORTANT: Ensure pool is initialized
        if (!this.pool) {
            console.error('❌ Database pool not initialized. Call connect() first.');
            throw new Error('Database pool not initialized');
        }
        
        try {
            const start = Date.now();
            const result = await this.pool.query(text, params);
            const duration = Date.now() - start;

            if (duration > 1000) {
                logger.warn('Slow query:', { text, duration, rows: result.rowCount });
            }

            return result;
        } catch (error) {
            logger.error('Database query error:', { text, params, error: error.message });
            throw error;
        }
    }

    async getClient() {
        if (!this.pool) {
            throw new Error('Database pool not initialized');
        }
        
        try {
            const client = await this.pool.connect();
            return client;
        } catch (error) {
            logger.error('Error getting database client:', error);
            throw error;
        }
    }

    async disconnect() {
        try {
            if (this.pool) {
                await this.pool.end();
                this.connected = false;
                console.log('PostgreSQL disconnected');
                logger.info('PostgreSQL disconnected');
            }
        } catch (error) {
            console.error('Error disconnecting PostgreSQL:', error);
            logger.error('Error disconnecting PostgreSQL:', error);
            throw error;
        }
    }
}

// Create and export a single instance
export const db = new Database();

// Also export pool for backward compatibility
export const pool = db.pool;