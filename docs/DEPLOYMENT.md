# Production deployment

## Placement

Run the web app and worker on a VPS or office mini-PC that can reach the K50A **privately**.

Recommended:

- Same LAN as the terminal, or
- Site-to-site / WireGuard VPN, or
- 4G router with a private overlay

Do not DNAT TCP 4370 to a public IP.

## HTTPS

Terminate TLS at nginx or Caddy. Forward:

- `/` → web `:3000`
- `/socket.io` → worker `:3001`

Set:

```
NEXT_PUBLIC_APP_URL=https://atfs.example.com
NEXT_PUBLIC_SOCKET_URL=https://atfs.example.com
```

Cookies are `Secure` when `NODE_ENV=production`.

## Environment

- Unique `SESSION_SECRET` (≥ 32 characters)
- Unique `WORKER_INTERNAL_SECRET`
- `SIMULATION_MODE=false`
- `ALLOW_SIMULATION_IN_PRODUCTION=false`
- `DEVICE_ADAPTER=k50a`
- Real `DATABASE_URL`
- SMS `http` provider credentials on the server only

## Docker

```bash
cp .env.example .env
# edit secrets
docker compose up -d --build
docker compose exec web npx tsx prisma/seed.ts
```

Apply migrations on every release:

```bash
npx prisma migrate deploy
```

## Backups

Dump PostgreSQL daily. Raw punches and daily summaries are both in the database; the K50A is a second copy until logs are cleared on the device.

## Clearing device logs

`POST /api/devices/:id/clear` requires SUPER_ADMIN and body:

```json
{ "confirm": "DELETE_DEVICE_ATTENDANCE" }
```

This is audited. Prefer not to clear until several successful sync cycles have completed.
