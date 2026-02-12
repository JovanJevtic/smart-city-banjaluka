# Smart City Banja Luka — Master Implementation Plan

## Project Overview

**Client:** City of Banja Luka transit authority
**Operators:** Pavlovic Turs, Gradski Prevoz, Autoprevoz GS
**Fleet:** 30-100 buses with Teltonika FMC125 GPS trackers
**Network:** ~29 bus routes, ~461 bus stops (mapped in OpenStreetMap)
**Status:** Core system live (TCP ingestion, alerts, analytics, dashboard)

---

## Completed Phases (1-6)

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | TCP Server + Teltonika Parser | ✅ Done |
| 2 | Database Schema + Drizzle ORM | ✅ Done |
| 3 | Fastify API (REST CRUD, auth) | ✅ Done |
| 4 | WebSocket real-time streaming | ✅ Done |
| 5 | Alert system (overspeed, geofence, offline) | ✅ Done |
| 6 | Analytics engine (daily stats, fleet summary) | ✅ Done |
| — | Dashboard UI redesign | ✅ Done |

---

## Upcoming Phases (7-14)

| Phase | Name | Priority | Effort | Depends On |
|-------|------|----------|--------|------------|
| **7** | [Route Data Pipeline](./phase-07-route-data-pipeline.md) | 🔴 Critical | 3-4 days | — |
| **8** | [Schedule & Adherence Engine](./phase-08-schedule-adherence.md) | 🔴 Critical | 4-5 days | Phase 7 |
| **9** | [Advanced Dashboard Analytics](./phase-09-dashboard-analytics.md) | 🟡 High | 3-4 days | Phase 7 |
| **10** | [Reports & Export System](./phase-10-reports-export.md) | 🟡 High | 3-4 days | Phase 9 |
| **11** | [Public Passenger App](./phase-11-passenger-app.md) | 🟡 High | 5-7 days | Phase 7, 8 |
| **12** | [GTFS-RT Feed & Google Maps](./phase-12-gtfs-rt.md) | 🟢 Medium | 2-3 days | Phase 7, 8 |
| **13** | [Dispatch Console](./phase-13-dispatch-console.md) | 🟢 Medium | 4-5 days | Phase 7 |
| **14** | [Infrastructure & Ops](./phase-14-infrastructure.md) | 🟢 Medium | 2-3 days | — |

**Total estimated effort:** 26-35 days of implementation

---

## Architecture After All Phases

```
                  ┌─────────────────────────────────────────────────┐
                  │              External Consumers                  │
                  │  Google Maps (GTFS-RT) · Passenger PWA · Mobile  │
                  └─────────────┬──────────────┬────────────────────┘
                                │              │
                    ┌───────────▼──┐   ┌───────▼──────────┐
                    │  GTFS-RT API │   │  Passenger App   │
                    │  /gtfs-rt/*  │   │  apps/passenger  │
                    │  (Protobuf)  │   │  (Next.js PWA)   │
                    └───────────┬──┘   └───────┬──────────┘
                                │              │
┌──────────┐    ┌───────────────▼──────────────▼──────────────────┐
│ FMC125   │    │              Fastify API (port 3000)            │
│ Devices  │    │  REST · WebSocket · JWT Auth · Rate Limiting     │
│ (TCP)    │    │  /api/devices · /api/routes · /api/analytics    │
└────┬─────┘    │  /api/alerts · /api/schedules · /api/reports    │
     │          └─────────────────────┬───────────────────────────┘
     │                                │
┌────▼─────┐    ┌─────────────────────▼───────────────────────────┐
│ TCP Srv  │    │                  Worker                          │
│ port 5000├───►│  Telemetry · Alerts · Analytics · Cleanup        │
│          │    │  ETA Prediction · Schedule Adherence · Reports    │
└──────────┘    └─────────────────────┬───────────────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
     ┌────────▼────────┐    ┌────────▼────────┐    ┌────────▼────────┐
     │   PostgreSQL    │    │     Redis        │    │   File Storage  │
     │   + PostGIS     │    │  Cache · PubSub  │    │  PDF Reports    │
     │                 │    │  BullMQ Queues   │    │  GTFS Exports   │
     └─────────────────┘    └─────────────────┘    └─────────────────┘
                                      │
              ┌───────────────────────▼───────────────────────┐
              │            Dashboard (port 3100)               │
              │  Fleet Overview · Route Map · Analytics         │
              │  Alerts · Reports · Dispatch · Route Editor     │
              └────────────────────────────────────────────────┘
```

---

## Data Model Additions (across all phases)

### New Tables
```
route_shapes          — Detailed polyline geometry per route direction
schedule_exceptions   — Holiday/special schedule overrides
eta_predictions       — Real-time ETA predictions per vehicle per stop
report_jobs           — Scheduled report generation queue
report_files          — Generated report file metadata
osm_import_log        — Track OSM data imports and versions
```

### Modified Tables
```
devices               — Add: assignedRouteId, currentStopId, scheduleAdherence
routes                — Add: osmRelationId, color, avgDuration, distance
stops                 — Add: osmNodeId, zone, connections (transfers)
route_stops           — Add: distanceFromStart, typicalDwellTime
schedules             — Add: exceptionDates, effectiveFrom, effectiveTo
```

---

## Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Route data source | OpenStreetMap Overpass API | 29 routes, 461 stops already mapped. No GTFS feed exists for Banja Luka |
| Passenger app | Next.js PWA (`apps/passenger`) | Same tech stack, SSR for SEO, installable on mobile, fastest to build |
| GTFS-RT format | Protocol Buffers | Industry standard, compatible with Google Maps Transit Partner |
| PDF reports | `@react-pdf/renderer` | React-based, server-side rendering, good for charts |
| ETA prediction | Haversine distance + historical avg speed per segment | Start simple, upgrade to ML model later with enough data |
| Route matching | Nearest-segment snap (PostGIS) | Match GPS points to route geometry to determine which route a bus is on |
| Schedule storage | GTFS-compatible structure | Even though no GTFS exists, using GTFS concepts (trips, stop_times) makes future export trivial |

---

## Implementation Order & Dependencies

```
Phase 7 (Routes) ──────┬──► Phase 8 (Schedule/ETA) ──► Phase 11 (Passenger App)
                        │                            ──► Phase 12 (GTFS-RT)
                        │
                        ├──► Phase 9 (Analytics) ──────► Phase 10 (Reports)
                        │
                        └──► Phase 13 (Dispatch)

Phase 14 (Infrastructure) — independent, can run in parallel
```

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| OSM data incomplete or stale | Routes missing stops or geometry | Build route editor so dispatchers can fix/add routes manually |
| Schedule data unavailable digitally | Can't compute ETAs or adherence | Scrape busbanjaluka.com + manual entry tool in dashboard |
| FMC125 doesn't report which route bus is on | Can't auto-assign routes | GPS-to-route matching algorithm using PostGIS proximity queries |
| Low GPS accuracy in urban canyons | Wrong route assignment | Use heading + sequence logic, not just nearest-point |
| Google Maps Transit Partner approval | Long process, may be rejected | GTFS-RT works independently; passenger app doesn't depend on Google |
| High telemetry volume at full fleet | DB performance degradation | TimescaleDB or partition by month, Redis caching for hot queries |

---

## File Index

| File | Contents |
|------|----------|
| [phase-07-route-data-pipeline.md](./phase-07-route-data-pipeline.md) | OSM import, route editor, stop management, data model |
| [phase-08-schedule-adherence.md](./phase-08-schedule-adherence.md) | Schedule engine, ETA prediction, deviation alerts, route matching |
| [phase-09-dashboard-analytics.md](./phase-09-dashboard-analytics.md) | Analytics pages, charts, filters, comparative views |
| [phase-10-reports-export.md](./phase-10-reports-export.md) | PDF generation, scheduled reports, CSV/Excel export |
| [phase-11-passenger-app.md](./phase-11-passenger-app.md) | Public PWA, real-time map, stop ETAs, route browser |
| [phase-12-gtfs-rt.md](./phase-12-gtfs-rt.md) | GTFS static export, GTFS-RT feed, Google Maps integration |
| [phase-13-dispatch-console.md](./phase-13-dispatch-console.md) | Dispatch UI, route assignments, messaging, schedule management |
| [phase-14-infrastructure.md](./phase-14-infrastructure.md) | Monitoring, scaling, backups, CI/CD, security hardening |
