# Smart City Banja Luka — Deploy Phases 3-6

## Sta je novo

- **API server** (`apps/api`) — Fastify REST API + WebSocket na portu 3000
- **Worker** — Alert triggering iz telemetrije, analytics (1 AM), cleanup (3 AM), offline check (5 min)
- **Database** — Nova tabela `device_daily_stats` za dnevnu analitiku
- **PM2** — Dodat API server entry

## Koraci za deploy

### 1. Pull koda

```bash
cd /opt/smart-city
git pull origin main
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Build

```bash
pnpm turbo build
```

### 4. Push nove tabele u bazu

```bash
pnpm db:push
```

Ovo kreira `device_daily_stats` tabelu. Potvrditi sa `Yes` kad pita.

### 5. Restart PM2

```bash
pm2 restart all
```

Ili ako API server nije prethodno bio registrovan:

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

### 6. Verifikacija

```bash
# Health check
curl http://localhost:3000/health

# Registruj test korisnika
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@smartcity.ba","password":"admin123","name":"Admin","role":"ADMIN"}'

# Login (vraca JWT token)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@smartcity.ba","password":"admin123"}'

# Test sa tokenom (zamijeni <TOKEN> sa dobijenim tokenom)
curl http://localhost:3000/api/devices \
  -H "Authorization: Bearer <TOKEN>"

# Provjeri alerts
curl http://localhost:3000/api/alerts \
  -H "Authorization: Bearer <TOKEN>"

# Provjeri fleet analytics
curl http://localhost:3000/api/analytics/fleet-summary \
  -H "Authorization: Bearer <TOKEN>"

# PM2 status
pm2 status
pm2 logs api --lines 20
```

### 7. WebSocket test (opciono)

Koristi `wscat` ili browser console:

```bash
npx wscat -c "ws://localhost:3000/ws?token=<TOKEN>"
```

Posalji:
```json
{"subscribe":"fleet"}
{"subscribe":"alerts"}
```

## Novi API endpointi

| Metoda | Endpoint | Opis |
|--------|----------|------|
| GET | `/health` | Health check |
| POST | `/api/auth/register` | Registracija |
| POST | `/api/auth/login` | Login (vraca JWT) |
| GET | `/api/auth/me` | Profil korisnika |
| GET/POST/PUT/DELETE | `/api/devices` | CRUD uredjaji |
| GET/POST/PUT/DELETE | `/api/vehicles` | CRUD vozila |
| GET/POST/PUT/DELETE | `/api/routes` | CRUD rute |
| GET/POST/PUT/DELETE | `/api/geofences` | CRUD geofence zone |
| GET | `/api/telemetry/history` | Historija telemetrije |
| GET | `/api/telemetry/export` | CSV/JSON export |
| GET | `/api/alerts` | Lista alerta |
| GET | `/api/alerts/stats` | Statistika alerta |
| POST | `/api/alerts/:id/acknowledge` | Potvrdi alert |
| GET | `/api/analytics/fleet-summary` | Fleet pregled |
| GET | `/api/analytics/vehicle/:id/stats` | Statistika vozila |
| WS | `/ws?token=...` | WebSocket real-time |

## Scheduled jobovi (automatski)

- **Daily stats** — Svaki dan u 1:00 AM, agregira dnevnu statistiku po uredjaju
- **Archive telemetry** — Svaki dan u 3:00 AM, brise telemetriju stariju od 90 dana
- **Offline check** — Svakih 5 minuta, markira uredjaje offline ako nema signala 10+ min
