# Phase 10: Reports & Export System

**Priority:** 🟡 High
**Effort:** 3-4 days
**Dependencies:** Phase 9 (analytics data and API routes)

---

## Goal

Provide three report output formats:
1. **PDF reports** — automated monthly fleet reports for management
2. **Dashboard analytics** — interactive in-browser (covered in Phase 9)
3. **CSV/Excel export** — raw data export for custom analysis

---

## Report Types

### 10.1 — Monthly Fleet Report (PDF)

**Audience:** City transit management, fleet supervisors
**Frequency:** Monthly (auto-generated) or on-demand
**Length:** 8-12 pages

**Contents:**

```
Page 1: Cover
  - "Monthly Fleet Report — Banja Luka Public Transit"
  - Period: January 2026
  - Generated: 2026-02-01
  - Logo / city branding

Page 2: Executive Summary
  - Total vehicles active: 45
  - Fleet utilization: 87%
  - Total distance: 125,430 km
  - On-time performance: 82%
  - Total alerts: 234 (12 critical)
  - Key highlights / issues

Page 3: Fleet Activity
  - Daily active vehicles chart (bar)
  - Fleet distance per day (line)
  - Activity heatmap (hour × day)

Page 4: Vehicle Performance Table
  - All vehicles: reg. no, distance, trips, driving hrs, idle hrs, avg speed, alerts
  - Sorted by distance descending
  - Color-coded: green (good), yellow (attention), red (issue)

Page 5: Route Performance
  - Route table: number, name, trips, avg duration, adherence %, delays
  - Best/worst performing routes highlighted

Page 6: Speed Analysis
  - Fleet average speed trend
  - Overspeed incidents count + chart
  - Top 5 overspeed offenders

Page 7: Alert Summary
  - Alerts by type (bar chart)
  - Alerts by severity (pie chart)
  - Alert trend over the month
  - Unresolved alerts list

Page 8: Fuel Consumption (if data available)
  - Total fuel consumed
  - Fuel per km efficiency
  - Best/worst fuel efficiency vehicles

Page 9: Driver Behavior Scoring
  - Harsh braking counts per vehicle
  - Harsh acceleration counts
  - Overall behavior score per vehicle

Page 10: Geofence Compliance
  - Geofence violations count
  - Most violated geofences
  - Route deviation incidents

Page 11: Maintenance Indicators
  - Vehicles with high engine hours
  - Low battery voltage warnings
  - Upcoming maintenance recommendations

Page 12: Recommendations
  - Auto-generated based on data:
    - "Vehicle X-123 had 15 overspeed alerts — recommend driver coaching"
    - "Route 13 has 25% late arrivals — consider schedule adjustment"
    - "Vehicle Y-456 idle time is 40% — investigate"
```

### 10.2 — Vehicle Report (PDF)

**Per-vehicle monthly report:**
- Vehicle info (reg, type, device IMEI)
- Monthly distance, trips, driving time
- Daily distance chart
- Speed profile
- Alert history
- Maintenance indicators

### 10.3 — Route Report (PDF)

**Per-route monthly report:**
- Route info (number, name, stops, distance)
- Monthly trips, adherence, delays
- Stop-by-stop performance
- Busiest hours

---

## Technical Implementation

### PDF Generation Stack

**Option:** `@react-pdf/renderer`
- React-based PDF generation — same mental model as UI components
- Server-side rendering on Next.js API routes
- Good for charts (can use SVG-based charts)
- Produces clean PDF output

**Alternative for charts in PDF:** Pre-render chart as SVG string using `recharts` `renderToStaticMarkup` and embed in PDF.

### Architecture

```
┌──────────────┐     ┌─────────────────────┐     ┌──────────────┐
│ Dashboard UI │────►│  API Route           │────►│ Report       │
│ "Generate    │     │  /api/reports/       │     │ Generator    │
│  Report"     │     │  generate            │     │ Service      │
└──────────────┘     └──────────┬──────────┘     └──────┬───────┘
                                │                        │
                     ┌──────────▼──────────┐     ┌──────▼───────┐
                     │ BullMQ Job Queue    │     │ @react-pdf   │
                     │ "reports" queue     │     │ /renderer    │
                     └──────────┬──────────┘     └──────┬───────┘
                                │                        │
                     ┌──────────▼──────────┐     ┌──────▼───────┐
                     │ Worker picks up job │     │ Save PDF to  │
                     │ Queries all data    │     │ /data/reports│
                     │ Generates PDF       │     │              │
                     └─────────────────────┘     └──────────────┘
```

### Database Schema

```typescript
export const reportJobs = pgTable('report_jobs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text('type').notNull(),          // 'fleet_monthly', 'vehicle_monthly', 'route_monthly', 'custom'
  status: text('status').notNull(),      // 'pending', 'processing', 'completed', 'failed'
  parameters: jsonb('parameters'),       // { period: { from, to }, vehicleId?, routeId?, etc. }
  requestedBy: text('requested_by'),     // userId
  filePath: text('file_path'),           // path to generated PDF
  fileSize: integer('file_size'),
  error: text('error'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const scheduledReports = pgTable('scheduled_reports', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text('type').notNull(),
  cronExpression: text('cron_expression').notNull(),  // "0 6 1 * *" = 6AM on 1st of month
  parameters: jsonb('parameters'),
  recipientEmails: jsonb('recipient_emails'),          // future: email delivery
  isActive: boolean('is_active').default(true).notNull(),
  lastRunAt: timestamp('last_run_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
```

---

## Implementation Steps

### Step 10.1 — Dependencies + Schema (0.25 day)

```bash
pnpm --filter @smart-city/dashboard add @react-pdf/renderer
pnpm --filter @smart-city/worker add @react-pdf/renderer  # if generating in worker
```

Add `reportJobs` and `scheduledReports` tables. Migrate.

Create report storage directory:
```bash
mkdir -p /opt/smart-city/data/reports
```

### Step 10.2 — PDF Report Templates (1.5 days)

**File structure:**
```
apps/dashboard/src/
  lib/
    reports/
      FleetMonthlyReport.tsx    — React PDF document
      VehicleReport.tsx         — Per-vehicle PDF
      RouteReport.tsx           — Per-route PDF
      components/
        ReportHeader.tsx        — Shared header with title + period
        ReportFooter.tsx        — Page numbers
        StatBox.tsx             — Metric box for PDF
        PdfTable.tsx            — Table component for PDF
        PdfBarChart.tsx         — SVG bar chart for PDF
        PdfLineChart.tsx        — SVG line chart for PDF
        PdfPieChart.tsx         — SVG pie chart for PDF
```

**Chart rendering for PDF:**
Since `recharts` needs DOM, we render charts as SVG strings:
```typescript
import { renderToStaticMarkup } from 'react-dom/server'
import { BarChart, Bar, XAxis, YAxis } from 'recharts'

function renderChartSvg(data) {
  const svg = renderToStaticMarkup(
    <BarChart width={500} height={200} data={data}>
      <XAxis dataKey="date" />
      <YAxis />
      <Bar dataKey="distance" fill="#3b82f6" />
    </BarChart>
  )
  return svg  // embed in PDF via <Svg> component
}
```

Alternative: Build simple SVG chart components that work directly in `@react-pdf/renderer` (no recharts dependency in PDF).

### Step 10.3 — Report Generation API (0.5 day)

**Dashboard API routes:**

| File | Method | Endpoint | Description |
|------|--------|----------|-------------|
| `api/reports/generate/route.ts` | POST | `/api/reports/generate` | Queue report generation |
| `api/reports/route.ts` | GET | `/api/reports` | List generated reports |
| `api/reports/[id]/route.ts` | GET | `/api/reports/:id` | Get report status |
| `api/reports/[id]/download/route.ts` | GET | `/api/reports/:id/download` | Download PDF file |

**Generate endpoint:**
```typescript
// POST /api/reports/generate
{
  type: 'fleet_monthly' | 'vehicle_monthly' | 'route_monthly',
  period: { from: '2026-01-01', to: '2026-01-31' },
  vehicleId?: string,  // for vehicle reports
  routeId?: string,    // for route reports
}
```

**Synchronous generation** (for simple reports < 10s):
- Query all data
- Render PDF with `@react-pdf/renderer`
- Save to `/data/reports/`
- Return download URL

**Async generation** (for complex reports):
- Create `reportJobs` entry with status 'pending'
- Add BullMQ job to 'reports' queue
- Return job ID
- Worker generates PDF, updates status to 'completed'
- Dashboard polls for completion

### Step 10.4 — CSV/Excel Export (0.5 day)

**Export capabilities from any data table:**

| Data | CSV Columns |
|------|-------------|
| Telemetry | timestamp, lat, lng, speed, heading, ignition, voltage, satellites |
| Vehicles | reg_no, type, device_imei, distance_30d, alerts_30d, avg_speed |
| Alerts | timestamp, device, type, severity, message, acknowledged, ack_by |
| Daily Stats | date, device, distance, trips, driving_time, idle_time, avg_speed, max_speed, fuel |
| Routes | number, name, operator, stops_count, avg_trips_day, adherence |

**Implementation:**
- Add `Export CSV` button to every `DataTable` component
- Use `Blob` + `URL.createObjectURL` for client-side CSV generation
- For large exports (>10K rows), use server-side streaming:
  ```typescript
  // GET /api/export/telemetry?deviceId=X&from=Y&to=Z&format=csv
  return new Response(csvStream, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="telemetry-export.csv"',
    },
  })
  ```

### Step 10.5 — Reports Dashboard Page (0.5 day)

**Page:** `/reports`

**Components:**
- `ReportGenerator.tsx` — form to configure and generate reports
  - Select report type
  - Select period (month picker for monthly reports)
  - Select vehicle/route (for specific reports)
  - Generate button
- `ReportList.tsx` — table of previously generated reports
  - Columns: type, period, status, generated at, size, download link
  - Status indicators: pending (spinner), completed (download), failed (error msg)

### Step 10.6 — Scheduled Reports (0.5 day)

**Cron job in worker:**
- On the 1st of each month at 6:00 AM, auto-generate fleet monthly report
- Store in `scheduledReports` table
- Future: email delivery to configured recipients

**Dashboard settings:**
- Configure which reports auto-generate
- Set cron expression
- Enable/disable scheduled reports

---

## Verification Checklist

- [ ] Fleet monthly PDF generates with all 12 pages of content
- [ ] PDF charts render correctly (bar, line, pie)
- [ ] Vehicle report generates for specific vehicle
- [ ] Route report generates for specific route
- [ ] CSV export works from all data tables
- [ ] Large CSV export streams without timeout
- [ ] Report list page shows all generated reports
- [ ] Download link works for completed reports
- [ ] Report generation handles missing data gracefully
- [ ] Scheduled monthly report runs automatically
- [ ] PDF file size is reasonable (< 5MB for monthly report)
