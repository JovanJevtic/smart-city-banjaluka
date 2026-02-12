#!/bin/bash
# Smart City Banja Luka — Health Check Script
# Cron: */5 * * * * /opt/smart-city/scripts/health-check.sh >> /opt/smart-city/logs/health.log 2>&1

set -uo pipefail

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
ERRORS=0

check() {
  local name="$1"
  local cmd="$2"
  if eval "$cmd" > /dev/null 2>&1; then
    echo "[$TIMESTAMP] OK: $name"
  else
    echo "[$TIMESTAMP] FAIL: $name"
    ERRORS=$((ERRORS + 1))
  fi
}

# API server
check "API Server" "curl -sf http://localhost:3000/health"

# Dashboard
check "Dashboard" "curl -sf http://localhost:3100"

# Passenger app
check "Passenger App" "curl -sf http://localhost:3200"

# TCP Server (port 5000)
check "TCP Server" "nc -z localhost 5000"

# PostgreSQL
check "PostgreSQL" "pg_isready -h localhost -p 5432 -q"

# Redis
check "Redis" "redis-cli ping"

# PM2 processes
PM2_STATUS=$(pm2 jlist 2>/dev/null)
if [ -n "$PM2_STATUS" ]; then
  STOPPED=$(echo "$PM2_STATUS" | python3 -c "import sys,json; data=json.load(sys.stdin); print(sum(1 for p in data if p.get('pm2_env',{}).get('status') != 'online'))" 2>/dev/null || echo "0")
  if [ "$STOPPED" -gt 0 ]; then
    echo "[$TIMESTAMP] WARN: $STOPPED PM2 processes not online"
    ERRORS=$((ERRORS + 1))
  else
    echo "[$TIMESTAMP] OK: All PM2 processes online"
  fi
fi

# Disk space check (warn if > 90%)
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | tr -d '%')
if [ "$DISK_USAGE" -gt 90 ]; then
  echo "[$TIMESTAMP] WARN: Disk usage at ${DISK_USAGE}%"
  ERRORS=$((ERRORS + 1))
else
  echo "[$TIMESTAMP] OK: Disk usage at ${DISK_USAGE}%"
fi

if [ "$ERRORS" -gt 0 ]; then
  echo "[$TIMESTAMP] SUMMARY: $ERRORS issue(s) detected"
  exit 1
fi

echo "[$TIMESTAMP] SUMMARY: All checks passed"
