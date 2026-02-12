# Phase 13: Dispatch Console

**Priority:** 🟢 Medium
**Effort:** 4-5 days
**Dependencies:** Phase 7 (routes), Phase 8 (schedule adherence)

---

## Goal

Build a dispatch control interface within the existing dashboard where dispatchers can:
1. See all vehicles on the map with real-time status
2. Assign vehicles to routes and shifts
3. Monitor schedule adherence and respond to deviations
4. Manage daily operations (schedule exceptions, detours)
5. View and manage the route/stop/schedule master data

---

## Target Users

| Role | Capabilities |
|------|-------------|
| DISPATCHER | Full dispatch operations: assignments, alerts, real-time monitoring |
| ADMIN | Everything + user management, system settings, OSM import |
| ANALYST | Read-only analytics, reports |
| VIEWER | Read-only dashboard view |

---

## Dashboard Pages (additions to existing dashboard)

```
src/app/
  dispatch/
    page.tsx                        — Dispatch control center (main view)
    assignments/
      page.tsx                      — Route assignment management
    schedules/
      page.tsx                      — Schedule management
      exceptions/
        page.tsx                    — Holiday/exception management
  admin/
    routes/
      page.tsx                      — Route master data (CRUD)
      [id]/
        edit/
          page.tsx                  — Route editor with map
    stops/
      page.tsx                      — Stop master data (CRUD)
    geofences/
      page.tsx                      — Geofence management with map editor
    users/
      page.tsx                      — User management (admin only)
    import/
      page.tsx                      — OSM import control panel
```

---

## Dispatch Control Center (`/dispatch`)

### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ Sidebar │ TopBar: Dispatch Console  │ Status: 42/45 vehicles     │
├─────────┼────────────────────────────┬───────────────────────────┤
│ Nav     │                            │   Vehicle List Panel      │
│         │    Full-screen Map         │                           │
│ 📊 Dash │                            │   [Route 1]               │
│ 🗺 Disp │    🚌₁ 🚌₃ 🚌₁₂           │   BL-123-A  ● On time    │
│ 📋 Assn │         🚌₁₇              │   BL-456-B  ● Late 3m    │
│ 📅 Sched│                            │                           │
│ ⚙ Admin │    🚏───🚏───🚏──🚏       │   [Route 3]               │
│         │                            │   BL-789-C  ● On time    │
│         │                            │   BL-012-D  ○ Offline    │
│         │                            │                           │
│         ├────────────────────────────┤   [Unassigned]            │
│         │ Alert Ticker               │   BL-345-E  - No route   │
│         │ ⚠ BL-456-B: Late 5min R1  │   BL-678-F  - No route   │
│         │ 🔴 BL-999-X: Route deviat │                           │
└─────────┴────────────────────────────┴───────────────────────────┘
```

### Map Features
- All vehicles with color-coded markers:
  - Green: on time (< 2 min delay)
  - Yellow: slightly late (2-5 min)
  - Orange: late (5-10 min)
  - Red: very late (> 10 min) or off-route
  - Gray: offline
  - White: unassigned (no route)
- Route polylines (toggleable per route)
- Stop markers with names
- Geofence zones
- Click vehicle → popup with details + quick actions
- Click stop → popup with upcoming arrivals

### Vehicle List Panel (right side)
- Grouped by assigned route
- Each vehicle shows: registration, status, delay, driver (if assigned)
- Sort by: route, status, delay
- Filter by: route, status, online/offline
- Quick actions: reassign route, acknowledge alert
- "Unassigned" section at bottom

### Alert Ticker (bottom)
- Scrolling alert bar with recent alerts
- Color-coded by severity
- Click alert → highlight vehicle on map
- Quick acknowledge from ticker

---

## Route Assignment Management (`/dispatch/assignments`)

### Features

**Assignment table:**
- Columns: vehicle, route, direction, shift, start time, end time, status
- Filter by date, route, vehicle
- Drag-and-drop assignment (optional, v2)

**Create assignment:**
```
┌─────────────────────────────────────┐
│ New Route Assignment                 │
│                                      │
│ Vehicle:  [▼ BL-123-A (Bus) ]       │
│ Route:    [▼ Linija 1 ]             │
│ Direction:[▼ OUTBOUND ]             │
│ Shift:    [▼ ALL_DAY ]              │
│ Date:     [2026-02-12]              │
│                                      │
│         [Cancel] [Assign]           │
└─────────────────────────────────────┘
```

**Daily view:**
- Calendar-style grid: rows = vehicles, columns = hours
- Color blocks showing when each vehicle is assigned to which route
- Gaps visible (unassigned periods)
- Copy previous day's assignments

**Auto-assignment (future):**
- Based on schedule requirements and vehicle availability
- Suggest assignments for next day

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/assignments` | List assignments (filter by date, route, vehicle) |
| POST | `/api/assignments` | Create assignment |
| PUT | `/api/assignments/:id` | Update assignment |
| DELETE | `/api/assignments/:id` | Remove assignment |
| POST | `/api/assignments/copy-day` | Copy assignments from one day to another |

---

## Schedule Management (`/dispatch/schedules`)

### Features

**Schedule editor:**
```
┌──────────────────────────────────────────────┐
│ Route: Linija 1  │ Direction: Outbound       │
├──────────────────────────────────────────────┤
│ Day Type    │ Departures                      │
│─────────────┼─────────────────────────────────│
│ Weekdays    │ 05:25 05:40 05:55 06:10 06:25  │
│             │ 06:40 06:55 07:10 07:25 07:40  │
│             │ ... [+ Add time]                │
│─────────────┼─────────────────────────────────│
│ Saturday    │ 06:00 06:30 07:00 07:30 08:00  │
│             │ ... [+ Add time]                │
│─────────────┼─────────────────────────────────│
│ Sunday      │ 07:00 07:45 08:30 09:15 10:00  │
│             │ ... [+ Add time]                │
└──────────────────────────────────────────────┘
```

**Stop times (per trip):**
- Auto-generate from average segment speeds
- Manual override per stop
- Visual timeline showing stop sequence with times

**Schedule exceptions:**
- Holiday calendar
- Add exception: date, type (no service / modified / extra), description
- Bulk exceptions (e.g., "No service on all public holidays")

---

## Route Editor (`/admin/routes/[id]/edit`)

**Map-based route editor:**

```
┌─────────────────────────────────────────┐
│ Editing: Linija 1 (Outbound)            │
├──────────────────┬──────────────────────┤
│                  │ Stops:               │
│   Map with       │ 1. Madjir [🗑] [↑↓]│
│   route polyline │ 2. Trg Krajine [🗑] │
│   + stops        │ 3. Aleja Sv S. [🗑] │
│                  │ ...                  │
│   [Click to add  │ [+ Add stop]        │
│    waypoint]     │ [+ Add from map]    │
│                  │                      │
│   [Click to add  ├──────────────────────┤
│    stop]         │ Route Info:          │
│                  │ Name: [Linija 1    ] │
│                  │ Color: [🔵 #2196F3 ]│
│                  │ Operator: [Pavlovic]│
│                  │ Interval: [15 min  ]│
└──────────────────┴──────────────────────┘
```

**Features:**
- Draw/edit route polyline on map (add/move/remove waypoints)
- Add stops by clicking on map or selecting from existing stop list
- Reorder stops (drag and drop)
- Edit stop names and positions
- Set route metadata (name, color, operator, interval)
- Preview both directions
- Save → updates `routes`, `route_stops`, `route_shapes` tables

---

## Geofence Editor (`/admin/geofences`)

**Map-based geofence editor:**

- List of existing geofences with toggle (active/inactive)
- Draw new circle geofence: click center → drag radius
- Draw new polygon geofence: click vertices → close polygon
- Edit existing: move center, resize radius, move vertices
- Set rules: alert on enter, alert on exit, speed limit
- Save → updates `geofences` table

---

## User Management (`/admin/users`)

**Accessible to ADMIN role only.**

- User list: name, email, role, last login, active status
- Create user: email, name, password, role
- Edit user: change role, activate/deactivate
- Password reset

Note: uses existing auth system from Fastify API (`/api/auth/*`).

---

## Implementation Steps

### Step 13.1 — Dispatch Map View (1.5 days)
- Full-screen map with all vehicles (color-coded by adherence)
- Vehicle list panel (grouped by route)
- Alert ticker bar
- WebSocket integration for real-time updates
- Click vehicle → detail popup with quick actions

### Step 13.2 — Route Assignment CRUD (1 day)
- Assignment API endpoints
- Assignment table page
- Create/edit assignment form
- Daily calendar view
- Copy day functionality

### Step 13.3 — Schedule Editor (1 day)
- Schedule management page
- Departure time editor per route/direction/day type
- Auto-generate stop_times from segment speeds
- Schedule exception management

### Step 13.4 — Route Editor (1 day)
- Map-based route polyline editor
- Stop add/remove/reorder
- Route metadata editing
- Save to database

### Step 13.5 — Admin Pages (0.5 day)
- Geofence editor (map-based)
- User management
- OSM import trigger
- System settings

---

## Verification Checklist

- [ ] Dispatch map shows all vehicles with correct status colors
- [ ] Vehicle list groups by route with delay info
- [ ] Alert ticker shows recent alerts in real-time
- [ ] Route assignments can be created/edited/deleted
- [ ] Daily calendar view shows assignments correctly
- [ ] Schedule editor saves departure times
- [ ] Stop times auto-generate from segment speeds
- [ ] Schedule exceptions work (no service on holidays)
- [ ] Route editor can modify polyline on map
- [ ] Stops can be added/removed/reordered
- [ ] Geofence editor draws circles and polygons
- [ ] User management works (create, edit role, deactivate)
- [ ] Role-based access control enforced (ADMIN vs DISPATCHER vs VIEWER)
