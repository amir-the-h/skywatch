// backend/src/server.ts
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { RedisStore } from './RedisStore';
import { FetchQueue } from './FetchQueue';
import { snapToGrid, cellKey } from './GridEngine';
import { pollCell } from './CellPoller';

const PORT = parseInt(process.env.PORT ?? '3001');
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? '1000');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

const store = new RedisStore(REDIS_URL);

interface SocketInfo {
  gLat: number;
  gLon: number;
  userLat: number;
  userLon: number;
  radiusKm: number;
}

// socketId → location info
const socketMap = new Map<string, SocketInfo>();
// cellKey → { gLat, gLon, sockets: Map<socketId, { userLat, userLon, radiusKm }> }
const cellMap = new Map<
  string,
  { gLat: number; gLon: number; sockets: Map<string, { userLat: number; userLon: number; radiusKm: number }> }
>();

const queue = new FetchQueue(async (ck: string) => {
  const cell = cellMap.get(ck);
  if (!cell || cell.sockets.size === 0) return;
  const maxRadiusKm = Math.max(...[...cell.sockets.values()].map((s) => s.radiusKm));
  await pollCell(cell.gLat, cell.gLon, maxRadiusKm, store, io, cell.sockets);
}, POLL_INTERVAL_MS);

async function registerSocket(
  socketId: string,
  userLat: number,
  userLon: number,
  radiusKm: number
): Promise<void> {
  const { gLat, gLon } = snapToGrid(userLat, userLon);
  const ck = cellKey(gLat, gLon);

  socketMap.set(socketId, { gLat, gLon, userLat, userLon, radiusKm });

  if (!cellMap.has(ck)) {
    cellMap.set(ck, { gLat, gLon, sockets: new Map() });
  }
  cellMap.get(ck)!.sockets.set(socketId, { userLat, userLon, radiusKm });

  const maxRadiusKm = Math.max(
    ...[...cellMap.get(ck)!.sockets.values()].map((s) => s.radiusKm)
  );
  await store.saveCellMeta(gLat, gLon, maxRadiusKm);
  queue.addCell(ck);
}

async function unregisterSocket(socketId: string): Promise<void> {
  const info = socketMap.get(socketId);  // ← use socketId, not socket.id
  if (!info) return;

  const ck = cellKey(info.gLat, info.gLon);
  const cell = cellMap.get(ck);
  if (cell) {
    cell.sockets.delete(socketId);
    if (cell.sockets.size === 0) {
      cellMap.delete(ck);
      queue.removeCell(ck);
      await store.deleteCell(info.gLat, info.gLon);
    } else {
      const maxRadiusKm = Math.max(...[...cell.sockets.values()].map((s) => s.radiusKm));
      await store.saveCellMeta(info.gLat, info.gLon, maxRadiusKm);
    }
  }
  socketMap.delete(socketId);
}

io.on('connection', (socket) => {
  console.log(`[socket] connect   ${socket.id} (total: ${io.engine.clientsCount})`);

  socket.on(
    'register_location',
    async ({ lat, lon, radiusKm }: { lat: number; lon: number; radiusKm: number }) => {
      const existing = socketMap.get(socket.id);
      if (existing) {
        const { gLat: newGLat, gLon: newGLon } = snapToGrid(lat, lon);
        if (existing.gLat !== newGLat || existing.gLon !== newGLon) {
          await unregisterSocket(socket.id);
        } else {
          // Same cell — update radius only
          const ck = cellKey(existing.gLat, existing.gLon);
          const cell = cellMap.get(ck);
          if (cell) {
            cell.sockets.set(socket.id, { userLat: lat, userLon: lon, radiusKm });
            socketMap.set(socket.id, { ...existing, userLat: lat, userLon: lon, radiusKm });
            const maxRadiusKm = Math.max(...[...cell.sockets.values()].map((s) => s.radiusKm));
            await store.saveCellMeta(existing.gLat, existing.gLon, maxRadiusKm);
          }
          return;
        }
      }
      const { gLat, gLon } = snapToGrid(lat, lon);
      console.log(`[socket] register  ${socket.id} → lat=${lat.toFixed(4)} lon=${lon.toFixed(4)} radius=${radiusKm}km cell=${gLat}:${gLon}`);
      await registerSocket(socket.id, lat, lon, radiusKm);
    }
  );

  socket.on('disconnect', async () => {
    console.log(`[socket] disconnect ${socket.id} (total: ${io.engine.clientsCount - 1})`);
    await unregisterSocket(socket.id);
  });
});

app.get('/health', (_req, res) => res.json({ ok: true }));

async function main() {
  await store.connect();
  httpServer.listen(PORT, () => {
    console.log(`[server] listening on port ${PORT}`);
    console.log(`[server] redis: ${REDIS_URL}`);
    console.log(`[server] poll interval: ${POLL_INTERVAL_MS}ms`);
  });
}

main().catch(console.error);
