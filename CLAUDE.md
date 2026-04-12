# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

GoMobility — a ride-hailing backend (Ola/Uber/Rapido style) for passengers and drivers. Node.js + Express 5 (ESM, `"type": "module"`), PostgreSQL, Redis, Socket.IO. Despite the repo name `GO____Backends`, this is **Node.js, not Go**.

## Commands

```bash
npm run dev       # nodemon src/server.js
npm start         # node src/server.js
npm run migrate   # node scripts/migrate.js — runs SQL migrations
```

No working test runner is wired up — `npm test` just exits with an error. Jest and supertest are installed but no test files exist; do not assume tests can be run.

Single-file syntax check (used after edits):
```bash
node --check src/path/to/file.js
```

## Architecture

### Entry & bootstrap
- `src/server.js` → connects Postgres (`infrastructure/database/postgres.js`) and Redis (`config/redis.config.js`), starts HTTP server, then initializes Socket.IO via `config/websocketConfig.js` + `infrastructure/websocket/socket.server.js`. Has graceful shutdown on SIGINT/SIGTERM.
- `src/app.js` → Express app, mounts everything under `ENV.API_PREFIX` (default `/api/v1`) via `src/routes/index.js`.
- `src/config/envConfig.js` → **single source of truth** for all config. Always import `ENV` from here, never read `process.env` directly. Contains DB, Redis, JWT, SMS, Razorpay, AWS, Firebase, surge pricing, vehicle fares, and dozens of tuning knobs.

### Module layout
Domain modules live under `src/modules/<domain>/` and follow a **strict layered convention**:
```
controllers/   → thin: parse req, call service, return JSON
services/      → business logic, orchestrates repos + cross-module services
repositories/  → SQL only (uses pg pool from infrastructure/database/postgres.js)
routes/        → express.Router, attaches middleware + validators + controllers
validators/    → joi or express-validator schemas
```
Domains: `auth`, `users`, `drivers`, `rides`, `wallet`, `payments`, `pricing`, `subscription`, `coupons`, `review`, `sos`, `support`, `kyc`, `admin`. Module routes are wired in `src/routes/index.js`.

When adding a feature, **stay inside one module** and follow the layering. Cross-module calls go service-to-service (e.g., `rideService` imports `couponService` and `subscriptionService`), never controller-to-controller and never repo-to-repo.

### Real-time / WebSocket layer
This is the part most likely to bite. Read `API_INTEGRATION.md` for the full event contract — it is the spec frontend teams code against.

- `config/websocketConfig.js` → initializes Socket.IO with the Redis adapter (`@socket.io/redis-adapter`) for horizontal scaling. Use `getIO()` to access the instance anywhere.
- `infrastructure/websocket/socket.server.js` → registers all `socket.on(...)` handlers in `setupSocketHandlers()`. Client events: `auth:login`, `auth:reconnect`, `driver:location_update`, `driver:availability_toggle`, `ride:accept`, `ride:reject`, `ride:join`, `ride:leave`, `ride:update`, `chat:send`, `chat:typing`.
- `infrastructure/websocket/socket.events.js` → emit helpers (`emitToDriver`, `emitToPassenger`, `emitRideStatusUpdate`, etc.) and the in-memory connection store.
- `infrastructure/websocket/reconnection.handler.js` → Redis-backed session persistence so server restarts don't drop ride state. Keys: `session:{userId}` (24h), `active_ride:{userId}` (1h), `msg_queue:{userId}` (24h), `location_history:{driverId}` (7d). On `auth:reconnect`, queued messages are flushed and ride rooms re-joined.
- `infrastructure/websocket/assignment.handler.js`, `payment.handler.js` → typed emission helpers used from services.

**Critical room invariant:** driver location pings are scoped to one ride via `io.to(\`ride:${rideId}\`).emit('driver:map_ping', ...)`. Both driver and passenger MUST `socket.emit('ride:join', { rideId })` for tracking to work. Do not change `driver:location_update` to broadcast to `io.emit(...)` — that was a bug already fixed.

**Service-to-socket integration pattern:** REST controllers call services; services emit socket events alongside FCM notifications. See `rideService.js` for the pattern — emissions are wrapped in a local `safeEmit()` helper so socket failures never break the API response. When adding new state changes to ride flow, follow the same pattern (FCM + socket emit, both wrapped, both right before returning).

### Pricing engine
`core/utils/rideCalculator.js` is the canonical fare calculator. It consumes ~50 tunable knobs from `ENV` (base fare, per-km, surge multipliers, peak hours, weather surge, platform fee, waiting/traffic/pickup compensation, convenience fees, cancellation rules) keyed by vehicle type (`bike`/`auto`/`car`). `rideService.requestRide` calls `gatherDemandSignals` (real-time demand, velocity, weather) before fare calculation. **Don't hardcode fare math anywhere else** — extend the calculator and add an `ENV.*` knob.

### Auth
JWT access (15m) + refresh (30d). OTP-based signup/signin via SMS — provider switchable through `ENV.SMS_PROVIDER` (`fast2sms` / `msg91` / `twilio` / `console`). The Fast2SMS integration uses endpoint `bulkV2`, lowercase `authorization` header, JSON body with `{ route: 'otp', variables_values, numbers: '91${phone}' }` — these specifics matter and have been broken before.

### Background jobs / queues
`infrastructure/queue/rideQueue.js`, `payment.queue.js` exist. Cron jobs use `node-cron`. Check before adding new background work.

## Conventions

- **ESM only.** All imports use `.js` extensions (e.g., `import x from './foo.js'`). Don't drop the extension.
- **Errors:** throw the typed errors from `core/errors/ApiError.js` (`ApiError`, `NotFoundError`, `ConflictError`, `AuthError`, `ValidationError`). The global error handler in `core/errors/globalErrorHandler.js` translates them to HTTP responses. Don't `res.status(...).json(...)` an error from a service.
- **Logging:** use `core/logger/logger.js` (winston, daily-rotate). Don't `console.log` in committed code.
- **Response shape:** `{ success: true, data, message }` or `{ success: false, message, errors }`. Match this in new endpoints.
- **DB access:** only from repositories. Services compose repos; controllers never touch `db` directly.
- **Hindi/Hinglish in comments:** the codebase has lots of Hinglish comments (e.g., "yeh add karna padega"). Don't reformat or translate them.

## API surface

`API_INTEGRATION.md` is the contract handed to the frontend teams (passenger app + driver app). It documents every REST endpoint, every socket event (emit + on), and the end-to-end ride flow diagram. **Update it whenever you add or change a public endpoint or socket event.**

## Things to know before editing

- `src/server.js` and `src/app.js` both contain large commented-out blocks of older versions. Don't delete them without checking; the active code is at the bottom of `server.js`.
- `envConfig.js` ships with hardcoded fallback secrets and a real Upstash Redis URL. Production deployments must override via `.env`. Don't commit changes that remove the fallbacks without making sure the deployment env has the values set.
- The driver-side socket emits in `rideService.requestRide` / `acceptRide` use `driver.user_id || driver.id`. Socket sessions key by `user_id` (the auth user), not the driver-row id. If you add new driver-targeted emits, use `user_id`.
- Default API prefix is `/api/v1` via `ENV.API_PREFIX`. Routes inside modules are relative to that.
