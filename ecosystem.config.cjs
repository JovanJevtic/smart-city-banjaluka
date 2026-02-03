module.exports = {
  apps: [
    {
      name: "tcp-server",
      cwd: "/opt/smart-city/apps/tcp-server",
      script: "dist/index.js",
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "worker",
      cwd: "/opt/smart-city/apps/worker",
      script: "dist/index.js",
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
