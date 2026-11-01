# LAST STOP: 3 AM — Backend

Node.js + Express + Socket.IO server for room-based online multiplayer.

## Run locally
1. Install Node.js 18 or newer.
2. Run `npm install`.
3. Run `npm start`.
4. Server listens on `http://localhost:3000`. Health check: `/health`.

## Deploy to Render
1. Push this folder's contents to a separate GitHub repository named `last-stop-backend`.
2. In Render, create **New + → Web Service** and connect the repository.
3. Runtime: Node. Build command: `npm install`. Start command: `npm start`.
4. No PORT variable is required; Render supplies `process.env.PORT`.
5. Optional environment variable `CORS_ORIGIN`: comma-separated allowed frontend origins, e.g. `https://your-game.vercel.app`. Leave unset for permissive CORS during initial testing.
6. Deploy. Copy the service URL (for example `https://last-stop-backend.onrender.com`) into the frontend Multiplayer server connection box.

## Events
Client → server: `rooms:list`, `room:create`, `room:join`, `room:ready`, `room:leave`, `game:start`, `player:move`, `game:action`.
Server → client: `rooms`, `lobby`, `notice`, `game:start`, `player:moved`, `game:event`.

Room passwords are held in server memory and are never sent in public room listings. Rooms are in-memory and disappear when the service restarts or all members leave. This starter does not include database persistence or production-grade anti-cheat.
