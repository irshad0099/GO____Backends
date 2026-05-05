module.exports = {
    apps: [
        {
            name:         'gomobility',
            script:       'src/server.js',
            instances:    1,            // Production pe 'max' karo (all CPU cores)
            exec_mode:    'fork',       // Production pe 'cluster' karo
            watch:        false,        // Production mein watch OFF
            max_memory_restart: '500M', // 500MB se zyada RAM use kare toh restart

            // Environment variables
            env_development: {
                NODE_ENV: 'development',
                PORT:     5000,
            },
            env_production: {
                NODE_ENV:   'production',
                PORT:       5000,
            },

            // Logs
            error_file:  'logs/pm2-error.log',
            out_file:    'logs/pm2-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',

            // Restart policy
            restart_delay:    5000,   // Crash ke baad 5 sec wait karo
            max_restarts:     10,     // 10 baar se zyada crash kare toh stop
            min_uptime:       '10s',  // 10 sec se kam chale toh crash count karo
        },
    ],
};
