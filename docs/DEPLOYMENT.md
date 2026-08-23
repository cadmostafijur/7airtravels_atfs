# Production deployment

Docker is **optional**. This project is designed to run with **Neon PostgreSQL** and plain **Node.js** on a server.

## What you need

| Piece | Recommendation |
| --- | --- |
| Database | **Neon** (cloud PostgreSQL) — already used in `.env` |
| Web app | Node.js 22+ on VPS or office PC |
| Sync worker | Same server, second process (`npm run start:worker`) |
| K50A | Office LAN / Ethernet (not Docker, not public internet) |
| Docker | **Not required** |

## Server placement

Run the app on a machine that can reach the K50A **privately**:

- Same office LAN as the terminal, or
- Site-to-site / WireGuard VPN, or
- 4G router with a private overlay

Do not DNAT TCP 4370 to a public IP.

## Deploy without Docker

On the server:

```bash
git clone <your-repo>
cd 7airtravels_atfs
cp .env.example .env
# Set Neon DATABASE_URL, DIRECT_URL, secrets, K50A_IP, SMS, etc.

npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
npx tsx prisma/seed.ts   # first time only
```

Run both processes (use PM2, systemd, or Windows Service):

```bash
# Terminal 1 — dashboard + API
npm run start

# Terminal 2 — K50A sync + live Socket.IO
npm run start:worker
```

Example with PM2:

```bash
pm2 start npm --name atfs-web -- start
pm2 start npm --name atfs-worker -- run start:worker
pm2 save
```

## Best setup (CEO never opens anything)

### Option A — Cloud push (no mini PC)

If the K50A has a **Cloud / ADMS** menu and internet access, the device pushes punches to Vercel. **No office worker.**

Full steps: **[ADMS-CLOUD-PUSH.md](./ADMS-CLOUD-PUSH.md)**

If there is **no** ADMS/Cloud menu on the device, Option A is impossible — use Option B.

### Option B — Mini PC always on + Vercel website

| Piece | Best choice | Why |
| --- | --- | --- |
| Admin website | **Vercel** | CEO/admins use `https://…` from phone anytime |
| Database | **Neon** (already) | Cloud shared DB |
| Sync + SMS | **Small always-on mini PC** in office | Only machine that can see LAN-only K50A |

### Why not “Vercel only” without ADMS?

A LAN-only K50A cannot be reached by Vercel. Then you need Option B.

### What to buy / use (Option B)

1. Cheap **mini PC** (or spare desktop) — leave it **always powered on** (disable Sleep/Hibernate).
2. Ethernet/Wi‑Fi same network as K50A (`192.168.0.x`).
3. Install Node.js + this project once.
4. Run **as Administrator** once:

```bash
npm ci
npm run service:install
```

Worker starts at **PC boot** as a Windows service (no login click, no terminal).

5. Deploy website to **Vercel** for the CEO.

### Power / shutdown rules

| Office PC / mini PC | Fingerprint SMS |
| --- | --- |
| ON (worker running) | Works |
| Sleep / Shutdown / Power cut | **Stops** until power + boot again |
| Only website on Vercel, no mini PC | Website opens, **SMS does not** |

Optional: small UPS so short load-shedding does not kill the mini PC.

### What the CEO does day-to-day

- Open Vercel URL → login → see attendance / SMS logs  
- **Never** starts worker, Cursor, or localhost  

#### Prefer no office PC at all?

If the K50A has a **Cloud / ADMS** menu and internet, use push to Vercel instead of a worker:

→ See **[ADMS-CLOUD-PUSH.md](./ADMS-CLOUD-PUSH.md)**

If the device has **no** ADMS menu, cloud-only is impossible — use the mini PC / worker path above.

## Always-on office worker (required)

The K50A is on the **office LAN**. Vercel (cloud) cannot reach it. Something in the office must run the sync worker 24/7.

**This is normal for biometric devices** — not a Vercel bug.

### Install worker so nobody opens a terminal

**Recommended:** NSSM Windows Service (auto-start at boot, file logging, auto-restart).

On the office mini PC (same Wi‑Fi/LAN as K50A), **PowerShell as Administrator**, once:

```bash
npm ci
npm run service:install
```

That registers Windows service `7AirTravels-ATFS-Worker` which:

- Starts automatically when Windows **boots**
- Runs in the background (no terminal, no Cursor)
- Restarts on crash (10 s delay, 30 s throttle)
- Writes logs to `logs/worker/`

Manage without admin (after install):

```bash
npm run service:status
npm run service:restart
npm run service:stop
npm run service:start
```

Remove (Administrator):

```bash
npm run service:uninstall
```

**Legacy alternative:** Task Scheduler via `npm run worker:autostart` (still supported).

### Manual (testing only)

```bash
npm run start:worker
```

If you close that window, fingerprint → SMS stops until the worker runs again.

## HTTPS

Terminate TLS at nginx or Caddy. Forward:

- `/` → web `:3000`
- `/socket.io` → worker `:3001`

Set:

```
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://atfs.yourdomain.com
NEXT_PUBLIC_SOCKET_URL=https://atfs.yourdomain.com
SIMULATION_MODE=false
DEVICE_ADAPTER=k50a
```

Cookies are `Secure` when `NODE_ENV=production`.

## Environment checklist

- Neon `DATABASE_URL` (pooled) + `DIRECT_URL` (direct, for migrations)
- Unique `SESSION_SECRET` (≥ 32 characters)
- Unique `WORKER_INTERNAL_SECRET`
- `SIMULATION_MODE=false`
- `ALLOW_SIMULATION_IN_PRODUCTION=false`
- `DEVICE_ADAPTER=k50a`
- SMS credentials on the server only (never in frontend)

## Migrations on each release

```bash
npx prisma migrate deploy
npm run build
pm2 restart atfs-web atfs-worker
```

## Backups

Neon provides automated backups on paid plans. You can also export from the Neon console. Raw punches and daily summaries live in PostgreSQL; the K50A keeps a second copy until device logs are cleared.

## Optional: Docker

If you prefer containers, `docker-compose.yml` is available — but with Neon you typically only need the `web` and `worker` services and **not** the local `db` service. Most teams using Neon skip Docker entirely.

## Clearing device logs

`POST /api/devices/:id/clear` requires SUPER_ADMIN and body:

```json
{ "confirm": "DELETE_DEVICE_ATTENDANCE" }
```

This is audited. Prefer not to clear until several successful sync cycles have completed.
