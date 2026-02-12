# Phase 14: Infrastructure & Operations

**Priority:** 🟢 Medium
**Effort:** 2-3 days
**Dependencies:** None (can run in parallel with any phase)

---

## Goal

Harden the system for production: monitoring, alerting, backups, security, performance optimization, and CI/CD pipeline.

---

## Current State

- Single server deployment via PM2
- PostgreSQL + Redis on same server (Docker Compose)
- No monitoring beyond PM2 process status
- No automated backups
- No CI/CD pipeline
- No SSL (assumed behind reverse proxy)
- No rate limiting on dashboard (API has basic rate limit)

---

## 14.1 — Monitoring & Health Checks

### Application Monitoring

**Tool:** Prometheus-compatible metrics endpoint

**File:** `apps/api/src/plugins/metrics.ts`

```typescript
// GET /metrics (Prometheus format)
// Expose:
// - http_requests_total{method, route, status}
// - http_request_duration_seconds{method, route}
// - websocket_connections_active
// - bullmq_queue_size{queue}
// - bullmq_queue_completed{queue}
// - bullmq_queue_failed{queue}
// - tcp_connections_active
// - telemetry_records_received_total
// - alerts_generated_total{type, severity}
// - database_pool_active
// - database_pool_idle
// - redis_connected
```

**Dashboard health page:** `/admin/health`
- System uptime
- Process memory/CPU per PM2 app
- Database pool stats
- Redis connection status
- Queue depths and processing rates
- Last telemetry received timestamp
- Active device count

### Uptime Monitoring

**External monitoring** (cron job or external service):
```bash
# Check API health
curl -f http://localhost:3000/health || alert "API down"

# Check dashboard
curl -f http://localhost:3100 || alert "Dashboard down"

# Check TCP server (simple TCP connect)
nc -z localhost 5000 || alert "TCP server down"

# Check PostgreSQL
pg_isready -h localhost -p 5432 || alert "PostgreSQL down"

# Check Redis
redis-cli ping || alert "Redis down"
```

### Log Aggregation

**Current:** PM2 log files (`~/.pm2/logs/`)

**Improvement:**
- Structured JSON logging (Pino already does this)
- Log rotation: `pm2 install pm2-logrotate` (max 10MB, keep 30 days)
- Optional: ship logs to file for analysis
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true
```

---

## 14.2 — Database Management

### Automated Backups

**Script:** `/opt/smart-city/scripts/backup-db.sh`

```bash
#!/bin/bash
BACKUP_DIR=/opt/smart-city/backups/db
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="smartcity_${DATE}.sql.gz"

mkdir -p $BACKUP_DIR

# Dump with compression
pg_dump -h localhost -U postgres smartcity | gzip > "$BACKUP_DIR/$FILENAME"

# Keep last 30 backups
ls -t $BACKUP_DIR/smartcity_*.sql.gz | tail -n +31 | xargs -r rm

echo "Backup created: $FILENAME ($(du -h "$BACKUP_DIR/$FILENAME" | cut -f1))"
```

**Cron schedule:**
```bash
# Daily backup at 2:00 AM
0 2 * * * /opt/smart-city/scripts/backup-db.sh >> /opt/smart-city/logs/backup.log 2>&1
```

### Database Performance

**Table partitioning** for `telemetry_records` (high-volume table):

```sql
-- Partition by month
ALTER TABLE telemetry_records RENAME TO telemetry_records_old;

CREATE TABLE telemetry_records (
  LIKE telemetry_records_old INCLUDING ALL
) PARTITION BY RANGE (timestamp);

-- Create monthly partitions
CREATE TABLE telemetry_records_2026_01 PARTITION OF telemetry_records
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE telemetry_records_2026_02 PARTITION OF telemetry_records
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
-- etc.

-- Auto-create future partitions via pg_partman extension or cron job
```

**Index optimization:**
```sql
-- Covering index for common telemetry query
CREATE INDEX idx_telemetry_device_time_covering
ON telemetry_records (device_id, timestamp DESC)
INCLUDE (latitude, longitude, speed, heading);

-- Partial index for active alerts
CREATE INDEX idx_alerts_unacknowledged
ON alerts (created_at DESC)
WHERE acknowledged = false;
```

**Connection pooling:**
- Current: pg Pool with 20 connections
- Consider: PgBouncer for connection pooling if scaling beyond 1 API instance

**Vacuum schedule:**
```bash
# Weekly vacuum analyze on high-volume tables
0 4 * * 0 psql -h localhost -U postgres smartcity -c "VACUUM ANALYZE telemetry_records, alerts, device_daily_stats;"
```

---

## 14.3 — Redis Configuration

### Persistence
```
# redis.conf
appendonly yes
appendfsync everysec
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb
```

### Memory Management
```
maxmemory 512mb
maxmemory-policy allkeys-lru
```

### Key Expiration Audit
Ensure all cache keys have TTL:
- `device:{imei}:latest` — 1 hour TTL ✅
- `devices:positions` — no TTL (geo index, updated continuously) ✅
- `gtfs-rt:*` — 5-60s TTL
- `eta:*` — 60s TTL
- `stop:*:etas` — 60s TTL

---

## 14.4 — Security Hardening

### Network Security
```bash
# Firewall rules (ufw)
ufw default deny incoming
ufw allow ssh
ufw allow 80/tcp       # HTTP (redirect to HTTPS)
ufw allow 443/tcp      # HTTPS
ufw allow 5000/tcp     # TCP server (Teltonika devices)
# Do NOT expose 3000, 3100, 3200, 5432, 6379 directly
```

### Reverse Proxy (Nginx)

```nginx
# /etc/nginx/sites-available/smart-city

# Dashboard
server {
    listen 443 ssl;
    server_name dashboard.smartcity-bl.com;
    ssl_certificate /etc/letsencrypt/live/smartcity-bl.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/smartcity-bl.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3100;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}

# API
server {
    listen 443 ssl;
    server_name api.smartcity-bl.com;
    ssl_certificate /etc/letsencrypt/live/smartcity-bl.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/smartcity-bl.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}

# Passenger App
server {
    listen 443 ssl;
    server_name bus.banjaluka.ba;
    ssl_certificate /etc/letsencrypt/live/banjaluka.ba/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/banjaluka.ba/privkey.pem;

    location / {
        proxy_pass http://localhost:3200;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
```

### SSL Certificates
```bash
certbot --nginx -d dashboard.smartcity-bl.com -d api.smartcity-bl.com -d bus.banjaluka.ba
```

### Environment Security
- [ ] Move `.env` secrets out of git
- [ ] Use strong JWT_SECRET (256-bit random)
- [ ] Use strong PostgreSQL password
- [ ] Enable Redis AUTH if exposed
- [ ] Set `NODE_ENV=production` in PM2

### API Security
- [ ] Rate limiting on all endpoints (already on Fastify API, add to dashboard/passenger)
- [ ] CORS configuration (restrict to known domains)
- [ ] Helmet headers (already via Fastify)
- [ ] SQL injection protection (Drizzle ORM handles this)
- [ ] Input validation on all endpoints (Fastify schemas)

---

## 14.5 — Performance Optimization

### Dashboard Performance
- [ ] Implement `React.memo` on heavy components (map, charts)
- [ ] Debounce telemetry updates (batch position updates)
- [ ] Lazy load chart library (dynamic import)
- [ ] Image optimization (Next.js `Image` component)
- [ ] API response caching with SWR/React Query

### API Performance
- [ ] Response compression (gzip/brotli)
- [ ] Database query optimization (EXPLAIN ANALYZE on slow queries)
- [ ] Redis caching for frequently accessed data
- [ ] Pagination on all list endpoints

### TCP Server Performance
- [ ] Connection limit per IP (prevent DoS from rogue devices)
- [ ] Batch database inserts (current: individual, target: batch every 5s)

---

## 14.6 — CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Build & Deploy

on:
  push:
    branches: [master]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo build
      - run: pnpm turbo lint

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to server
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/smart-city
            git pull origin master
            pnpm install --frozen-lockfile
            pnpm turbo build
            pm2 restart all
```

### Pre-deploy Checklist (automated)
1. Build succeeds
2. TypeScript type check passes
3. No lint errors
4. Database migrations are compatible

---

## 14.7 — Disaster Recovery

### Recovery Procedures

**Scenario: Server crash**
1. Provision new server
2. Install dependencies (Node.js 20, pnpm, PostgreSQL 16, Redis 7)
3. Clone repo: `git clone <repo> /opt/smart-city`
4. Restore `.env` from secure backup
5. Restore database: `gunzip -c backup.sql.gz | psql smartcity`
6. `pnpm install && pnpm turbo build`
7. `pm2 start ecosystem.config.cjs && pm2 save`
8. Update DNS if server IP changed

**Scenario: Database corruption**
1. Stop all services: `pm2 stop all`
2. Restore from backup: `pg_restore -c -d smartcity backup.sql.gz`
3. Restart: `pm2 restart all`
4. Verify data integrity

**Scenario: Redis data loss**
- Non-critical: Redis is a cache, not primary storage
- Positions re-populate within 30 seconds as devices send data
- Queue jobs are lost but will re-trigger on next telemetry

---

## 14.8 — Scaling Considerations (Future)

**Current capacity:** Single server handles ~100 devices sending data every 10s

**If scaling needed:**
- Multiple TCP server instances (load balanced by IP hash)
- Multiple API instances (behind Nginx load balancer)
- PgBouncer for database connection pooling
- Redis Cluster for high availability
- Separate database server (dedicated PostgreSQL host)
- CDN for passenger app static assets
- TimescaleDB for time-series telemetry data

---

## Implementation Steps

### Step 14.1 — Monitoring (0.5 day)
- PM2 log rotation setup
- Health check script
- Dashboard health page

### Step 14.2 — Database (0.5 day)
- Backup script + cron
- Index optimization
- Vacuum schedule

### Step 14.3 — Security (0.5 day)
- Firewall rules
- Nginx reverse proxy config
- SSL certificates
- Environment hardening

### Step 14.4 — Performance (0.5 day)
- Response compression
- Query optimization
- Caching strategy

### Step 14.5 — CI/CD (0.5 day)
- GitHub Actions workflow
- Deployment script

---

## Verification Checklist

- [ ] Health check script runs and detects issues
- [ ] PM2 logs rotate and don't fill disk
- [ ] Database backup runs daily at 2 AM
- [ ] Database backup restore verified
- [ ] Nginx reverse proxy serves all apps via HTTPS
- [ ] SSL certificates auto-renew
- [ ] Firewall blocks direct access to internal ports
- [ ] CI/CD pipeline builds and deploys on push
- [ ] Response compression enabled (check headers)
- [ ] Slow queries identified and optimized
