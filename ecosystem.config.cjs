module.exports = {
  apps: [
    {
      name: "tcp-server",
      cwd: "/opt/smart-city/apps/tcp-server",
      script: "dist/index.js",
      node_args: "--env-file=/opt/smart-city/.env",
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
      node_args: "--env-file=/opt/smart-city/.env",
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
