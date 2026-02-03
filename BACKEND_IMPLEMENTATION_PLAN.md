# Smart City Banjaluka - Backend Implementation Plan

## Overview

This document outlines the complete backend implementation for the Smart City Banjaluka project - a real-time fleet tracking system for public transportation using Teltonika FMC125 GPS devices with LVCAN200 CAN bus adapters.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SYSTEM ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐                                                           │
│  │   VEHICLES   │                                                           │
│  │  ┌────────┐  │         TCP (port 5000)                                   │
│  │  │FMC125  │──┼────────────────────────┐                                  │
│  │  │+LVCAN  │  │    (GPRS/LTE)          │                                  │
│  │  └────────┘  │                        ▼                                  │
│  └──────────────┘              ┌──────────────────┐                         │
│                                │  TCP SERVER      │                         │
│                                │  (Node.js)       │                         │
│                                │                  │                         │
│                                │  - Parser        │                         │
│                                │  - Decoder       │                         │
│                                └────────┬─────────┘                         │
│                                         │                                   │
│                    ┌────────────────────┼────────────────────┐              │
│                    │                    │                    │              │
│                    ▼                    ▼                    ▼              │
│           ┌──────────────┐    ┌──────────────┐     ┌──────────────┐        │
│           │    Redis     │    │  BullMQ      │     │  WebSocket   │        │
│           │  (Cache +    │    │  (Queue)     │     │  (Real-time) │        │
│           │   Pub/Sub)   │    │              │     │              │        │
│           └──────┬───────┘    └──────┬───────┘     └──────────────┘        │
│                  │                   │                                      │
│                  └─────────┬─────────┘                                      │
│                            │                                                │
│                            ▼                                                │
│                  ┌──────────────────┐                                       │
│                  │   PostgreSQL     │                                       │
│                  │   + PostGIS      │                                       │
│                  └──────────────────┘                                       │
│                            │                                                │
│                            ▼                                                │
│                  ┌──────────────────┐                                       │
│                  │   API SERVER     │                                       │
│                  │  (Fastify/tRPC)  │                                       │
│                  └──────────────────┘                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Hot Path vs Cold Path

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATA FLOW ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  HOT PATH (< 50ms latency - real-time display)                              │
│  ─────────────────────────────────────────────                              │
│                                                                             │
│  Device ──► TCP Server ──► Redis SET ──► Redis PUBLISH ──► WebSocket ──► UI│
│                             (cache)       (pub/sub)                         │
│                                                                             │
│  COLD PATH (can tolerate delay - persistence & analytics)                   │
│  ────────────────────────────────────────────────────────                   │
│                                                                             │
│  Device ──► TCP Server ──► BullMQ ──► Worker ──► PostgreSQL                 │
│                            (queue)    (async)    (persistent)               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 0: Minimum Viable Test ✅ COMPLETED
- Basic TCP server that receives Teltonika data
- IMEI authentication
- Raw data logging
- Verify device connectivity

### Phase 1: Production TCP Server & Parser
### Phase 2: Database & Persistence Layer
### Phase 3: Real-time Infrastructure (Redis + WebSocket)
### Phase 4: REST/tRPC API
### Phase 5: Background Workers & Queue Processing
### Phase 6: Advanced Features (Alerts, Geofencing, Analytics)

---

## Phase 1: Production TCP Server & Parser

### 1.1 Project Structure

```
smart-city/
├── apps/
│   └── tcp-server/
│       ├── src/
│       │   ├── index.ts              # Entry point
│       │   ├── server.ts             # TCP server implementation
│       │   ├── connection-manager.ts # Track active connections
│       │   └── handlers/
│       │       ├── imei.handler.ts   # IMEI authentication
│       │       └── avl.handler.ts    # AVL packet processing
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── teltonika-parser/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── codec8-extended.ts    # Codec 8E parser
│   │   │   ├── io-elements.ts        # IO element definitions
│   │   │   ├── crc.ts                # CRC16 validation
│   │   │   └── types.ts              # TypeScript interfaces
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── shared/
│       ├── src/
│       │   ├── index.ts
│       │   ├── types.ts              # Shared types
│       │   └── constants.ts          # Shared constants
│       └── package.json
│
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

### 1.2 Teltonika Parser Package

**File: `packages/teltonika-parser/src/types.ts`**

```typescript
export interface TeltonikaPacket {
  imei?: string
  codecId: number
  numberOfRecords: number
  records: AVLRecord[]
  crc: number
}

export interface AVLRecord {
  timestamp: Date
  priority: Priority
  gps: GPSData
  ioElements: IOElement[]
}

export enum Priority {
  LOW = 0,
  HIGH = 1,
  PANIC = 2
}

export interface GPSData {
  longitude: number
  latitude: number
  altitude: number
  angle: number
  satellites: number
  speed: number
  isValid: boolean
}

export interface IOElement {
  id: number
  value: number | bigint
  name?: string
  parsedValue?: string | number | boolean
}

export interface ParsedTelemetry {
  timestamp: Date
  gps: GPSData
  ignition?: boolean
  movement?: boolean
  externalVoltage?: number
  batteryVoltage?: number
  gsmSignal?: number
  gnssHdop?: number
  can?: CANData
  rawIO: IOElement[]
}

export interface CANData {
  fuelLevel?: number
  fuelUsed?: number
  fuelRate?: number
  engineRpm?: number
  engineHours?: number
  vehicleSpeed?: number
  odometer?: number
  coolantTemp?: number
  throttlePosition?: number
  engineLoad?: number
  brakeActive?: boolean
  cruiseControl?: boolean
  door1Open?: boolean
  door2Open?: boolean
  door3Open?: boolean
}
```

### 1.3 IO Elements Definition

**File: `packages/teltonika-parser/src/io-elements.ts`**

Full mapping of Teltonika IO element IDs to human-readable names with units and multipliers:

| Category | ID | Name | Unit | Multiplier |
|----------|-----|------|------|------------|
| Basic | 239 | ignition | - | - |
| Basic | 240 | movement | - | - |
| Basic | 66 | externalVoltage | mV | - |
| Basic | 67 | batteryVoltage | mV | - |
| Basic | 21 | gsmSignal | 1-5 | - |
| Basic | 182 | gnssHdop | - | 0.1 |
| CAN | 269 | canFuelLevel | % | 0.4 |
| CAN | 270 | canFuelUsed | L | 0.5 |
| CAN | 271 | canFuelRate | L/h | 0.05 |
| CAN | 272 | canEngineRpm | RPM | 0.125 |
| CAN | 273 | canEngineHours | h | 0.05 |
| CAN | 274 | canCoolantTemp | °C | -40 offset |
| CAN | 276 | canVehicleSpeed | km/h | - |
| CAN | 277 | canOdometer | km | 0.001 |
| CAN | 281 | canBrakeActive | bool | - |
| CAN | 283-285 | canDoorXStatus | bool | - |

### 1.4 Connection Manager

**File: `apps/tcp-server/src/connection-manager.ts`**

```typescript
interface Connection {
  socket: net.Socket
  imei: string | null
  state: 'authenticating' | 'active'
  buffer: Buffer
  lastActivity: Date
  parser: TeltonikaParser
}

class ConnectionManager {
  private connections: Map<string, Connection>

  // Handle new connections
  // Handle IMEI authentication
  // Handle reconnection (same IMEI, new socket)
  // Cleanup stale connections
  // TCP keepalive configuration
}
```

### 1.5 TCP Server Implementation

Key features:
- Buffer accumulation for TCP stream handling
- Proper packet boundary detection
- IMEI authentication with whitelist support
- CRC16 validation
- Graceful shutdown
- Metrics collection

### 1.6 Deliverables

- [ ] `@smart-city/teltonika-parser` package with full Codec 8 Extended support
- [ ] `@smart-city/shared` package with common types
- [ ] Production TCP server with connection management
- [ ] Unit tests for parser (100% coverage on parsing logic)
- [ ] Integration tests with sample Teltonika data

---

## Phase 2: Database & Persistence Layer

### 2.1 Technology Stack

- **PostgreSQL 16** - Primary database
- **PostGIS** - Geospatial extension
- **Prisma ORM** - Type-safe database access
- **TimescaleDB** (optional) - Time-series optimization

### 2.2 Database Schema

**Core Tables:**

```prisma
model Device {
  id        String   @id @default(cuid())
  imei      String   @unique
  name      String?
  vehicleId String?  @unique
  vehicle   Vehicle? @relation(...)
  isOnline  Boolean  @default(false)
  lastSeen  DateTime?
  firmware  String?
  model     String?

  telemetryRecords TelemetryRecord[]
  canRecords       CanDataRecord[]
}

model Vehicle {
  id             String      @id @default(cuid())
  registrationNo String      @unique
  type           VehicleType
  make           String?
  model          String?
  year           Int?
  capacity       Int?

  device           Device?
  routeAssignments RouteAssignment[]
}

model TelemetryRecord {
  id        BigInt   @id @default(autoincrement())
  deviceId  String
  timestamp DateTime

  // GPS data
  latitude   Float
  longitude  Float
  altitude   Int?
  speed      Int?
  heading    Int?
  satellites Int?
  hdop       Float?

  // Status
  ignition  Boolean?
  movement  Boolean?

  // Calculated
  distanceFromLast Float?

  receivedAt DateTime @default(now())

  @@index([deviceId, timestamp])
  @@index([timestamp])
}

model CanDataRecord {
  id        BigInt   @id @default(autoincrement())
  deviceId  String
  timestamp DateTime

  // Engine
  engineRpm         Int?
  engineHours       Float?
  engineCoolantTemp Int?
  engineLoad        Float?

  // Fuel
  fuelLevel Float?
  fuelUsed  Float?
  fuelRate  Float?

  // Speed & odometer
  vehicleSpeed Int?
  odometer     Int?

  // Diagnostics
  dtcCodes     String[]
  checkEngine  Boolean?

  // Doors
  door1Open Boolean?
  door2Open Boolean?
  door3Open Boolean?
}
```

**Route & Schedule Tables:**

```prisma
model Route {
  id          String @id @default(cuid())
  number      String
  name        String
  description String?
  color       String?
  isActive    Boolean @default(true)

  stops       RouteStop[]
  schedules   Schedule[]
}

model Stop {
  id        String  @id @default(cuid())
  name      String
  code      String? @unique
  latitude  Float
  longitude Float
  shelter   Boolean @default(false)
  display   Boolean @default(false)

  routes    RouteStop[]
  arrivals  StopArrival[]
}

model Geofence {
  id          String       @id @default(cuid())
  name        String
  type        GeofenceType // CIRCLE | POLYGON
  centerLat   Float?
  centerLng   Float?
  radius      Int?
  polygon     Json?
  speedLimit  Int?
  alertOnEnter Boolean @default(true)
  alertOnExit  Boolean @default(true)
}
```

### 2.3 Database Package Structure

```
packages/database/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── index.ts          # Prisma client export
│   ├── repositories/
│   │   ├── device.repository.ts
│   │   ├── telemetry.repository.ts
│   │   ├── vehicle.repository.ts
│   │   └── route.repository.ts
│   └── utils/
│       └── geo.utils.ts  # PostGIS helpers
├── package.json
└── tsconfig.json
```

### 2.4 Deliverables

- [ ] `@smart-city/database` package with Prisma schema
- [ ] Database migrations
- [ ] Repository pattern implementation
- [ ] PostGIS integration for geospatial queries
- [ ] Seeding scripts for test data
- [ ] Database backup strategy

---

## Phase 3: Real-time Infrastructure

### 3.1 Redis Architecture

Redis serves 4 distinct purposes:

| Purpose | Data Structure | Example |
|---------|----------------|---------|
| Cache | STRING | `device:{imei}:latest` → JSON telemetry |
| Pub/Sub | CHANNEL | `telemetry:{imei}` → real-time updates |
| Geo Index | GEO | `devices:positions` → lat/lng for radius queries |
| Queue Storage | LIST | BullMQ internal storage |

### 3.2 Redis Keys Structure

```
# Latest position cache (TTL: 1 hour)
device:{imei}:latest = {
  "lat": 44.7722,
  "lng": 17.1910,
  "speed": 45,
  "heading": 180,
  "timestamp": "2024-01-15T10:30:00Z",
  "ignition": true
}

# Device status
device:{imei}:status = "online" | "offline"

# Geo index for proximity queries
devices:positions = GEOADD 17.1910 44.7722 "imei1"

# Pub/Sub channels
telemetry:{imei}     - device-specific updates
telemetry:all        - all device updates
alerts:{imei}        - device alerts
```

### 3.3 WebSocket Server

**File: `apps/api/src/websocket/index.ts`**

```typescript
// Client subscribes to channels:
// - device:{imei} - single device updates
// - fleet - all devices
// - alerts - alert notifications

interface WebSocketMessage {
  type: 'telemetry' | 'alert' | 'status'
  deviceId: string
  data: TelemetryUpdate | Alert | StatusUpdate
}
```

### 3.4 Real-time Flow

```
1. TCP Server receives data from device
2. Parse & validate packet
3. Parallel operations:
   a. Redis SET (cache latest position)
   b. Redis GEOADD (update geo index)
   c. Redis PUBLISH (notify subscribers)
   d. BullMQ ADD (queue for persistence)
4. Send ACK to device
5. WebSocket server receives PUBLISH
6. Broadcast to connected clients
```

### 3.5 Deliverables

- [ ] Redis client configuration with connection pooling
- [ ] Cache service with TTL management
- [ ] Pub/Sub wrapper for real-time updates
- [ ] WebSocket server with authentication
- [ ] Client subscription management
- [ ] Reconnection handling

---

## Phase 4: REST/tRPC API

### 4.1 API Structure

```
apps/api/
├── src/
│   ├── index.ts
│   ├── server.ts           # Fastify server setup
│   ├── routes/
│   │   ├── devices.ts      # Device CRUD
│   │   ├── vehicles.ts     # Vehicle CRUD
│   │   ├── routes.ts       # Route management
│   │   ├── telemetry.ts    # Telemetry queries
│   │   ├── alerts.ts       # Alert management
│   │   └── analytics.ts    # Reports & statistics
│   ├── middleware/
│   │   ├── auth.ts         # JWT authentication
│   │   ├── rate-limit.ts   # Rate limiting
│   │   └── validation.ts   # Request validation
│   ├── websocket/
│   │   └── index.ts        # WebSocket handlers
│   └── services/
│       ├── device.service.ts
│       ├── telemetry.service.ts
│       └── alert.service.ts
├── package.json
└── tsconfig.json
```

### 4.2 API Endpoints

**Devices:**
```
GET    /api/devices              # List all devices
GET    /api/devices/:imei        # Get device details
GET    /api/devices/:imei/latest # Get latest telemetry
GET    /api/devices/:imei/history # Get historical data
POST   /api/devices              # Register device
PUT    /api/devices/:imei        # Update device
DELETE /api/devices/:imei        # Remove device
```

**Vehicles:**
```
GET    /api/vehicles             # List vehicles
GET    /api/vehicles/:id         # Get vehicle details
GET    /api/vehicles/:id/location # Get current location
POST   /api/vehicles             # Create vehicle
PUT    /api/vehicles/:id         # Update vehicle
DELETE /api/vehicles/:id         # Remove vehicle
POST   /api/vehicles/:id/assign-device # Assign device to vehicle
```

**Routes:**
```
GET    /api/routes               # List routes
GET    /api/routes/:id           # Get route details
GET    /api/routes/:id/stops     # Get route stops
GET    /api/routes/:id/vehicles  # Get vehicles on route
POST   /api/routes               # Create route
PUT    /api/routes/:id           # Update route
DELETE /api/routes/:id           # Delete route
```

**Telemetry:**
```
GET    /api/telemetry/live       # WebSocket upgrade for live data
GET    /api/telemetry/history    # Query historical data
GET    /api/telemetry/export     # Export to CSV/JSON
```

**Alerts:**
```
GET    /api/alerts               # List alerts
GET    /api/alerts/:id           # Get alert details
POST   /api/alerts/:id/acknowledge # Acknowledge alert
GET    /api/alerts/rules         # List alert rules
POST   /api/alerts/rules         # Create alert rule
```

**Analytics:**
```
GET    /api/analytics/fleet-summary     # Fleet overview
GET    /api/analytics/vehicle/:id/stats # Vehicle statistics
GET    /api/analytics/fuel-consumption  # Fuel reports
GET    /api/analytics/route-performance # Route analysis
```

### 4.3 Authentication

- JWT tokens for API authentication
- Role-based access control (ADMIN, DISPATCHER, ANALYST, VIEWER)
- API key support for device registration
- Rate limiting per endpoint and user

### 4.4 Deliverables

- [ ] Fastify server with TypeScript
- [ ] All REST endpoints implemented
- [ ] OpenAPI/Swagger documentation
- [ ] JWT authentication middleware
- [ ] Request validation with Zod
- [ ] Rate limiting
- [ ] Error handling
- [ ] Logging with Pino

---

## Phase 5: Background Workers

### 5.1 Worker Architecture

```
apps/worker/
├── src/
│   ├── index.ts
│   ├── processors/
│   │   ├── telemetry.processor.ts  # Save telemetry to DB
│   │   ├── alert.processor.ts      # Check alert conditions
│   │   ├── analytics.processor.ts  # Calculate statistics
│   │   └── cleanup.processor.ts    # Data retention
│   ├── jobs/
│   │   ├── save-telemetry.job.ts
│   │   ├── check-geofence.job.ts
│   │   ├── check-overspeed.job.ts
│   │   └── calculate-eta.job.ts
│   └── services/
│       ├── geofence.service.ts
│       └── eta.service.ts
├── package.json
└── tsconfig.json
```

### 5.2 Queue Configuration

```typescript
// Queues
const QUEUES = {
  telemetry: 'telemetry',      // High priority, fast processing
  alerts: 'alerts',            // Medium priority
  analytics: 'analytics',      // Low priority, can batch
  maintenance: 'maintenance'   // Scheduled jobs
}

// Job options
const telemetryJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: 1000,
  removeOnFail: 5000
}
```

### 5.3 Worker Responsibilities

**Telemetry Processor:**
- Insert telemetry record to PostgreSQL
- Insert CAN data record if present
- Calculate distance from previous point
- Update vehicle statistics

**Alert Processor:**
- Check geofence entry/exit
- Check overspeed conditions
- Check idle time
- Check fuel level
- Generate alert records
- Send notifications (push, email)

**Analytics Processor:**
- Calculate daily/weekly/monthly statistics
- Generate fuel consumption reports
- Calculate route efficiency
- Update ETA predictions

**Cleanup Processor (scheduled):**
- Archive old telemetry data
- Compress historical records
- Clean up expired cache entries
- Generate backup snapshots

### 5.4 Deliverables

- [ ] BullMQ worker setup
- [ ] Telemetry persistence processor
- [ ] Alert checking processor
- [ ] Scheduled maintenance jobs
- [ ] Worker monitoring and metrics
- [ ] Dead letter queue handling

---

## Phase 6: Advanced Features

### 6.1 Geofencing

```typescript
interface GeofenceService {
  // Check if point is inside geofence
  isInsideGeofence(point: {lat, lng}, geofence: Geofence): boolean

  // Get all geofences containing a point
  getGeofencesAtPoint(point: {lat, lng}): Geofence[]

  // Check entry/exit since last position
  checkGeofenceTransition(
    deviceId: string,
    previousPoint: Point,
    currentPoint: Point
  ): GeofenceEvent[]
}
```

### 6.2 ETA Calculation

```typescript
interface ETAService {
  // Calculate ETA to next stop
  calculateETAToStop(
    currentPosition: Point,
    routeId: string,
    stopId: string
  ): Date

  // Get all upcoming arrivals for a stop
  getUpcomingArrivals(stopId: string): Arrival[]

  // Update predictions based on real data
  updatePredictionModel(routeId: string): void
}
```

### 6.3 Alerts Configuration

| Alert Type | Condition | Severity |
|------------|-----------|----------|
| OVERSPEED | speed > limit | WARNING/CRITICAL |
| GEOFENCE_ENTER | entered restricted area | INFO |
| GEOFENCE_EXIT | left allowed area | WARNING |
| EXCESSIVE_IDLE | idle > 15min with ignition ON | WARNING |
| LOW_FUEL | fuel < 15% | WARNING |
| ENGINE_ERROR | DTC codes present | CRITICAL |
| DEVICE_OFFLINE | no data > 10min | WARNING |
| HARSH_BRAKING | deceleration > threshold | INFO |

### 6.4 Analytics & Reporting

**Fleet Summary:**
- Total vehicles / online / offline
- Total distance today
- Total fuel consumed
- Average speed
- Active alerts count

**Vehicle Statistics:**
- Distance traveled (daily/weekly/monthly)
- Fuel consumption
- Engine hours
- Idle time
- Speed profile
- Route adherence

**Route Performance:**
- On-time percentage
- Average delay
- Stop dwell times
- Passenger boarding patterns (if sensors available)

### 6.5 Deliverables

- [ ] Geofencing service with polygon and circle support
- [ ] ETA calculation with machine learning
- [ ] Alert rule engine
- [ ] Notification service (push, email, SMS)
- [ ] Analytics dashboard data endpoints
- [ ] Report generation (PDF, CSV)

---

## Deployment Architecture

### Development Environment

```yaml
# docker-compose.dev.yml
services:
  postgres:
    image: postgis/postgis:16-3.4
    ports: ["5432:5432"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  tcp-server:
    build: ./apps/tcp-server
    ports: ["5000:5000"]

  api:
    build: ./apps/api
    ports: ["3000:3000"]

  worker:
    build: ./apps/worker
```

### Production Environment

```yaml
# docker-compose.prod.yml
services:
  postgres:
    image: postgis/postgis:16-3.4
    volumes:
      - postgres_data:/var/lib/postgresql/data
    deploy:
      resources:
        limits:
          memory: 2G

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  tcp-server:
    build: ./apps/tcp-server
    ports: ["5000:5000"]
    deploy:
      replicas: 2

  api:
    build: ./apps/api
    ports: ["3000:3000"]
    deploy:
      replicas: 2

  worker:
    build: ./apps/worker
    deploy:
      replicas: 3

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
```

### Monitoring Stack

- **Prometheus** - Metrics collection
- **Grafana** - Dashboards
- **Loki** - Log aggregation
- **Uptime Kuma** - Uptime monitoring

---

## Testing Strategy

### Unit Tests
- Parser: 100% coverage on Codec 8E parsing
- Services: Business logic tests
- Repositories: Database query tests

### Integration Tests
- TCP Server: Full packet flow simulation
- API: Endpoint tests with test database
- Workers: Queue processing tests

### End-to-End Tests
- Device connection simulation
- Real-time data flow
- Alert generation

### Load Tests
- 1000 concurrent device connections
- 10,000 messages/second throughput
- WebSocket broadcast performance

---

## Security Considerations

1. **Device Authentication**
   - IMEI whitelist
   - Optional device certificates

2. **API Security**
   - JWT with short expiration
   - Refresh token rotation
   - Rate limiting
   - Input validation

3. **Infrastructure**
   - Firewall rules (only required ports)
   - TLS for all external connections
   - Database encryption at rest
   - Regular security audits

4. **Data Privacy**
   - GPS data anonymization options
   - Data retention policies
   - GDPR compliance (if applicable)

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: TCP Server & Parser | 1 week | - |
| Phase 2: Database | 1 week | Phase 1 |
| Phase 3: Real-time (Redis + WS) | 1 week | Phase 1, 2 |
| Phase 4: REST API | 2 weeks | Phase 2, 3 |
| Phase 5: Workers | 1 week | Phase 3, 4 |
| Phase 6: Advanced Features | 2 weeks | Phase 4, 5 |

**Total: 8-9 weeks for complete backend**

---

## Next Steps

1. **Immediate**: Complete Phase 1 implementation
2. **Setup**: Docker Compose for local development
3. **CI/CD**: GitHub Actions for automated testing and deployment
4. **Documentation**: API documentation with OpenAPI

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-02-03 | Initial comprehensive backend plan |
