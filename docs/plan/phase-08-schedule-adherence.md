# Phase 8: Schedule & Adherence Engine

**Priority:** 🔴 Critical — needed for passenger ETAs & deviation alerts
**Effort:** 4-5 days
**Dependencies:** Phase 7 (routes and stops in DB)

---

## Goal

Build the real-time engine that:
1. Matches GPS positions to routes (knows which bus is on which route)
2. Predicts arrival times at upcoming stops
3. Detects schedule deviations and route deviations
4. Feeds real-time data to passenger app and GTFS-RT

---

## Architecture

```
Telemetry Record (from Worker)
        │
        ▼
┌─────────────────────────────┐
│  Route Matching Engine       │
│  "Which route is this bus?"  │
│                              │
│  1. GPS → nearest route      │
│     segment (PostGIS)        │
│  2. Heading comparison       │
│  3. Historical context       │
│     (last known route)       │
│  4. Route assignment check   │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  Progress Calculator         │
│  "Where on the route?"       │
│                              │
│  1. Snap GPS to route line   │
│  2. Calculate distance along │
│     route from start         │
│  3. Determine last/next stop │
│  4. Calculate % complete     │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  ETA Predictor               │
│  "When at next stops?"       │
│                              │
│  1. Remaining distance to    │
│     each upcoming stop       │
│  2. Historical avg speed     │
│     per segment              │
│  3. Current speed factor     │
│  4. Dwell time at stops      │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  Adherence Checker           │
│  "On time? On route?"        │
│                              │
│  1. Compare position vs      │
│     expected schedule        │
│  2. Detect route deviation   │
│     (distance from route >   │
│     threshold)               │
│  3. Generate alerts          │
└──────────┬──────────────────┘
           │
           ├──► Redis (cache ETAs, publish updates)
           ├──► PostgreSQL (save predictions, alerts)
           └──► WebSocket (broadcast to dashboard/passengers)
```

---

## Database Schema Changes

### 8.1 Modify `devices` table

```typescript
// Add to devices schema
assignedRouteId: text('assigned_route_id'),     // Currently assigned route
currentDirection: directionEnum('current_direction'),
currentStopSequence: integer('current_stop_sequence'),  // Last passed stop
scheduleAdherenceSeconds: integer('schedule_adherence_seconds'),  // + = late, - = early
routeMatchConfidence: doublePrecision('route_match_confidence'),  // 0.0 - 1.0
lastMatchedAt: timestamp('last_matched_at', { withTimezone: true }),
```

### 8.2 New `schedule_entries` table (GTFS-compatible stop_times)

The existing `schedules` table only stores departure times. We need per-stop timing.

```typescript
export const scheduleEntries = pgTable('schedule_entries', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  scheduleId: text('schedule_id').notNull().references(() => schedules.id),
  stopId: text('stop_id').notNull().references(() => stops.id),
  sequence: integer('sequence').notNull(),
  arrivalOffset: integer('arrival_offset').notNull(),   // seconds from departure
  departureOffset: integer('departure_offset').notNull(),
  // e.g. Route 1 departs 05:25, stop 5 arrival_offset = 720 (12 min later)
}, (table) => [
  index('schedule_entries_schedule_idx').on(table.scheduleId),
  unique('schedule_entries_schedule_stop').on(table.scheduleId, table.stopId, table.sequence),
])
```

### 8.3 New `eta_predictions` table

```typescript
export const etaPredictions = pgTable('eta_predictions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  deviceId: text('device_id').notNull(),
  routeId: text('route_id').notNull(),
  stopId: text('stop_id').notNull(),
  direction: directionEnum('direction').notNull(),
  predictedArrival: timestamp('predicted_arrival', { withTimezone: true }).notNull(),
  scheduledArrival: timestamp('scheduled_arrival', { withTimezone: true }),
  delaySeconds: integer('delay_seconds'),
  distanceRemaining: doublePrecision('distance_remaining'),  // meters
  confidence: doublePrecision('confidence'),  // 0.0 - 1.0
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('eta_predictions_stop_idx').on(table.stopId, table.predictedArrival),
  index('eta_predictions_device_idx').on(table.deviceId),
])
```

### 8.4 New `segment_speeds` table (historical speed data)

Used for ETA prediction accuracy improvement over time.

```typescript
export const segmentSpeeds = pgTable('segment_speeds', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  routeId: text('route_id').notNull(),
  direction: directionEnum('direction').notNull(),
  fromStopSequence: integer('from_stop_sequence').notNull(),
  toStopSequence: integer('to_stop_sequence').notNull(),
  hourOfDay: integer('hour_of_day').notNull(),    // 0-23
  dayType: text('day_type').notNull(),             // 'weekday' | 'saturday' | 'sunday'
  avgSpeedKmh: doublePrecision('avg_speed_kmh').notNull(),
  sampleCount: integer('sample_count').default(0).notNull(),
  avgDwellTimeSeconds: integer('avg_dwell_time_seconds').default(30),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  unique('segment_speeds_unique').on(
    table.routeId, table.direction, table.fromStopSequence,
    table.toStopSequence, table.hourOfDay, table.dayType
  ),
])
```

### 8.5 New `schedule_exceptions` table

For holidays, special events, service changes.

```typescript
export const scheduleExceptions = pgTable('schedule_exceptions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  routeId: text('route_id'),              // null = all routes
  date: date('date').notNull(),
  exceptionType: text('exception_type').notNull(),  // 'NO_SERVICE' | 'MODIFIED' | 'EXTRA'
  description: text('description'),
  modifiedScheduleId: text('modified_schedule_id'), // references schedule for MODIFIED type
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
```

---

## Implementation Steps

### Step 8.1 — Route Matching Service (1 day)

**File:** `apps/worker/src/services/route-matcher.ts`

**Algorithm: GPS-to-Route Matching**

```typescript
interface RouteMatch {
  routeId: string
  direction: 'OUTBOUND' | 'INBOUND'
  confidence: number           // 0.0 - 1.0
  distanceFromRoute: number    // meters
  distanceAlongRoute: number   // meters from start
  nearestStopSequence: number  // last passed stop
  nextStopSequence: number
}

async function matchGpsToRoute(
  lat: number, lng: number, heading: number,
  deviceId: string  // for historical context
): Promise<RouteMatch | null>
```

**Matching strategy (multi-factor):**

1. **Proximity filter** — find all routes within 100m of GPS point
   - Use cached route geometries (load on worker startup)
   - Point-to-polyline distance using iterative segment check
   - Prune routes > 100m away

2. **Heading filter** — compare GPS heading with route segment heading
   - Calculate bearing of nearest route segment
   - Accept if |heading_diff| < 45° (accounts for curves)
   - This also determines direction (OUTBOUND vs INBOUND)

3. **Assignment priority** — if device has `assignedRouteId` via route_assignments table, boost that route's score

4. **Historical continuity** — if device was on route X 30 seconds ago, and route X is still within 100m, prefer route X (avoid route flickering)

5. **Scoring:** `score = (1 / distance) * heading_factor * assignment_bonus * continuity_bonus`

6. **Confidence:** Based on distance and heading match
   - < 20m + heading match → 0.95
   - < 50m + heading match → 0.80
   - < 100m → 0.50
   - > 100m → no match

**Performance optimization:**
- Cache all route geometries in memory (29 routes × 2 directions = ~58 polylines)
- Rebuild cache every 5 minutes or on route change
- R-tree spatial index for quick proximity lookup (use `rbush` npm package)

### Step 8.2 — Progress Calculator (0.5 day)

**File:** `apps/worker/src/services/progress-calculator.ts`

Given a route match, calculate:
1. **Distance along route** — project GPS point onto route polyline, measure distance from start
2. **Last stop** — find the route_stop with greatest `distanceFromStart` that is ≤ distance along route
3. **Next stop** — the stop after last stop
4. **Progress percent** — `distanceAlongRoute / totalRouteDistance * 100`

### Step 8.3 — ETA Predictor (1 day)

**File:** `apps/worker/src/services/eta-predictor.ts`

**Algorithm:**

For each upcoming stop (next stop through terminal):

```
ETA(stop) = now
  + time_to_next_stop
  + Σ (segment_travel_time + dwell_time) for remaining segments

segment_travel_time = segment_distance / estimated_speed

estimated_speed = weighted average of:
  - Historical avg speed for this segment at this hour/day (from segment_speeds)  weight: 0.6
  - Current bus speed (from telemetry)                                            weight: 0.3
  - Route-wide average speed                                                      weight: 0.1

dwell_time = historical avg dwell time at each stop (default 30s)
```

**Output:** Array of `{ stopId, stopName, eta: Date, scheduledArrival: Date | null, delaySeconds }` for each upcoming stop

**Caching:**
- Store ETAs in Redis: `eta:{routeId}:{direction}:{deviceId}` (TTL 60s)
- Store per-stop ETAs: `stop:{stopId}:etas` (sorted set by ETA timestamp)
- Publish to Redis channel: `eta:updates`

### Step 8.4 — Adherence Checker (0.5 day)

**File:** `apps/worker/src/services/adherence-checker.ts`

**Schedule adherence:**
1. Find the closest scheduled trip for this route/direction/time
2. Compare current progress vs expected progress
3. Calculate delay: `actual_arrival - scheduled_arrival` at last stop

**Classification:**
- On time: |delay| < 120s (2 min)
- Slightly late: 120s < delay < 300s (2-5 min)
- Late: 300s < delay < 600s (5-10 min)
- Very late: delay > 600s (10+ min)
- Early: delay < -120s

**Route deviation detection:**
1. If `distanceFromRoute > 200m` for more than 60 seconds → ROUTE_DEVIATION alert
2. If bus hasn't moved > 100m in 10 minutes while on route → possible breakdown or traffic jam

### Step 8.5 — Worker Integration (0.5 day)

**Modify:** `apps/worker/src/processors/telemetry.ts`

After saving telemetry record, add:
```typescript
// After existing telemetry processing...
const match = await routeMatcher.matchGpsToRoute(lat, lng, heading, deviceId)
if (match) {
  await progressCalculator.updateProgress(deviceId, match)
  await etaPredictor.predictETAs(deviceId, match)
  await adherenceChecker.check(deviceId, match)

  // Update device record
  await db.update(devices).set({
    assignedRouteId: match.routeId,
    currentDirection: match.direction,
    currentStopSequence: match.nearestStopSequence,
    routeMatchConfidence: match.confidence,
    lastMatchedAt: new Date(),
  }).where(eq(devices.id, deviceId))

  // Publish for real-time consumers
  await redis.publish('eta:updates', JSON.stringify({
    deviceId, routeId: match.routeId, direction: match.direction,
    etas: predictedETAs,
  }))
}
```

### Step 8.6 — Historical Speed Learning (0.5 day)

**New BullMQ job:** `learn_segment_speeds`

Triggered after each telemetry record when bus is matched to a route:
- If bus has passed from stop N to stop N+1:
  - Calculate speed: `segment_distance / time_between_stops`
  - Upsert into `segment_speeds` with running average:
    ```
    new_avg = (old_avg * sample_count + new_speed) / (sample_count + 1)
    ```
  - Track dwell time at stops (time between arrival at stop and departure)

This data improves ETA predictions over time.

### Step 8.7 — API Endpoints (0.5 day)

**Fastify API (apps/api):**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/routes/:id/vehicles` | Active vehicles on a route with positions and ETAs |
| GET | `/api/stops/:id/arrivals` | Upcoming bus arrivals at a stop (from eta_predictions) |
| GET | `/api/vehicles/:id/progress` | Current route progress + upcoming stops |
| GET | `/api/adherence/summary` | Fleet-wide schedule adherence stats |

**Dashboard API routes (apps/dashboard):**

| File | Endpoint | Description |
|------|----------|-------------|
| `api/routes/[id]/vehicles/route.ts` | GET | Vehicles on route |
| `api/stops/[id]/arrivals/route.ts` | GET | Stop arrival predictions |

### Step 8.8 — Schedule Data Entry (0.5 day)

Since no digital schedule data exists, provide two entry paths:

1. **Dashboard Schedule Editor** — simple form to enter departure times per route
   - Select route → Select direction → Add departure times for each day type
   - Auto-generate `schedule_entries` based on average segment times (from segment_speeds or equal distribution)

2. **busbanjaluka.com scraper** (optional)
   - Script to extract schedule PDFs/HTML from busbanjaluka.com
   - Parse departure times and populate `schedules` table
   - File: `packages/database/src/scripts/scrape-schedules.ts`

---

## Redis Cache Structure

```
route:{routeId}:geometry      — Cached route polylines (loaded at startup)
device:{deviceId}:route       — Current route match { routeId, direction, confidence }
eta:{routeId}:{direction}     — All vehicle ETAs for this route direction
stop:{stopId}:etas            — Sorted set of upcoming arrivals at this stop
adherence:{deviceId}          — Current schedule adherence data
```

---

## Verification Checklist

- [ ] Route matcher correctly identifies which route a bus is on
- [ ] Direction detection (OUTBOUND/INBOUND) works based on heading
- [ ] Progress calculation correctly identifies last/next stop
- [ ] ETA predictions are within ±3 minutes for nearby stops
- [ ] Route deviation alert fires when bus goes off-route > 200m
- [ ] Schedule adherence calculates delay correctly
- [ ] Historical speed data accumulates over time
- [ ] ETAs published to Redis for real-time consumers
- [ ] API endpoints return correct data
- [ ] Route flickering doesn't happen (bus doesn't rapidly switch between routes)

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Route match latency | < 5ms per telemetry point |
| ETA prediction latency | < 20ms per vehicle |
| ETA accuracy (next stop) | ±2 minutes |
| ETA accuracy (5 stops ahead) | ±5 minutes |
| Route match accuracy | > 90% correct |
| Max memory for route cache | < 50MB |
