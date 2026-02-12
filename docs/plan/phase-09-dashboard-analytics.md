# Phase 9: Advanced Dashboard Analytics

**Priority:** 🟡 High
**Effort:** 3-4 days
**Dependencies:** Phase 7 (routes in DB)

---

## Goal

Transform the dashboard from a simple monitoring tool into a comprehensive analytics platform. Add dedicated analytics pages with interactive charts, date range filters, route-based analysis, and comparative views.

---

## New Dashboard Pages

### Page Structure

```
src/app/
  page.tsx                          — Main dashboard (existing, enhanced)
  routes/
    page.tsx                        — Route list + management
    [id]/
      page.tsx                      — Route detail + analytics
  analytics/
    page.tsx                        — Fleet analytics overview
    vehicles/
      page.tsx                      — Vehicle comparison analytics
      [deviceId]/
        page.tsx                    — Single vehicle deep dive
    routes/
      page.tsx                      — Route performance analytics
      [id]/
        page.tsx                    — Single route analytics
    alerts/
      page.tsx                      — Alert analytics + trends
  reports/
    page.tsx                        — Report generation page
```

---

## Component Breakdown

### 9.1 — Navigation Sidebar

Replace reliance on TopBar-only navigation. Add a collapsible sidebar.

**File:** `src/components/layout/Sidebar.tsx`

```
┌─────────────────┐
│ 🚌 Smart City   │
├─────────────────┤
│ ◉ Dashboard     │
│ 🗺 Routes        │
│ 📊 Analytics     │
│   ├ Fleet       │
│   ├ Vehicles    │
│   ├ Routes      │
│   └ Alerts      │
│ 📄 Reports       │
├─────────────────┤
│ ⚙ Settings       │
└─────────────────┘
```

- Collapsible to icon-only mode (60px width)
- Active page highlighted
- Badge on Alerts showing unacknowledged count
- Stored collapse state in localStorage

### 9.2 — Analytics Overview Page (`/analytics`)

**Key metrics cards (top row):**
- Total distance (selectable period)
- Active vehicles today
- Average schedule adherence
- Total alerts (by severity breakdown)
- Fuel consumed
- Average speed

**Charts row 1:**
- **Fleet Activity Heatmap** — hours (x) × days (y), color = number of active vehicles
  - Component: `charts/ActivityHeatmap.tsx`
  - Data: Query telemetry records grouped by hour and date

- **Distance Trend** — line chart, daily total fleet distance over selected period
  - Component: `charts/DistanceTrend.tsx`
  - Data: `deviceDailyStats` aggregated by date

**Charts row 2:**
- **Alert Distribution** — donut chart by type (overspeed, geofence, offline, etc.)
  - Component: `charts/AlertDistribution.tsx`
  - Data: Alert counts grouped by type

- **Speed Distribution** — histogram of average speeds across fleet
  - Component: `charts/SpeedHistogram.tsx`
  - Data: `deviceDailyStats.avgSpeed` distribution

**Charts row 3:**
- **Top 10 Vehicles by Distance** — horizontal bar chart
  - Component: `charts/TopVehicles.tsx`

- **Route Utilization** — bar chart showing trips per route
  - Component: `charts/RouteUtilization.tsx`

### 9.3 — Vehicle Analytics Page (`/analytics/vehicles`)

**Vehicle comparison table:**
- Sortable columns: name, distance, driving time, idle time, avg speed, max speed, alerts, fuel
- Date range picker (applies to all data)
- Click row → vehicle detail page
- Export to CSV button

**Vehicle Detail Page (`/analytics/vehicles/[deviceId]`):**

**Header:** Device name, IMEI, online status, assigned route

**Tab: Overview**
- Stat cards: distance, driving time, idle time, trips, alerts, fuel
- Daily distance bar chart (last 30 days)
- Speed profile line chart (current day)
- Map with today's track

**Tab: Trips**
- Trip list for selected day
- Each trip: start time, end time, distance, avg speed, max speed
- Click trip → map zooms to trip track

**Tab: Alerts**
- Alert history for this vehicle
- Filter by type, severity, date
- Timeline visualization

**Tab: Maintenance**
- Engine hours tracking
- Voltage trends (external + battery)
- Upcoming maintenance predictions (based on distance/hours)

### 9.4 — Route Analytics Page (`/analytics/routes`)

**Route performance table:**
- Columns: route number, name, avg trips/day, avg adherence, avg speed, total distance, alerts
- Date range picker
- Click → route detail

**Route Detail Page (`/analytics/routes/[id]`):**

**Header:** Route number, name, operator, color badge

**Map:** Route polyline with color-coded speed segments
- Green: normal speed
- Yellow: slow (< 50% of avg)
- Red: very slow (< 25% of avg)

**Stats:**
- Average trip duration vs scheduled
- Schedule adherence trend (line chart over days)
- Passenger load if available (future)
- Stop dwell time analysis (bar chart per stop)
- Peak hours identification

### 9.5 — Alert Analytics Page (`/analytics/alerts`)

**Summary cards:**
- Total alerts (period)
- By severity (INFO, WARNING, CRITICAL)
- Most common type
- Average time to acknowledge

**Charts:**
- **Alerts over time** — stacked area chart (by severity)
- **Alerts by type** — horizontal bar chart
- **Alerts by vehicle** — which vehicles generate most alerts
- **Alert map** — heatmap of alert locations on map
- **Response time distribution** — histogram of time-to-acknowledge

---

## Shared Components

### DateRangePicker

```typescript
// src/components/ui/DateRangePicker.tsx
interface DateRangePickerProps {
  value: { from: Date; to: Date }
  onChange: (range: { from: Date; to: Date }) => void
  presets?: Array<{ label: string; from: Date; to: Date }>
}
```

**Presets:** Today, Last 7 days, Last 30 days, This month, Last month, Custom

### DataTable

```typescript
// src/components/ui/DataTable.tsx
interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  sortable?: boolean
  pagination?: boolean
  searchable?: boolean
  onRowClick?: (row: T) => void
  exportCsv?: boolean
}
```

Generic sortable/filterable/searchable table used across all analytics pages.

### ChartContainer

```typescript
// src/components/ui/ChartContainer.tsx
// Wrapper with title, loading state, empty state, and export button
```

---

## API Routes for Analytics

### Dashboard API (`apps/dashboard/src/app/api/`)

| File | Endpoint | Description |
|------|----------|-------------|
| `analytics/fleet/route.ts` | `/api/analytics/fleet` | Fleet-wide stats for date range |
| `analytics/distance-trend/route.ts` | `/api/analytics/distance-trend` | Daily distance for chart |
| `analytics/speed-distribution/route.ts` | `/api/analytics/speed-distribution` | Speed histogram data |
| `analytics/activity-heatmap/route.ts` | `/api/analytics/activity-heatmap` | Hour × day activity matrix |
| `analytics/alert-trends/route.ts` | `/api/analytics/alert-trends` | Alert counts over time |
| `analytics/top-vehicles/route.ts` | `/api/analytics/top-vehicles` | Top N by distance/alerts |
| `analytics/route-performance/route.ts` | `/api/analytics/route-performance` | Route comparison data |
| `analytics/vehicle/[deviceId]/route.ts` | `/api/analytics/vehicle/:id` | Single vehicle analytics |
| `analytics/vehicle/[deviceId]/trips/route.ts` | `/api/analytics/vehicle/:id/trips` | Vehicle trip history |

---

## Implementation Steps

### Step 9.1 — Layout Refactor + Sidebar (0.5 day)
- Create `Sidebar.tsx` with navigation links
- Create `AppLayout.tsx` wrapper with sidebar + main content area
- Update `layout.tsx` to use `AppLayout`
- Move TopBar controls into context/state that persists across pages
- Keep main dashboard page at `/` (no sidebar, fullscreen map)
- Other pages (routes, analytics, reports) use sidebar layout

### Step 9.2 — Shared UI Components (0.5 day)
- `DateRangePicker.tsx`
- `DataTable.tsx`
- `ChartContainer.tsx`
- `Tabs.tsx` (generic tab component)
- `EmptyState.tsx`
- `LoadingSkeleton.tsx`

### Step 9.3 — Analytics API Routes (0.5 day)
- All dashboard API routes with proper date range filtering
- Aggregate queries using `deviceDailyStats` and `alerts` tables
- Response typing matches chart component expectations

### Step 9.4 — Fleet Analytics Page (1 day)
- Overview page with all metrics cards
- Activity heatmap chart
- Distance trend chart
- Alert distribution chart
- Speed histogram
- Top vehicles chart
- Route utilization chart

### Step 9.5 — Vehicle Analytics Pages (1 day)
- Vehicle comparison table
- Vehicle detail page with tabs
- Daily charts, trip list, alert history

### Step 9.6 — Route Analytics Pages (0.5 day)
- Route performance table
- Route detail with speed-colored map segments
- Schedule adherence trend

### Step 9.7 — Alert Analytics Page (0.5 day)
- Alert trends over time
- Alert distribution by type/severity/vehicle
- Alert location heatmap

---

## Chart Library Usage

All charts use `recharts`. Key chart types used:

| Chart Type | Recharts Component | Use Case |
|------------|-------------------|----------|
| Line | `LineChart + Line` | Speed over time, distance trend, adherence trend |
| Bar | `BarChart + Bar` | Daily distance, top vehicles, route utilization |
| Stacked Area | `AreaChart + Area` | Alerts over time (by severity) |
| Donut | `PieChart + Pie` | Alert distribution by type |
| Histogram | `BarChart + Bar` | Speed distribution |
| Heatmap | Custom `svg` grid | Activity heatmap (hours × days) |
| Horizontal Bar | `BarChart + Bar` (layout="vertical") | Top 10 rankings |

---

## Verification Checklist

- [ ] Sidebar navigation works across all pages
- [ ] Date range picker filters all data correctly
- [ ] Fleet overview shows accurate aggregated stats
- [ ] Activity heatmap displays correctly
- [ ] All charts render with real data
- [ ] Vehicle comparison table is sortable and searchable
- [ ] Vehicle detail page shows complete history
- [ ] Route analytics show performance data
- [ ] Alert analytics show trends
- [ ] CSV export works from tables
- [ ] Loading states display during data fetch
- [ ] Empty states show when no data
- [ ] Mobile-responsive layout (sidebar collapses)
