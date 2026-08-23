# 7 Air Travels ATFS

Fingerprint Attendance Management System for **7 Air Travels Limited**, built around a **ZKTeco K50A** terminal on the office LAN.

```
Employee fingerprint
  → K50A (stores punches locally)
  → TCP/IP Ethernet on the office LAN
  → Device adapter (isolated)
  → Sync worker (idempotent)
  → PostgreSQL
  → Daily attendance rules
  → Live Next.js dashboard (Socket.IO)
  → SMS to 3 administrators
```

The K50A is the source of truth for device-side punches. If the server or internet is down, the terminal keeps storing transactions. When the backend returns, synchronization downloads missing punches and **deduplicates** them.

## Bangla guide

Full step-by-step guide in Bangla: [docs/BANGLA-GUIDE.md](docs/BANGLA-GUIDE.md)  
After login, open **Bangla Guide** in the sidebar.

---

## What is verified vs not verified

| Layer | Status |
| --- | --- |
| Application, PostgreSQL, Prisma, auth, dashboard, SMS pipeline, mock device, sync dedupe | Implemented and testable without hardware |
| Raw TCP reachability to `IP:port` | Implemented (no SDK required) |
| ZK protocol via `node-zklib` against a **physical K50A** | **UNVERIFIED** |

`node-zklib` speaks the common ZKTeco standalone protocol (TCP, often port 4370). That is a **candidate**, not a guarantee. The K50A-specific code lives only in `src/lib/devices/k50a-adapter.ts`. If the firmware does not speak this protocol, replace that one file. Attendance rules, SMS, and the dashboard do not import the SDK.

Do not expose the K50A TCP port to the public internet. Use the office LAN, a VPN, or a 4G router with a private tunnel.

---

## Architecture

```
K50A  →  K50AAdapter | MockAdapter
                 ↓
            DeviceService / diagnostics
                 ↓
            Attendance ingest (unique deviceId + deviceUserId + timestamp)
                 ↓
            DailyAttendanceSummary (processed, separate from raw punches)
                 ↓
            PostgreSQL + Socket.IO worker + SMS provider
                 ↓
            Next.js admin desk
```

`DeviceAdapter` methods: `connect`, `disconnect`, `getDeviceInfo`, `getUsers`, `createUser`, `updateUser`, `deleteUser`, `getAttendanceLogs`, `getDeviceStatus`, `clearAttendanceLogs`.

User enrollment on the physical terminal is **not invented** here. Map `deviceUserId` in the employee record. Fingerprint templates stay on the K50A.

---

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- PostgreSQL + Prisma
- Socket.IO worker for `attendance:new`
- bcrypt password hashing, HTTP-only signed cookies
- Provider-independent SMS (`console` | `http` | `failing`)

---

## Quick start (Windows)

1. Copy environment file and set your **Neon** `DATABASE_URL` + `DIRECT_URL` (see `.env.example`):

```powershell
Copy-Item .env.example .env
```

2. Generate client, migrate, seed (uses Neon — **no Docker, no local PostgreSQL**):

```powershell
npx prisma generate
npx prisma migrate deploy
npx tsx prisma/seed.ts
```

3. Run the web app and the sync/realtime worker:

```powershell
npm run dev:all
```

4. Open [http://localhost:3000](http://localhost:3000)

Default admin (change immediately):

- Email: `admin@7airtravels.local`
- Password: `ChangeMe_Admin1!`

With `SIMULATION_MODE=true` and `DEVICE_ADAPTER=mock`, open **Simulation** and **K50A Devices** to exercise the full pipeline without hardware.

---

## Hardware connectivity test (priority)

On the office LAN, set `K50A_IP` / `K50A_PORT` (do not assume 4370 if the terminal uses another port).

```powershell
npx tsx scripts/device-probe.ts --ip 192.168.1.201 --port 4370
```

Or use **Admin → K50A Devices → device → Test connection**.

The diagnostic always:

1. Probes TCP (independent of the SDK)
2. Attempts a ZK handshake
3. Reads info / users / attendance
4. Logs errors to `DeviceCommLog`

If TCP works and the handshake fails, the adapter must be replaced — the rest of the system stays.

---

## Synchronization

The worker (`src/server/worker.ts`) polls every `SYNC_INTERVAL_MS` (default 30s):

1. Download punches
2. Match `deviceUserId` → employee
3. Insert only if `(deviceId, deviceUserId, timestamp)` is new
4. Recalculate that day's summary
5. Emit `attendance:new`
6. SMS the 3 admin numbers (never blocks attendance on SMS failure)

`SyncLog` stores read / inserted / skipped / failed counts.

---

## Attendance rules

Configured on **Shifts**, not in code. Default seed:

- Office start `09:00`
- Late after `09:15`
- Office end `18:00`
- Weekend Friday + Saturday (Bangladesh office default; change as needed)

Raw punches remain in `Attendance`. Processed day status lives in `DailyAttendanceSummary`.

---

## SMS

Set three numbers on **Admin SMS**. Provider is selected with `SMS_PROVIDER`:

- `console` — log only (development)
- `http` — generic Bangladesh HTTP gateway (`SMS_API_URL`, `SMS_API_KEY`, `SMS_SENDER_ID`)
- `failing` — used by the simulation scenario

Notification key: `attendanceId + eventType + recipient`. Successful SMS is never sent twice for the same punch.

---

## Roles

| Role | Access |
| --- | --- |
| SUPER_ADMIN | Everything, including audit and destructive device actions |
| ADMIN | Employees, attendance, reports, SMS, device monitoring/sync |
| VIEWER | Dashboard, attendance, reports |

---

## Production

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

Live deployment: **VPS + OpenVPN to the office router** — the VPS reaches the
LAN-only K50A through a tunnel to the Archer C6, so no office PC is needed.
See [docs/VPS-VPN-DEPLOYMENT.md](docs/VPS-VPN-DEPLOYMENT.md).

**Docker is not required.** With Neon PostgreSQL you deploy two Node processes on a VPS or office server:

1. **Web** — `npm run build && npm run start` (port 3000)
2. **Worker** — `npm run start:worker` (port 3001, K50A sync + Socket.IO)

Minimum:

- VPS or office PC on the same LAN as the K50A (or VPN)
- **Neon** for PostgreSQL (`DATABASE_URL` + `DIRECT_URL` in `.env`)
- HTTPS in front of the web UI (nginx / Caddy)
- Do **not** port-forward K50A TCP `4370` to the internet
- `SIMULATION_MODE=false`, `DEVICE_ADAPTER=k50a`
- Strong `SESSION_SECRET` and `WORKER_INTERNAL_SECRET`

`docker-compose.yml` exists only as an **optional** alternative if you prefer containers. You can ignore it entirely.

---

## Acceptance test (when the physical K50A is on the LAN)

1. Enroll **Test Employee** on the K50A as device user `1001` (already seeded as `EMP001`)
2. Place finger on the K50A
3. Run **Sync now** (or wait for the worker)
4. Confirm one raw punch, updated daily summary, live dashboard row, and three SMS attempts
5. Sync again — still one punch

Until that hardware test passes, treat the K50A adapter as a replaceable candidate.

---

## Project map

```
prisma/schema.prisma          Data model + unique punch constraint
src/lib/devices/              DeviceAdapter, K50AAdapter, MockAdapter, TCP probe
src/lib/attendance/           Ingest, daily rules, dashboard stats, simulation
src/lib/sms/                  SmsProvider + Bangladesh HTTP adapter
src/server/worker.ts          Sync loop + Socket.IO
src/app/admin/devices/[id]    Hardware diagnostic desk
scripts/device-probe.ts       CLI connectivity test
```
