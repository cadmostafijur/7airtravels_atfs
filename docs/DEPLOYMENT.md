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
