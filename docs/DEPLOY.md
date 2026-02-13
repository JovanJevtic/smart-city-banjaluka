# Deployment Guide

This guide covers deploying the Smart City Banjaluka platform:

- **PostgreSQL + Redis** on a VPS (e.g. Hetzner, DigitalOcean)
- **Dashboard & Passenger apps** on Vercel (free tier)
- **API, TCP Server, Worker** on the VPS alongside the databases

## Prerequisites

- A VPS with Ubuntu 22.04+ (2GB RAM minimum)
- A domain or the VPS public IP
- Vercel account (free)
- Node.js 20+, pnpm 9.15+

---

## 1. VPS Database Setup

### Install PostgreSQL with PostGIS

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y postgresql postgresql-contrib postgis
```

### Configure PostgreSQL for External Access

1. Set a strong password for the `postgres` user:

```bash
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'YOUR_STRONG_PASSWORD_HERE';"
```

2. Create the database:

```bash
sudo -u postgres psql -c "CREATE DATABASE smartcity;"
sudo -u postgres psql -d smartcity -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

3. Allow external connections — edit `postgresql.conf`:

```bash
sudo nano /etc/postgresql/16/main/postgresql.conf
```

Set:

```
listen_addresses = '*'
```

4. Allow password auth from any IP — edit `pg_hba.conf`:

```bash
sudo nano /etc/postgresql/16/main/pg_hba.conf
```

Add this line at the end:

```
host    smartcity    postgres    0.0.0.0/0    scram-sha-256
```

5. Restart PostgreSQL:

```bash
sudo systemctl restart postgresql
```

6. Open port 5432 in your firewall:

```bash
sudo ufw allow 5432/tcp
```

Your `DATABASE_URL` will be:

```
postgresql://postgres:YOUR_STRONG_PASSWORD_HERE@YOUR_VPS_IP:5432/smartcity
```

### Install Redis

```bash
sudo apt install -y redis-server
```

Edit `/etc/redis/redis.conf` and set a password:

```
requirepass YOUR_REDIS_PASSWORD
```

Restart Redis:

```bash
sudo systemctl restart redis
```

### Push the Database Schema

From your local machine (or the VPS), with `DATABASE_URL` set:

```bash
pnpm db:push
```

Optionally seed the database:

```bash
cd packages/database && pnpm db:seed
```

---

## 2. Deploy Backend Services on VPS

Clone the repo on the VPS and install dependencies:

```bash
git clone <your-repo-url> /opt/smart-city
cd /opt/smart-city
pnpm install
pnpm build
```

Create `/opt/smart-city/.env` with production values:

```env
DATABASE_URL=postgresql://postgres:YOUR_STRONG_PASSWORD_HERE@localhost:5432/smartcity
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=YOUR_REDIS_PASSWORD
TCP_PORT=5000
TCP_HOST=0.0.0.0
SOCKET_TIMEOUT=300000
CLEANUP_INTERVAL=60000
ENABLE_QUEUE=true
API_PORT=3000
JWT_SECRET=GENERATE_A_RANDOM_SECRET
JWT_EXPIRES_IN=7d
LOG_LEVEL=info
NODE_ENV=production
```

### Run with systemd (recommended)

Create a service file for each backend app. Example for the API (`/etc/systemd/system/smartcity-api.service`):

```ini
[Unit]
Description=Smart City API
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/smart-city
ExecStart=/usr/bin/node apps/api/dist/index.js
EnvironmentFile=/opt/smart-city/.env
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Repeat for `smartcity-tcp-server` (ExecStart: `apps/tcp-server/dist/index.js`) and `smartcity-worker` (ExecStart: `apps/worker/dist/index.js`).

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable smartcity-api smartcity-tcp-server smartcity-worker
sudo systemctl start smartcity-api smartcity-tcp-server smartcity-worker
```

---

## 3. Deploy Dashboard on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import your Git repository.
2. Configure the project:
   - **Root Directory**: `apps/dashboard`
   - **Framework Preset**: Next.js (auto-detected)
   - **Build Command**: leave default (uses `vercel.json`)
   - **Install Command**: leave default (uses `vercel.json`)
3. Add environment variables:
   - `DATABASE_URL` = `postgresql://postgres:YOUR_STRONG_PASSWORD_HERE@YOUR_VPS_IP:5432/smartcity`
4. Click **Deploy**.

The `vercel.json` in `apps/dashboard` handles running `pnpm turbo build --filter=@smart-city/dashboard` so that workspace dependencies (`@smart-city/database`, `@smart-city/shared`) are built first.

---

## 4. Deploy Passenger App on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import the **same** Git repository again (as a separate project).
2. Configure the project:
   - **Root Directory**: `apps/passenger`
   - **Framework Preset**: Next.js (auto-detected)
   - **Build Command**: leave default (uses `vercel.json`)
   - **Install Command**: leave default (uses `vercel.json`)
3. Add environment variables:
   - `DATABASE_URL` = `postgresql://postgres:YOUR_STRONG_PASSWORD_HERE@YOUR_VPS_IP:5432/smartcity`
4. Click **Deploy**.

---

## 5. Local Development

Start the databases with Docker:

```bash
docker compose up -d
```

This starts PostgreSQL (port 5432) and Redis (port 6379).

Push the schema and seed data:

```bash
pnpm db:push
cd packages/database && pnpm db:seed
```

Run all apps in dev mode:

```bash
pnpm dev
```

This starts:

| Service    | URL                      |
|------------|--------------------------|
| Dashboard  | http://localhost:3100     |
| Passenger  | http://localhost:3200     |
| API        | http://localhost:3000     |
| TCP Server | localhost:5000 (TCP)     |
| Worker     | (background process)     |

---

## 6. Updating / Redeploying

### Vercel (Dashboard & Passenger)

Push to your main branch. Vercel auto-deploys on every push.

To trigger a manual redeploy from the Vercel dashboard: **Deployments > ... > Redeploy**.

### VPS (API, TCP Server, Worker)

```bash
cd /opt/smart-city
git pull
pnpm install
pnpm build
sudo systemctl restart smartcity-api smartcity-tcp-server smartcity-worker
```

### Database Migrations

After schema changes:

```bash
pnpm db:push
```

This applies Drizzle schema changes to the production database. Make sure `DATABASE_URL` points to production when running against the production DB.
