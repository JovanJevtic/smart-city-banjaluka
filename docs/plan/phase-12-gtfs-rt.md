# Phase 12: GTFS-RT Feed & Google Maps Integration

**Priority:** 🟢 Medium
**Effort:** 2-3 days
**Dependencies:** Phase 7 (routes), Phase 8 (ETA predictions)

---

## Goal

1. Generate a **GTFS Static** feed from our route/stop/schedule data
2. Serve a **GTFS Realtime** feed with live vehicle positions and trip updates
3. Register with **Google Maps Transit Partner** so Banja Luka buses appear in Google Maps

---

## GTFS Overview

### GTFS Static (schedule data)

Required files:
| File | Contents | Source |
|------|----------|--------|
| `agency.txt` | Transit agency info | Hard-coded (Pavlovic Turs, Gradski Prevoz) |
| `routes.txt` | Bus routes | `routes` table |
| `stops.txt` | Bus stops | `stops` table |
| `trips.txt` | Individual trips (route + service + direction) | `schedules` table |
| `stop_times.txt` | Arrival/departure at each stop per trip | `schedule_entries` table |
| `calendar.txt` | Service patterns (weekday, saturday, sunday) | Generated |
| `shapes.txt` | Route geometry | `route_shapes` table |

Optional files:
| File | Contents |
|------|----------|
| `calendar_dates.txt` | Exceptions (holidays) from `schedule_exceptions` |
| `feed_info.txt` | Feed metadata, version, dates |
| `frequencies.txt` | Headway-based service (alternative to explicit stop_times) |

### GTFS Realtime (Protocol Buffers)

Three feed types:
| Feed | Contents | Update Rate |
|------|----------|-------------|
| `VehiclePositions` | Live GPS positions of all buses | Every 5-15 seconds |
| `TripUpdates` | Predicted arrival/departure times at stops | Every 15-30 seconds |
| `ServiceAlerts` | Service disruptions, detours | On event |

---

## Architecture

```
┌──────────────────────────────────────────┐
│  GTFS Static Generator (cron/on-demand)  │
│                                          │
│  Routes DB → agency.txt, routes.txt,     │
│              stops.txt, trips.txt,       │
│              stop_times.txt, shapes.txt  │
│              calendar.txt                │
│  Output: /data/gtfs/gtfs-banjaluka.zip   │
└──────────────────┬───────────────────────┘
                   │
┌──────────────────▼───────────────────────┐
│  GTFS-RT Server (Fastify endpoint)       │
│                                          │
│  GET /gtfs-rt/vehicle-positions          │
│  GET /gtfs-rt/trip-updates               │
│  GET /gtfs-rt/service-alerts             │
│  GET /gtfs/static                        │
│                                          │
│  Reads from Redis cache:                 │
│  - Vehicle positions (real-time)         │
│  - ETA predictions (from Phase 8)        │
│  - Active alerts                          │
│  Serializes to Protocol Buffer format    │
└──────────────────────────────────────────┘
                   │
         ┌─────────┼─────────┐
         │         │         │
    Google Maps  Transit   Other
    Transit      Apps      Consumers
    Partner
```

---

## Implementation Steps

### Step 12.1 — Dependencies (0.25 day)

```bash
pnpm --filter @smart-city/api add gtfs-realtime-bindings
# Protocol Buffer library for GTFS-RT
```

Or use raw protobuf:
```bash
pnpm --filter @smart-city/api add protobufjs
```

Download GTFS-RT proto definition:
```bash
curl -o packages/shared/proto/gtfs-realtime.proto \
  https://developers.google.com/transit/gtfs-realtime/gtfs-realtime.proto
```

### Step 12.2 — GTFS Static Generator (1 day)

**File:** `packages/database/src/scripts/generate-gtfs.ts`

**Generates these files:**

#### agency.txt
```csv
agency_id,agency_name,agency_url,agency_timezone,agency_lang,agency_phone
pavlovic,Pavlovic Turs,https://busbanjaluka.com,Europe/Sarajevo,bs,051-244-498
gradski,Gradski Prevoz,https://busbanjaluka.com,Europe/Sarajevo,bs,
autoprevoz,Autoprevoz GS,https://autoprevoz-gs.com,Europe/Sarajevo,bs,
```

#### routes.txt
```csv
route_id,agency_id,route_short_name,route_long_name,route_type,route_color,route_text_color
```
- `route_type`: 3 (bus)
- `route_color`: from OSM `colour` tag
- Map operator to `agency_id`

#### stops.txt
```csv
stop_id,stop_name,stop_lat,stop_lon,wheelchair_boarding
```

#### trips.txt
One trip per schedule entry per direction:
```csv
trip_id,route_id,service_id,direction_id,trip_headsign,shape_id
```
- `service_id`: "weekday", "saturday", "sunday"
- `trip_headsign`: terminal stop name

#### stop_times.txt
```csv
trip_id,arrival_time,departure_time,stop_id,stop_sequence
```
- Times from `schedule_entries` (arrival_offset + departure time)

#### calendar.txt
```csv
service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date
weekday,1,1,1,1,1,0,0,20260101,20261231
saturday,0,0,0,0,0,1,0,20260101,20261231
sunday,0,0,0,0,0,0,1,20260101,20261231
```

#### shapes.txt
```csv
shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence,shape_dist_traveled
```
- From `route_shapes` geometry

**Output:** ZIP file at `/opt/smart-city/data/gtfs/gtfs-banjaluka.zip`

**Trigger:**
- Manual: `pnpm --filter @smart-city/database tsx src/scripts/generate-gtfs.ts`
- API: `POST /api/admin/generate-gtfs` (admin only)
- Scheduled: weekly regeneration via cron job in worker

### Step 12.3 — GTFS-RT Endpoints (1 day)

**File:** `apps/api/src/routes/gtfs-rt.ts`

#### Vehicle Positions Feed

```typescript
// GET /gtfs-rt/vehicle-positions
// Returns: application/x-protobuf

function buildVehiclePositionsFeed(): Uint8Array {
  const message = {
    header: {
      gtfsRealtimeVersion: '2.0',
      incrementality: 'FULL_DATASET',
      timestamp: Math.floor(Date.now() / 1000),
    },
    entity: vehicles.map(v => ({
      id: v.deviceId,
      vehicle: {
        trip: {
          tripId: v.currentTripId,
          routeId: v.routeId,
          directionId: v.direction === 'OUTBOUND' ? 0 : 1,
        },
        position: {
          latitude: v.latitude,
          longitude: v.longitude,
          bearing: v.heading,
          speed: v.speed / 3.6, // km/h → m/s
        },
        currentStopSequence: v.currentStopSequence,
        currentStatus: v.atStop ? 'STOPPED_AT' : 'IN_TRANSIT_TO',
        timestamp: Math.floor(new Date(v.lastSeen).getTime() / 1000),
        vehicle: {
          id: v.deviceId,
          label: v.deviceName || v.imei,
        },
      },
    })),
  }
  return FeedMessage.encode(message).finish()
}
```

**Data source:** Redis cache (`device:{imei}:latest` + route match data)

#### Trip Updates Feed

```typescript
// GET /gtfs-rt/trip-updates

function buildTripUpdatesFeed(): Uint8Array {
  // For each active vehicle matched to a route:
  // - Get ETA predictions for upcoming stops
  // - Build StopTimeUpdate for each stop
  const entity = activeTrips.map(trip => ({
    id: trip.tripId,
    tripUpdate: {
      trip: {
        tripId: trip.tripId,
        routeId: trip.routeId,
        directionId: trip.direction === 'OUTBOUND' ? 0 : 1,
      },
      vehicle: { id: trip.deviceId },
      stopTimeUpdate: trip.etas.map(eta => ({
        stopSequence: eta.sequence,
        stopId: eta.stopId,
        arrival: {
          time: Math.floor(eta.predictedArrival.getTime() / 1000),
          delay: eta.delaySeconds,
        },
      })),
      timestamp: Math.floor(Date.now() / 1000),
    },
  }))
  return FeedMessage.encode({ header, entity }).finish()
}
```

#### Service Alerts Feed

```typescript
// GET /gtfs-rt/service-alerts

function buildServiceAlertsFeed(): Uint8Array {
  // Active alerts that affect routes (ROUTE_DEVIATION, etc.)
  const entity = serviceAlerts.map(alert => ({
    id: alert.id,
    alert: {
      activePeriod: [{
        start: Math.floor(new Date(alert.createdAt).getTime() / 1000),
      }],
      informedEntity: [{
        routeId: alert.routeId,
      }],
      cause: mapAlertCause(alert.type),
      effect: mapAlertEffect(alert.type),
      headerText: {
        translation: [{ text: alert.message, language: 'bs' }],
      },
    },
  }))
  return FeedMessage.encode({ header, entity }).finish()
}
```

#### Static Feed Download

```typescript
// GET /gtfs/static
// Returns: application/zip
// Serves the pre-generated GTFS ZIP file
```

### Step 12.4 — GTFS-RT Caching (0.25 day)

To avoid regenerating Protocol Buffer on every request:
- Cache serialized PB in Redis with 5-second TTL for vehicle positions
- Cache serialized PB in Redis with 15-second TTL for trip updates
- Cache serialized PB in Redis with 60-second TTL for service alerts
- Key: `gtfs-rt:vehicle-positions`, `gtfs-rt:trip-updates`, `gtfs-rt:service-alerts`

### Step 12.5 — Google Maps Transit Partner Registration (0.5 day)

**Process:**
1. Register at `https://partnerdash.google.com/transit`
2. Submit GTFS Static feed URL: `https://api.smartcity-bl.com/gtfs/static`
3. Submit GTFS-RT feed URLs:
   - Vehicle Positions: `https://api.smartcity-bl.com/gtfs-rt/vehicle-positions`
   - Trip Updates: `https://api.smartcity-bl.com/gtfs-rt/trip-updates`
   - Service Alerts: `https://api.smartcity-bl.com/gtfs-rt/service-alerts`
4. Google validates feeds (takes days/weeks)
5. Once approved, Banja Luka buses appear in Google Maps with real-time ETAs

**Requirements:**
- HTTPS endpoint (needs SSL certificate)
- Feeds must be publicly accessible (no auth)
- GTFS Static must be valid (use `gtfs-validator` to check)
- Vehicle positions must update at least every 30 seconds

---

## Validation

```bash
# Validate GTFS Static
npx gtfs-validator /opt/smart-city/data/gtfs/gtfs-banjaluka.zip

# Test GTFS-RT feed
curl -s https://api.smartcity-bl.com/gtfs-rt/vehicle-positions | \
  protoc --decode transit_realtime.FeedMessage gtfs-realtime.proto
```

---

## Verification Checklist

- [ ] GTFS Static ZIP generates with all required files
- [ ] `gtfs-validator` reports no errors
- [ ] Vehicle Positions feed returns valid protobuf
- [ ] Trip Updates feed returns valid protobuf with ETAs
- [ ] Service Alerts feed returns valid protobuf
- [ ] Feeds are publicly accessible (no auth required)
- [ ] Vehicle positions update every 5-15 seconds
- [ ] Feed caching prevents excessive computation
- [ ] Google Transit Partner application submitted
