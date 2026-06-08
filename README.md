# SkyWatch

Real-time flight tracker with map and radar views, powered by ADS-B data.

![SkyWatch](src/assets/hero.png)

## Features

- **Live aircraft tracking** — streams positions via WebSocket, updates every second
- **Two views** — interactive Leaflet map (OSM or satellite) and a sweep-radar display
- **Aircraft trails** — configurable trail length showing recent flight path
- **Color-coded by manufacturer** — Boeing, Airbus, Embraer, Gulfstream, and more each get a distinct color
- **Airport overlay** — shows large/medium/small airports with runway geometry and ident labels
- **Filtering** — filter by flight phase, aircraft type, altitude, and more
- **Configurable radius** — set your center location and tracking radius (up to ~500 km)
- **Smart label visibility** — labels declutter automatically based on zoom and density
- **Auto-reload on deploy** — frontend polls for new backend versions and reloads seamlessly
- **Idle cursor hide** — cursor disappears after inactivity for a clean fullscreen experience

## Architecture

```
┌─────────────┐     WebSocket      ┌──────────────┐     HTTP      ┌──────────────────┐
│   Browser   │ ◄────────────────► │   Backend    │ ────────────► │  ADS-B API       │
│  React/Vite │                    │  Node/Express│               │ airplanes.live   │
└─────────────┘                    └──────┬───────┘               │  or adsb.lol     │
                                          │                        └──────────────────┘
                                          ▼
                                   ┌──────────────┐
                                   │    Redis     │
                                   │  (aircraft   │
                                   │   cache)     │
                                   └──────────────┘
```

The backend snaps each client's viewport to a grid cell, polls the configured ADS-B source for that cell, and caches results in Redis. Multiple clients watching the same area share one upstream poll. Aircraft positions are interpolated client-side between server pushes for smooth animation.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, TypeScript, Vite, Zustand |
| Map | Leaflet + react-leaflet |
| Backend | Node.js, Express, Socket.IO |
| Cache | Redis |
| Container | Docker + Docker Compose |
| Data source | [airplanes.live](https://airplanes.live) / [adsb.lol](https://adsb.lol) |

## Running Locally

**Prerequisites:** Node.js 22+, Redis running locally (or Docker)

```bash
# Install frontend deps
npm install

# Install backend deps
cd backend && npm install && cd ..

# Start Redis (if using Docker)
docker run -d -p 6379:6379 redis:7-alpine

# Start backend
cd backend && REDIS_URL=redis://localhost:6379 npx tsx src/server.ts

# Start frontend (separate terminal)
npm run dev
```

Open `http://localhost:5173`.

## Docker Compose

```bash
# Copy and edit env
cp .env.example .env  # set ADS_SOURCE and POLL_INTERVAL_MS

docker compose up -d
```

The frontend is served by nginx on port 80. Set `VITE_BACKEND_URL` build arg to your backend's public URL.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ADS_SOURCE` | `https://api.airplanes.live/v2/point` | ADS-B API base URL |
| `POLL_INTERVAL_MS` | `3000` | How often to poll the upstream API per grid cell |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `PORT` | `3001` | Backend port |

## Development

```bash
npm run dev          # frontend dev server with HMR
npm test             # run unit tests (Vitest)
npm run lint         # ESLint
npm run build        # production build
```

```bash
cd backend
npm test             # backend unit tests
```

## ADS-B Data Sources

Two free public APIs are supported (switch via `ADS_SOURCE`):

- **airplanes.live** — `https://api.airplanes.live/v2/point/{lat}/{lon}/{radius}`
- **adsb.lol** — `https://api.adsb.lol/v2/point/{lat}/{lon}/{radius}`

Both return the same response format. For own-hardware ingestion (RTL-SDR dongle + `docker-adsb-ultrafeeder`), point `ADS_SOURCE` at your local readsb instance.

## License

MIT
