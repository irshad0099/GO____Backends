module.exports = {
  apps: [
    {
      name: "gomobility-api",

      script: "./src/server.js",

      instances: "max",

      exec_mode: "cluster",

      autorestart: true,

      watch: false,

      max_memory_restart: "500M",

      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
