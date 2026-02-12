#!/bin/bash
# Smart City Banja Luka — Server Setup Script
# Run once on a fresh Ubuntu 22.04+ server

set -euo pipefail

echo "=== Smart City Server Setup ==="

# System packages
echo "Installing system packages..."
apt-get update
apt-get install -y curl git nginx certbot python3-certbot-nginx ufw

# Node.js 20
if ! command -v node &> /dev/null; then
  echo "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# pnpm
if ! command -v pnpm &> /dev/null; then
  echo "Installing pnpm..."
  npm install -g pnpm@9
fi

# PM2
if ! command -v pm2 &> /dev/null; then
  echo "Installing PM2..."
  npm install -g pm2
fi

# PM2 log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true

# Firewall
echo "Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 5000/tcp  # TCP server for Teltonika devices
echo "y" | ufw enable

# Create directories
mkdir -p /opt/smart-city/backups/db
mkdir -p /opt/smart-city/logs

# Cron jobs
echo "Setting up cron jobs..."
CRON_FILE="/etc/cron.d/smart-city"
cat > "$CRON_FILE" << 'CRON'
# Smart City Banja Luka — Scheduled Tasks
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Database backup (daily at 2:00 AM)
0 2 * * * root /opt/smart-city/scripts/backup-db.sh >> /opt/smart-city/logs/backup.log 2>&1

# Health check (every 5 minutes)
*/5 * * * * root /opt/smart-city/scripts/health-check.sh >> /opt/smart-city/logs/health.log 2>&1

# Database vacuum (weekly on Sunday at 4:00 AM)
0 4 * * 0 root psql -h localhost -U postgres smartcity -c "VACUUM ANALYZE telemetry_records, alerts, device_daily_stats;" >> /opt/smart-city/logs/vacuum.log 2>&1
CRON
chmod 644 "$CRON_FILE"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Clone repo:      git clone <repo> /opt/smart-city"
echo "  2. Copy env:        cp .env.example .env && nano .env"
echo "  3. Install deps:    cd /opt/smart-city && pnpm install"
echo "  4. Build:           pnpm turbo build"
echo "  5. Push DB schema:  cd packages/database && npx drizzle-kit push"
echo "  6. Start services:  pm2 start ecosystem.config.cjs && pm2 save"
echo "  7. Setup Nginx:     cp deploy/nginx.conf /etc/nginx/sites-available/smart-city"
echo "                      ln -s /etc/nginx/sites-available/smart-city /etc/nginx/sites-enabled/"
echo "                      nginx -t && systemctl reload nginx"
echo "  8. SSL:             certbot --nginx -d dashboard.smartcity-bl.com -d api.smartcity-bl.com"
echo "  9. Startup:         pm2 startup && pm2 save"
