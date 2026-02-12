# Phase 11: Public Passenger App

**Priority:** 🟡 High
**Effort:** 5-7 days
**Dependencies:** Phase 7 (routes), Phase 8 (ETA predictions)

---

## Goal

Build a public-facing Progressive Web App (PWA) that citizens of Banja Luka can use to:
1. See all buses on a real-time map
2. Check when the next bus arrives at their stop
3. Browse routes, see all stops, and view timetables
4. Install as a mobile app (PWA)

---

## Tech Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Framework | Next.js 15 (App Router) | Same stack as dashboard, SSR for SEO, React 19 |
| Maps | Leaflet + react-leaflet | Consistent with dashboard, lightweight |
| Real-time | WebSocket (via Fastify API) | Live bus positions and ETAs |
| PWA | next-pwa or manual service worker | Installable, works offline for saved routes |
| Styling | Tailwind CSS v4 | Consistent with dashboard |
| I18n | Bosnian (default) + English | Two language support |
| Package | `apps/passenger` in monorepo | Shares `@smart-city/database` and `@smart-city/shared` |

---

## App Structure

```
apps/passenger/
  package.json
  next.config.ts
  tsconfig.json
  postcss.config.mjs
  public/
    manifest.json           — PWA manifest
    icons/                  — App icons (192x192, 512x512)
    sw.js                   — Service worker
  src/
    app/
      layout.tsx            — Root layout with meta, PWA head tags
      page.tsx              — Home: search + nearby stops + live map
      globals.css           — Tailwind + light/dark theme
      map/
        page.tsx            — Full-screen live map
      routes/
        page.tsx            — Route browser
        [id]/
          page.tsx          — Route detail: map + stops + timetable
      stops/
        page.tsx            — Stop search
        [id]/
          page.tsx          — Stop detail: upcoming arrivals
      api/
        routes/route.ts
        routes/[id]/route.ts
        stops/route.ts
        stops/nearby/route.ts
        stops/[id]/arrivals/route.ts
        vehicles/live/route.ts
    components/
      map/
        LiveMap.tsx          — All buses on map (real-time)
        RouteMap.tsx         — Single route on map
        StopMap.tsx          — Stop location + nearby buses
        BusMarker.tsx        — Animated bus icon with route number
        StopMarker.tsx       — Bus stop marker
        UserLocation.tsx     — "My location" marker
      routes/
        RouteList.tsx        — All routes list
        RouteCard.tsx        — Route preview card (number, name, color)
        RouteStops.tsx       — Ordered stop list for a route
        Timetable.tsx        — Schedule grid (departures by day type)
      stops/
        StopSearch.tsx       — Search stops by name
        NearbyStops.tsx      — GPS-based nearby stops
        ArrivalBoard.tsx     — Departure board for a stop
        ArrivalRow.tsx       — Single arrival: route, direction, ETA
      ui/
        BottomNav.tsx        — Mobile bottom navigation
        SearchBar.tsx        — Search input with autocomplete
        PullToRefresh.tsx    — Pull-to-refresh gesture
        InstallPrompt.tsx    — PWA install banner
        LanguageSwitcher.tsx — BS/EN toggle
      layout/
        AppShell.tsx         — Mobile-first shell layout
    hooks/
      useGeolocation.ts     — Browser geolocation API
      useWebSocket.ts       — WebSocket connection to API
      useLiveVehicles.ts    — Real-time vehicle positions
      useNearbyStops.ts     — Stops near user location
      useRouteArrivals.ts   — Arrivals for a specific stop
    lib/
      types.ts              — Passenger-specific types
      i18n.ts               — Translation strings (BS/EN)
      pwa.ts                — Service worker registration
```

---

## Pages & Features

### 11.1 — Home Page (`/`)

```
┌──────────────────────────────┐
│ 🔍 Where are you going?     │  ← Search bar (stops + routes)
├──────────────────────────────┤
│ 📍 Nearby Stops              │  ← Based on GPS
│ ┌────────────────────────┐  │
│ │ 🚏 Trg Krajine         │  │  ← Tap → stop detail
│ │   Linija 1 → 3 min     │  │
│ │   Linija 12 → 8 min    │  │
│ ├────────────────────────┤  │
│ │ 🚏 Aleja Sv. Save      │  │
│ │   Linija 3 → 5 min     │  │
│ │   Linija 17 → 12 min   │  │
│ └────────────────────────┘  │
├──────────────────────────────┤
│ 🗺 Live Map Preview          │  ← Small map with nearby buses
│ [See full map →]             │
├──────────────────────────────┤
│ ⭐ Favorite Routes            │  ← Saved in localStorage
│ [1] [3] [12] [17]           │
└──────────────────────────────┘
│ 🏠 Home │ 🗺 Map │ 🚌 Routes │ ← Bottom nav
```

**Features:**
- Auto-detect user location (with permission)
- Show nearby stops with next arrival times
- Search bar with autocomplete (stops + routes)
- Favorite routes quick access (localStorage)
- Small map preview with nearby buses

### 11.2 — Live Map Page (`/map`)

```
┌──────────────────────────────┐
│ [🔍 Search]   [📍 Locate me] │
├──────────────────────────────┤
│                              │
│     Full-screen map          │
│                              │
│  🚌₁ 🚌₃  🚌₁₂              │  ← Bus markers with route numbers
│        🚏  🚏                │  ← Stop markers
│     🚌₁₇                    │
│              📍 (me)         │  ← User location
│                              │
├──────────────────────────────┤
│ Slide-up: Tap bus → details  │
│ Route 1 → Nova Bolnica       │
│ Speed: 42 km/h | Next: 2min │
└──────────────────────────────┘
```

**Features:**
- All active buses shown with animated markers
- Bus markers show route number, colored by route color
- Tap bus → slide-up panel with route info, speed, next stop, ETA
- Tap stop → slide-up panel with arrival board
- User location marker
- Route filter (show only specific routes)
- Real-time updates via WebSocket (positions update every 5-10s)

**Bus marker design:**
```
  ┌───┐
  │ 1 │  ← Route number in circle, colored by route color
  └─┬─┘
    │    ← Arrow showing heading direction
    ▼
```

### 11.3 — Route Browser (`/routes`)

```
┌──────────────────────────────┐
│ 🔍 Search routes...          │
├──────────────────────────────┤
│ ┌────────────────────────┐  │
│ │ 🔵 Linija 1             │  │
│ │ Madjir → Nova Bolnica   │  │
│ │ ~25 min | ⏱ 15 min int  │  │
│ ├────────────────────────┤  │
│ │ 🟢 Linija 3             │  │
│ │ Vodovod → Zeleni Vir    │  │
│ │ ~20 min | ⏱ 20 min int  │  │
│ ├────────────────────────┤  │
│ │ 🔴 Linija 6             │  │
│ │ Autobuska → Saracica    │  │
│ └────────────────────────┘  │
│ ... (all 29 routes)         │
└──────────────────────────────┘
```

**Route Detail Page (`/routes/[id]`):**

```
┌──────────────────────────────┐
│ ← Back     Linija 1    🔵   │
│ Madjir ↔ Nova Bolnica        │
│ Operator: Pavlovic Turs      │
├──────────────────────────────┤
│ [Map] [Stops] [Timetable]    │  ← Tabs
├──────────────────────────────┤
│ Tab: Map                     │
│ ┌────────────────────────┐  │
│ │   Route polyline       │  │
│ │   + active buses 🚌🚌   │  │
│ │   + stop markers 🚏🚏🚏│  │
│ └────────────────────────┘  │
├──────────────────────────────┤
│ Tab: Stops                   │
│ OUTBOUND (Madjir → N.Boln.) │
│ 1. 🚏 Madjir / Ortopedija   │
│ 2. 🚏 Trg Krajine           │
│ 3. 🚏 Aleja Sv. Save        │
│ ... (all stops in order)     │
│                              │
│ INBOUND (N.Boln. → Madjir)  │
│ 1. 🚏 Nova Bolnica          │
│ ...                          │
├──────────────────────────────┤
│ Tab: Timetable               │
│ Weekdays:                    │
│ 05:25 | 05:40 | 05:55 | ... │
│ Saturday:                    │
│ 06:00 | 06:20 | 06:40 | ... │
│ Sunday:                      │
│ 07:00 | 07:30 | 08:00 | ... │
└──────────────────────────────┘
```

### 11.4 — Stop Detail Page (`/stops/[id]`)

```
┌──────────────────────────────┐
│ ← Back     🚏 Trg Krajine    │
├──────────────────────────────┤
│ ┌────────────────────────┐  │
│ │   Map with stop        │  │
│ │   + approaching buses  │  │
│ └────────────────────────┘  │
├──────────────────────────────┤
│ DEPARTURES                   │
│ ┌────────────────────────┐  │
│ │ 🔵 1  Nova Bolnica  2m │  │  ← Route, direction, ETA
│ │ 🟢 3  Zeleni Vir    5m │  │
│ │ 🔵 12 Vidik         8m │  │
│ │ 🔵 1  Madjir       12m │  │
│ │ 🟢 3  Vodovod      15m │  │
│ └────────────────────────┘  │
│                              │
│ Auto-refreshes every 10s     │
│ [⭐ Save stop]               │
└──────────────────────────────┘
```

**Arrival board features:**
- Real-time ETAs from `eta_predictions` cache in Redis
- Color-coded by route color
- Shows direction (terminal stop name)
- Auto-refreshes every 10 seconds
- Fallback to scheduled times when no real-time data available
- "Save stop" to favorites (localStorage)

---

## Real-Time Data Flow

```
FMC125 → TCP Server → Worker → Route Matcher → ETA Predictor
                                      │                │
                                      ▼                ▼
                              Redis Pub/Sub      Redis Cache
                              (telemetry:all)    (stop:{id}:etas)
                                      │
                              ┌───────▼────────┐
                              │ Fastify API    │
                              │ WebSocket      │
                              │ /ws?channel=   │
                              │   fleet        │
                              └───────┬────────┘
                                      │
                              ┌───────▼────────┐
                              │ Passenger App  │
                              │ useWebSocket() │
                              │ useLiveVehicles│
                              └────────────────┘
```

**WebSocket channels for passenger app:**
- `fleet` — all vehicle position updates (for live map)
- `route:{routeId}` — vehicles on a specific route
- `stop:{stopId}` — arrival updates for a specific stop

### API Endpoints (no auth required for passenger app)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/routes` | All routes with basic info |
| GET | `/api/routes/:id` | Route detail + stops + shape |
| GET | `/api/stops` | All stops (for search) |
| GET | `/api/stops/nearby?lat=X&lng=Y` | Nearby stops |
| GET | `/api/stops/:id/arrivals` | Real-time arrivals at stop |
| GET | `/api/vehicles/live` | All active vehicles with positions |
| WS | `/ws?channel=fleet` | Real-time vehicle positions |
| WS | `/ws?channel=stop:{id}` | Real-time arrivals at a stop |

**Public access:** These endpoints do NOT require JWT auth. Rate limit to 30 req/min per IP.

---

## PWA Configuration

### manifest.json
```json
{
  "name": "Bus Banja Luka",
  "short_name": "BusBL",
  "description": "Gradski prevoz Banja Luka — Prati autobuse uživo",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1a1a2e",
  "theme_color": "#e94560",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### Service Worker Strategy
- **Cache first** for static assets (JS, CSS, images, route data)
- **Network first** for API calls (positions, ETAs)
- **Offline fallback** page showing saved routes/stops from localStorage
- Pre-cache route list and stop list for offline browsing

---

## I18n (Bosnian + English)

```typescript
// src/lib/i18n.ts
const translations = {
  bs: {
    nearby_stops: 'Obližnje stanice',
    search_placeholder: 'Kuda idete?',
    minutes_short: 'min',
    departures: 'Polasci',
    routes: 'Linije',
    map: 'Mapa',
    home: 'Početna',
    timetable: 'Red vožnje',
    stops: 'Stanice',
    arriving_in: 'Dolazi za',
    no_service: 'Nema polazaka',
    save_stop: 'Sačuvaj stanicu',
    favorites: 'Omiljeno',
    all_routes: 'Sve linije',
    direction: 'Smjer',
    outbound: 'Polazak',
    inbound: 'Povratak',
    weekdays: 'Radnim danom',
    saturday: 'Subotom',
    sunday: 'Nedjeljom',
    live: 'Uživo',
    scheduled: 'Po redu vožnje',
    install_app: 'Instaliraj aplikaciju',
    offline: 'Nema internet konekcije',
  },
  en: {
    nearby_stops: 'Nearby Stops',
    search_placeholder: 'Where are you going?',
    // ... etc
  },
}
```

**Default:** Bosnian. Toggle with language switcher. Store preference in localStorage.

---

## Implementation Steps

### Step 11.1 — App Scaffold (0.5 day)
- Create `apps/passenger/` with Next.js 15 + Tailwind
- Add to `pnpm-workspace.yaml`
- Configure `next.config.ts` with transpilePackages
- Set up `postcss.config.mjs`, `globals.css` (light theme primary, dark mode support)
- Add to `ecosystem.config.cjs` (port 3200)
- PWA manifest + icons

### Step 11.2 — Mobile-First Layout (0.5 day)
- `AppShell.tsx` — mobile layout with bottom nav
- `BottomNav.tsx` — Home, Map, Routes tabs
- `SearchBar.tsx` — with autocomplete dropdown
- Responsive breakpoints: mobile-first, tablet/desktop adaptive

### Step 11.3 — Route & Stop API Routes (0.5 day)
- Dashboard already has route API; passenger app can either:
  - a) Query Fastify API directly (public endpoints)
  - b) Have its own API routes querying DB
- Recommend: own API routes (same pattern as dashboard) for simplicity
- Add public endpoints to Fastify API (no auth) for WebSocket

### Step 11.4 — Route Browser (1 day)
- `RouteList.tsx` — all 29 routes with search
- `RouteCard.tsx` — route preview
- Route detail page with map, stops, timetable
- `RouteMap.tsx` — route polyline + stops on map
- `Timetable.tsx` — departure times grid

### Step 11.5 — Live Map (1 day)
- `LiveMap.tsx` — full-screen map with all active buses
- `BusMarker.tsx` — custom Leaflet marker with route number + heading arrow
- `useWebSocket.ts` — connect to Fastify API WebSocket
- `useLiveVehicles.ts` — real-time vehicle positions
- Tap bus → slide-up panel
- Tap stop → slide-up panel
- Route filter

### Step 11.6 — Stop Arrivals (1 day)
- `NearbyStops.tsx` — GPS-based nearby stop detection
- `useGeolocation.ts` — browser Geolocation API hook
- `ArrivalBoard.tsx` — departure board for a stop
- Real-time ETAs from Redis cache via API
- Fallback to scheduled times
- Save favorite stops

### Step 11.7 — Home Page + Search (0.5 day)
- Combine nearby stops + search + favorites
- Search autocomplete for stops and routes
- Quick route badges for favorites

### Step 11.8 — PWA + Offline (0.5 day)
- Service worker setup
- Offline fallback page
- Cache route and stop data
- Install prompt banner
- App icons

### Step 11.9 — Bosnian Translation (0.5 day)
- Translate all UI strings
- Language switcher
- Bosnian as default

---

## Design System (Passenger App)

**Light theme** (different from dark dashboard — passengers expect light UI):

| Token | Value | Use |
|-------|-------|-----|
| --bg-primary | #ffffff | Main background |
| --bg-secondary | #f8fafc | Cards, sections |
| --text-primary | #0f172a | Main text |
| --text-secondary | #64748b | Secondary text |
| --accent | #e94560 | Brand accent, CTAs |
| --success | #22c55e | On time |
| --warning | #f59e0b | Delayed |
| --critical | #ef4444 | Cancelled/very late |
| --border | #e2e8f0 | Borders |

**Typography:** System font stack, 16px base (mobile readability)

**Dark mode:** Supported via `prefers-color-scheme` media query

---

## Deployment

Add to `ecosystem.config.cjs`:
```javascript
{
  name: "passenger",
  script: "node_modules/next/dist/bin/next",
  args: "start -p 3200",
  cwd: "/opt/smart-city/apps/passenger",
  exec_mode: "fork",
  instances: 1,
}
```

**Port:** 3200
**URL:** `https://bus.banjaluka.ba` (or similar — behind reverse proxy)

---

## Verification Checklist

- [ ] Home page shows nearby stops with ETAs
- [ ] Search finds routes and stops
- [ ] Live map shows all active buses in real-time
- [ ] Bus markers show route number and move smoothly
- [ ] Route browser lists all 29 routes
- [ ] Route detail shows map, stops, timetable
- [ ] Stop detail shows real-time departure board
- [ ] Favorite stops persist in localStorage
- [ ] PWA installable on Android/iOS
- [ ] Offline fallback works (saved routes/stops)
- [ ] Bosnian language default
- [ ] Language switcher works
- [ ] Responsive on mobile/tablet/desktop
- [ ] WebSocket updates positions every 5-10 seconds
- [ ] Page loads < 2s on 3G connection (Core Web Vitals)
