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
    {
      name: "api",
      cwd: "/opt/smart-city/apps/api",
      script: "dist/index.js",
      node_args: "--env-file=/opt/smart-city/.env",
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
        API_PORT: "3000",
      },
    },
    {
      name: "dashboard",
      cwd: "/opt/smart-city/apps/dashboard",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3100",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/smartcity",
      },
    },
  ],
};
