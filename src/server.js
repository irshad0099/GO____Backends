


import app from './app.js';
import { ENV } from './config/envConfig.js';
import { db } from './infrastructure/database/postgres.js';

const PORT = ENV.PORT || 5000;

console.log('\n🔍 DEBUGGING MODE');
console.log('='.repeat(50));
console.log('ENV Variables:');
console.log(`  NODE_ENV: ${ENV.NODE_ENV}`);
console.log(`  PORT: ${PORT}`);
console.log(`  API_PREFIX: '${ENV.API_PREFIX}'`);
console.log('='.repeat(50));

// IMPORTANT: Connect to database BEFORE starting server
const startServer = async () => {
    try {
        // Connect to database
        await db.connect();
        
        // Now start the server
        const server = app.listen(PORT, () => {
            console.log(`\n🚀 Server started on http://localhost:${PORT}`);
            
            // Log registered routes
            setTimeout(() => {
                console.log('\n📋 Registered Routes:');
                console.log('='.repeat(50));
                
                if (app._router && app._router.stack) {
                    let routeCount = 0;
                    
                    app._router.stack.forEach((layer) => {
                        if (layer.route) {
                            routeCount++;
                            const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
                            console.log(`  ${methods.padEnd(8)} ${layer.route.path}`);
                        } else if (layer.name === 'router' && layer.handle.stack) {
                            layer.handle.stack.forEach((handler) => {
                                if (handler.route) {
                                    routeCount++;
                                    const methods = Object.keys(handler.route.methods).join(', ').toUpperCase();
                                    console.log(`  ${methods.padEnd(8)} ${handler.route.path}`);
                                }
                            });
                        }
                    });
                    
                    console.log(`\n✅ Total ${routeCount} routes registered`);
                }
                console.log('='.repeat(50));
            }, 500);
        });

        // Graceful shutdown
        const gracefulShutdown = async () => {
            console.log('\n📥 Received shutdown signal...');
            
            server.close(async () => {
                console.log('✅ HTTP server closed');
                await db.disconnect();
                console.log('👋 Graceful shutdown completed');
                process.exit(0);
            });

            setTimeout(() => {
                console.error('❌ Forcefully shutting down');
                process.exit(1);
            }, 10000);
        };

        process.on('SIGTERM', gracefulShutdown);
        process.on('SIGINT', gracefulShutdown);

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();