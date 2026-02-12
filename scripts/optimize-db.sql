-- Smart City Banja Luka — Database Optimization
-- Run manually or schedule weekly: psql -h localhost -U postgres smartcity -f optimize-db.sql

-- Covering index for common telemetry query (device + time range)
CREATE INDEX IF NOT EXISTS idx_telemetry_device_time_covering
ON telemetry_records (device_id, timestamp DESC)
INCLUDE (latitude, longitude, speed, heading);

-- Index for recent telemetry lookups
CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp_desc
ON telemetry_records (timestamp DESC);

-- Partial index for unacknowledged alerts
CREATE INDEX IF NOT EXISTS idx_alerts_unacknowledged
ON alerts (created_at DESC)
WHERE acknowledged = false;

-- Index for active devices
CREATE INDEX IF NOT EXISTS idx_devices_online
ON devices (is_online)
WHERE is_online = true;

-- Index for ETA predictions by stop
CREATE INDEX IF NOT EXISTS idx_eta_predictions_stop
ON eta_predictions (stop_id, predicted_arrival_time);

-- Index for device daily stats aggregation
CREATE INDEX IF NOT EXISTS idx_daily_stats_device_date
ON device_daily_stats (device_id, date DESC);

-- Index for schedule lookups
CREATE INDEX IF NOT EXISTS idx_schedules_route_active
ON schedules (route_id)
WHERE is_active = true;

-- Vacuum and analyze high-volume tables
VACUUM ANALYZE telemetry_records;
VACUUM ANALYZE alerts;
VACUUM ANALYZE device_daily_stats;
VACUUM ANALYZE eta_predictions;

-- Update table statistics for query planner
ANALYZE devices;
ANALYZE routes;
ANALYZE stops;
ANALYZE route_stops;
ANALYZE schedules;
