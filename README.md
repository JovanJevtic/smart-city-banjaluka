# Smart City Banjaluka

Real-time fleet tracking system for public transportation using Teltonika FMC125 GPS devices.

## Architecture

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  Teltonika      │  TCP    │    TCP Server   │ Queue   │     Worker      │
│  FMC125 + LVCAN │────────►│   (Node.js)     │────────►│  (Background)   │
└─────────────────┘         └────────┬────────┘         └────────┬────────┘
                                     │                           │
                                     │ Redis                     │
                                     ▼                           ▼
                            ┌─────────────────┐         ┌─────────────────┐
                            │  Redis Cache    │         │   PostgreSQL    │
                            │  + Pub/Sub      │         │   + PostGIS     │
                            └─────────────────┘         └─────────────────┘
```

## Tech Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript 5
- **Build**: Turborepo + pnpm
- **Database**: PostgreSQL 16 + PostGIS
- **Cache**: Redis 7
- **Queue**: BullMQ
- **ORM**: Prisma

## Project Structure

```
smart-city/
├── apps/
│   ├── tcp-server/      # Receives data from Teltonika devices
│   ├── api/             # REST API (TODO)
│   └── worker/          # Background job processing
│
├── packages/
│   ├── database/        # Prisma schema and client
│   ├── shared/          # Shared types and constants
│   └── teltonika-parser/ # Teltonika Codec 8/8E parser
│
├── docker-compose.yml   # PostgreSQL + Redis
└── turbo.json           # Monorepo configuration
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose

### 1. Clone and Install

```bash
git clone <your-repo-url> smart-city
cd smart-city
pnpm install
```

### 2. Start Infrastructure

```bash
docker compose up -d
```

This starts:
- PostgreSQL on port 5432
- Redis on port 6379

### 3. Setup Environment

```bash
cp .env.example .env
```

### 4. Setup Database

```bash
# Generate Prisma client
pnpm db:generate

# Push schema to database
pnpm db:push

# (Optional) Seed with test data
pnpm --filter @smart-city/database db:seed
```

### 5. Start Development

```bash
# Start all services
pnpm dev

# Or start individually:
pnpm --filter @smart-city/tcp-server dev
pnpm --filter @smart-city/worker dev
```

## Configuration

See `.env.example` for all available options:

| Variable | Default | Description |
|----------|---------|-------------|
| `TCP_PORT` | 5000 | Port for Teltonika devices |
| `REDIS_HOST` | localhost | Redis host |
| `DATABASE_URL` | - | PostgreSQL connection string |
| `IMEI_WHITELIST` | - | Comma-separated allowed IMEIs |

## Teltonika Device Configuration

Configure your FMC125 device to connect to:

- **Server**: Your server IP
- **Port**: 5000
- **Protocol**: TCP

The server expects Teltonika Codec 8 Extended protocol.

## Development

### Build all packages

```bash
pnpm build
```

### Run tests

```bash
pnpm test
```

### View database

```bash
pnpm db:studio
```

## License

Private - Smart City Banjaluka
