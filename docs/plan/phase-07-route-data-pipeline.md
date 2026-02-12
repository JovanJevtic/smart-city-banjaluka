# Phase 7: Route Data Pipeline

**Priority:** 🔴 Critical — foundation for phases 8, 9, 11, 12, 13
**Effort:** 3-4 days
**Dependencies:** None (builds on existing schema)

---

## Goal

Import Banja Luka's 29 bus routes and 461 stops from OpenStreetMap into the database, and build a route editor in the dashboard so dispatchers can maintain route data.

---

## Data Source: OpenStreetMap

**Coverage:** Excellent
- 29 bus route relations with geometry, colors, operators, intervals
- 461 bus stops with names and coordinates
- Operators: Pavlovic Turs, Gradski Prevoz, Autoprevoz GS
- Bounding box: `(44.6, 17.05, 44.9, 17.35)`

**Overpass API queries:**
```
// All bus routes
relation["route"="bus"](44.6,17.05,44.9,17.35);out body;>;out skel qt;

// All bus stops
node["highway"="bus_stop"](44.6,17.05,44.9,17.35);out body;
```

---

## Database Schema Changes

### 7.1 Modify `routes` table

```sql
ALTER TABLE routes ADD COLUMN osm_relation_id bigint UNIQUE;
ALTER TABLE routes ADD COLUMN operator text;
ALTER TABLE routes ADD COLUMN interval_minutes integer;        -- e.g. 15
ALTER TABLE routes ADD COLUMN operating_hours text;            -- e.g. "Mo-Fr 05:25-22:25"
ALTER TABLE routes ADD COLUMN distance_meters double precision;
ALTER TABLE routes ADD COLUMN avg_duration_minutes integer;
```

**Drizzle migration** in `packages/database/src/schema/routes.ts`:
- Add `osmRelationId` (bigint, unique, nullable)
- Add `operator` (text, nullable)
- Add `intervalMinutes` (integer, nullable)
- Add `operatingHours` (text, nullable)
- Add `distanceMeters` (doublePrecision, nullable)
- Add `avgDurationMinutes` (integer, nullable)

### 7.2 Modify `stops` table

```sql
ALTER TABLE stops ADD COLUMN osm_node_id bigint UNIQUE;
ALTER TABLE stops ADD COLUMN zone text;
ALTER TABLE stops ADD COLUMN wheelchair_accessible boolean DEFAULT false;
```

**Drizzle changes:**
- Add `osmNodeId` (bigint, unique, nullable)
- Add `zone` (text, nullable)
- Add `wheelchairAccessible` (boolean, default false)

### 7.3 New `route_shapes` table

Stores detailed polyline geometry per route per direction. Separate from route_stops because shape has hundreds of points while route_stops only has actual stops.

```typescript
export const routeShapes = pgTable('route_shapes', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  routeId: text('route_id').notNull().references(() => routes.id),
  direction: directionEnum('direction').notNull(),
  // GeoJSON LineString stored as JSONB
  geometry: jsonb('geometry').notNull(),  // [[lng, lat], [lng, lat], ...]
  distanceMeters: doublePrecision('distance_meters'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  unique('route_shapes_route_direction').on(table.routeId, table.direction),
])
```

### 7.4 New `osm_import_log` table

Track imports for idempotency and debugging.

```typescript
export const osmImportLog = pgTable('osm_import_log', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  importType: text('import_type').notNull(),  // 'routes', 'stops', 'full'
  osmTimestamp: text('osm_timestamp'),         // Overpass data timestamp
  routesImported: integer('routes_imported').default(0),
  stopsImported: integer('stops_imported').default(0),
  errors: jsonb('errors'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
```

---

## Implementation Steps

### Step 7.1 — Schema Migration (0.5 day)

**Files to modify:**
- `packages/database/src/schema/routes.ts` — add new columns
- `packages/database/src/schema/telemetry.ts` — add `routeShapes` and `osmImportLog` tables (or new file `osm.ts`)
- `packages/database/src/schema/index.ts` — export new tables

**Commands:**
```bash
pnpm --filter @smart-city/database db:generate
pnpm --filter @smart-city/database db:push
```

### Step 7.2 — OSM Import Script (1 day)

Create `packages/database/src/scripts/import-osm-routes.ts`

**Algorithm:**
1. Fetch all bus routes via Overpass API:
   ```
   [out:json][timeout:120];
   area["name"="Banja Luka"]["admin_level"="8"]->.city;
   relation["route"="bus"](area.city);
   out body;
   >;
   out skel qt;
   ```
2. Fetch all bus stops:
   ```
   [out:json][timeout:60];
   area["name"="Banja Luka"]["admin_level"="8"]->.city;
   node["highway"="bus_stop"](area.city);
   out body;
   ```
3. Parse response:
   - For each route relation:
     - Extract: ref (route number), name, colour, operator, interval, opening_hours
     - Extract ordered member nodes (stops) and ways (geometry)
     - Separate OUTBOUND vs INBOUND directions (route relations often have 2 member groups)
   - For each stop node:
     - Extract: name, lat, lon, ref, shelter, bench, wheelchair
4. Resolve geometry:
   - For each way member in a route, the Overpass `>;out skel qt;` gives us the nodes
   - Chain ways in order to build complete polyline per direction
5. Upsert into database:
   - Match by `osmRelationId` / `osmNodeId` for idempotent re-imports
   - `routes` — one row per route (ref=number, name, colour, operator, etc.)
   - `stops` — one row per unique stop
   - `route_stops` — junction with sequence and direction
   - `route_shapes` — polyline geometry per direction
6. Log import result to `osm_import_log`

**Overpass response parsing details:**

Route relation members have roles:
- `role=""` or `role="forward"` → OUTBOUND geometry (ways)
- `role="backward"` → INBOUND geometry (ways)
- `role="stop"` → stop positions (nodes)
- `role="platform"` → stop platforms (nodes)

For stops, prefer `platform` nodes (they have the public-facing names). Fall back to `stop` nodes.

**Edge cases:**
- Some routes have only one direction mapped
- Some stops appear in multiple routes
- Stop names may have encoding issues (Bosnian diacritics: č, ć, š, ž, đ)
- Ways may need reversing to form a continuous polyline

**Script interface:**
```bash
pnpm --filter @smart-city/database tsx src/scripts/import-osm-routes.ts
# Options:
#   --dry-run    Preview without writing to DB
#   --force      Re-import even if osmRelationId already exists
```

### Step 7.3 — API Endpoints for Route Management (0.5 day)

**New/updated routes in `apps/api/src/routes/`:**

Already have basic CRUD. Enhance with:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/routes` | List routes (add `?withStops=true` for stops+geometry) |
| GET | `/api/routes/:id` | Get route with stops, shape, schedule info |
| GET | `/api/routes/:id/shape` | Get polyline geometry for map display |
| GET | `/api/stops` | List all stops (with pagination + search) |
| GET | `/api/stops/nearby?lat=X&lng=Y&radius=500` | Find stops near a point |
| POST | `/api/admin/import-osm` | Trigger OSM re-import (admin only) |

**Dashboard API routes** (direct DB access):

| File | Endpoint | Description |
|------|----------|-------------|
| `api/routes/route.ts` | `/api/routes` | List routes for map overlay |
| `api/routes/[id]/route.ts` | `/api/routes/:id` | Route detail with stops and shape |
| `api/stops/route.ts` | `/api/stops` | List stops for map/search |
| `api/stops/nearby/route.ts` | `/api/stops/nearby` | Proximity search |

### Step 7.4 — Dashboard Route Editor (1-1.5 days)

**New dashboard pages/components:**

```
src/
  app/
    routes/
      page.tsx                    — Route list page
      [id]/
        page.tsx                  — Route detail/edit page
    api/
      routes/route.ts             — List routes API
      routes/[id]/route.ts        — Route detail API
      routes/[id]/shape/route.ts  — Route geometry API
      stops/route.ts              — List stops API
      stops/nearby/route.ts       — Nearby stops API
      admin/import-osm/route.ts   — Trigger import API
  components/
    routes/
      RouteList.tsx               — Table of all routes with search/filter
      RouteDetail.tsx             — Route info + stops + map
      RouteMap.tsx                — Map with route polyline + stops
      StopList.tsx                — Sortable stop list per route
      RouteEditor.tsx             — Edit route metadata (name, color, schedule)
    map/
      RouteOverlay.tsx            — All routes on main dashboard map
      StopMarkers.tsx             — Bus stop markers layer
```

**Route List Page features:**
- Table: number, name, operator, stops count, status
- Search by name/number
- Filter by operator
- Click → route detail page
- "Import from OSM" button (admin)

**Route Detail Page features:**
- Map showing route polyline (both directions) + stop markers
- Stop list with sequence, name, distance from start
- Schedule preview (if populated)
- Edit button for metadata

**Main Dashboard Map additions:**
- Toggle to show/hide all route polylines as overlay
- Route polylines use the `colour` field from OSM data
- Stop markers as small circles (appear at zoom level 14+)

### Step 7.5 — Route Display on Dashboard Map (0.5 day)

Add to existing `Dashboard.tsx`:
- New hook: `useRoutes.ts` — fetch routes with shapes
- New component: `map/RouteOverlay.tsx` — render route polylines on map
- New component: `map/StopMarkers.tsx` — render stop dots on map
- Toggle button in TopBar to show/hide routes layer

---

## Verification Checklist

- [ ] Schema migration runs without errors
- [ ] OSM import script imports all 29 routes and ~461 stops
- [ ] Each route has geometry (polyline) for at least one direction
- [ ] Route-stop associations are correct (verified against OSM visually)
- [ ] API returns routes with stops and geometry
- [ ] Dashboard shows route list page
- [ ] Dashboard map can display route overlays
- [ ] Re-running import is idempotent (no duplicates)
- [ ] Bosnian characters display correctly (Čelinac, Šargovac, etc.)

---

## Data Quality Checks

After import, verify:
```sql
-- Route count (expect ~29)
SELECT count(*) FROM routes WHERE osm_relation_id IS NOT NULL;

-- Stop count (expect ~461)
SELECT count(*) FROM stops WHERE osm_node_id IS NOT NULL;

-- Routes with both directions
SELECT r.number, count(rs.direction) as directions
FROM routes r JOIN route_shapes rs ON rs.route_id = r.id
WHERE r.osm_relation_id IS NOT NULL
GROUP BY r.number ORDER BY r.number;

-- Orphan stops (stops not assigned to any route)
SELECT count(*) FROM stops s
LEFT JOIN route_stops rs ON rs.stop_id = s.id
WHERE rs.id IS NULL AND s.osm_node_id IS NOT NULL;
```
