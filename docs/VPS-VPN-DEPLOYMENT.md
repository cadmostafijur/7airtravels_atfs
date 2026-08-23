# VPS + OpenVPN deployment (atfs.7airtravels.com)

The office worker PC is replaced by the VPS. The VPS dials into the office
router over OpenVPN and reaches the K50A on the office LAN as if it were local.

```
INTERNET
    │
┌───▼────────────┐
│ VPS  (7air)    │  atfs-web :3010  ·  atfs-worker :3011
│ 104.207.75.193 │  nginx -> https://atfs.7airtravels.com
└───┬────────────┘
    │  OpenVPN client (tun0)
┌───▼────────────┐
│ Archer C6      │  OpenVPN server, office WAN
└───┬────────────┘
    │  Office LAN 192.168.0.0/24
┌───▼────────────┐
│ K50A           │  192.168.0.201:4370
└────────────────┘
```

**No application code is VPN-aware, and none needs to be.** The tunnel is a
routing concern: the worker opens a plain TCP socket to `192.168.0.201:4370`
and the kernel sends it down `tun0`. What this repo adds is *diagnosis* — when
the tunnel breaks, the failure says so instead of reporting a generic timeout.

## Prerequisites

- The office WAN must have a **public IP** (static, or dynamic + DDNS). The
  Archer C6 is the OpenVPN *server*, so the VPS must be able to dial in. Behind
  CGNAT this topology is impossible — see [If the office is behind CGNAT](#if-the-office-is-behind-cgnat).
- The K50A must use the **Archer C6 as its default gateway**, or replies to VPN
  clients never find their way back.
- A DNS `A` record: `atfs.7airtravels.com` → `104.207.75.193`.

---

## 1. Archer C6 — OpenVPN server

TP-Link web UI → **Advanced → VPN Server → OpenVPN**.

1. **Service Type**: UDP · **Service Port**: 1194
2. **VPN Subnet/Netmask**: `10.8.0.0 / 255.255.255.0` (must not overlap
   `192.168.0.0/24`)
3. **Client Access**: **Home Network and Internet** — despite the name, this is
   what makes the router advertise the LAN. The VPS config below refuses the
   default route anyway, so only office traffic uses the tunnel.
4. **Enable VPN Server** → **Save**
5. **Generate** the certificate, then **Export** the `.ovpn` file.

If the WAN IP is dynamic, also set up **Advanced → Network → Dynamic DNS** and
use that hostname as `remote` below.

Port-forwarding note: you are opening **UDP 1194 to the router itself**, which
the VPN server does automatically. Do **not** forward TCP 4370 — the whole point
of the tunnel is that the terminal stays off the public internet.

## 2. VPS — OpenVPN client

```bash
apt-get update && apt-get install -y openvpn
# copy the exported file from the router
scp Archer_C6.ovpn 7air:/etc/openvpn/client/atfs.conf
```

Then edit `/etc/openvpn/client/atfs.conf` and append the block from
[`deploy/openvpn/atfs.conf.example`](../deploy/openvpn/atfs.conf.example) —
in particular:

```
keepalive 10 60          # notice a dead tunnel in a minute, not in ten
route 192.168.0.0 255.255.255.0
route-nopull             # never pull the office default route onto the VPS
```

`route-nopull` matters: without it the router can push a default route and the
**entire VPS — including the public 7airtravels.com website — would exit through
the office internet connection.**

Start it. The unit name comes from the filename (`atfs.conf` → `@atfs`):

```bash
systemctl enable --now openvpn-client@atfs
systemctl status openvpn-client@atfs
ip addr show tun0
ip route get 192.168.0.201     # must say "dev tun0"
```

## 3. Verify the path before deploying the app

```bash
bash /var/www/atfs/deploy/vpn-check.sh
```

It walks each hop and stops at the first broken one. Hop 5 (TCP 4370) is the one
that matters — many K50A units ignore ping, so a failed hop 4 is not fatal.

## 4. Deploy the app

```bash
cd /var/www/atfs
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build           # Next.js app
npm run build:worker    # dist/atfs-worker.mjs for pm2
pm2 start ecosystem.config.cjs
pm2 save
```

`.env` on the VPS (see the VPS block at the bottom of `.env.example`):

```
NODE_ENV=production
PORT=3010
WORKER_PORT=3011
WORKER_HOST=127.0.0.1
NEXT_PUBLIC_APP_URL=https://atfs.7airtravels.com
NEXT_PUBLIC_SOCKET_URL=https://atfs.7airtravels.com
DEVICE_ADAPTER=k50a
SIMULATION_MODE=false
K50A_IP=192.168.0.201
K50A_PORT=4370
```

Ports 3010/3011 are chosen because the main 7airtravels.com site already owns
:3000. Neither is opened in UFW — nginx reaches them over loopback.

## 5. nginx + TLS

```bash
cp deploy/nginx/atfs.7airtravels.com.conf /etc/nginx/sites-available/atfs
ln -s /etc/nginx/sites-available/atfs /etc/nginx/sites-enabled/atfs
nginx -t && systemctl reload nginx
certbot --nginx -d atfs.7airtravels.com
```

`/socket.io/` is proxied to the worker on :3011 and must stay **above**
`location /`, or the WebSocket upgrade gets sent to Next.js instead.

## 6. Point the device record at the LAN IP

The adapter reads the IP from the **database**, not from `K50A_IP` (that env var
only seeds a new install). In **Admin → K50A Devices → device**, set:

- IP `192.168.0.201`, port `4370`
- Adapter `k50a`
- Timeout `60000`

Then **Test connection**. Expected: TCP open in a few tens of ms plus tunnel
latency, then a successful ZK handshake.

## 7. Watchdog (recommended)

OpenVPN can hold a session that looks connected while the far side has gone away
after a router reboot or ISP re-IP. The watchdog probes the device port and
bounces the tunnel after two consecutive failures:

```bash
cp deploy/systemd/atfs-tunnel-watchdog.* /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now atfs-tunnel-watchdog.timer
```

## Monitoring

| Check | Meaning |
| --- | --- |
| `GET /health` (worker) | process alive, last sync result |
| `GET /health/devices` | actually probes the K50A across the tunnel; **503** when unreachable |
| `journalctl -u openvpn-client@atfs -f` | tunnel up/down events |
| `pm2 logs atfs-worker` | sync cycles, SMS |
| Admin → device → comm log | `TCP_PREFLIGHT` rows name the broken hop |

Point an uptime monitor at `/health/devices` and you learn the tunnel is down
within minutes, rather than discovering a day of missing attendance later.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `ENETUNREACH` / `EHOSTUNREACH` | tunnel down or the `192.168.0.0/24` route is missing |
| TCP timeout, tunnel up | K50A off, on a different IP, or not using the router as gateway |
| `ECONNREFUSED` | host answered but nothing on 4370 — wrong port |
| Tunnel connects, then drops every few minutes | UDP 1194 blocked or MTU issue — try `proto tcp`, or add `mssfix 1300` |
| Whole VPS loses internet after connecting | `route-nopull` is missing |
| Device works, dashboard shows no live rows | `/socket.io/` block missing or below `location /` |

### If the office is behind CGNAT

If the router's WAN IP (`Advanced → Status`) differs from what
`curl ifconfig.me` reports from the office, the ISP is using CGNAT and **the VPS
cannot dial in** — this topology will not work as drawn.

Flip the tunnel instead: run a VPN *server* on the VPS (which has a public IP)
and have an always-on office box dial **out** to it. Everything downstream of
the tunnel — the worker, the device record, nginx — is unchanged, because the
application only ever sees a route to `192.168.0.201`.
