#!/bin/bash
# Smart City Banja Luka — Database Backup Script
# Cron: 0 2 * * * /opt/smart-city/scripts/backup-db.sh >> /opt/smart-city/logs/backup.log 2>&1

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/smart-city/backups/db}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-smartcity}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="smartcity_${DATE}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting database backup..."

# Dump with compression
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_DIR/$FILENAME"

SIZE=$(du -h "$BACKUP_DIR/$FILENAME" | cut -f1)
echo "[$(date)] Backup created: $FILENAME ($SIZE)"

# Clean old backups (keep last N days)
find "$BACKUP_DIR" -name "smartcity_*.sql.gz" -mtime +$RETENTION_DAYS -delete
REMAINING=$(ls -1 "$BACKUP_DIR"/smartcity_*.sql.gz 2>/dev/null | wc -l)
echo "[$(date)] Cleanup complete. Backups remaining: $REMAINING"
