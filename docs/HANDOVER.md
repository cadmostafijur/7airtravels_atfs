# ATFS handover — what is done, what is left

Deployment: **https://atfs.7airtravels.com** on the 7 Air Travels VPS
(`104.207.75.193`, ssh alias `7air`), sharing the box with the main
7airtravels.com website.

Last verified: 2026-08-23.

---

## Done and verified

| # | Item | Evidence |
| --- | --- | --- |
| 1 | Code deployed to `/var/www/atfs` | `next build` passed (typechecks; `next.config.ts` does not ignore errors) |
| 2 | Dependencies installed | `npm ci` clean, `node-zklib` patch reapplied |
| 3 | Worker bundle built | `dist/atfs-worker.mjs` |
| 4 | Neon database connected | `npm run db:check` → connected, 1 migration, 1 admin, 2 employees, 1 device |
| 5 | `atfs-web` on `127.0.0.1:3010` | pm2 online, `/login` → 200 |
| 6 | `atfs-worker` on `127.0.0.1:3011` | pm2 online, `/health` → ok |
| 7 | Survives reboot | `pm2 save` done; `pm2-root` already enabled at boot |
| 8 | DNS | `atfs.7airtravels.com` → `104.207.75.193` |
| 9 | HTTPS | Let's Encrypt, expires 2026-11-21, auto-renew scheduled |
| 10 | Live feed proxied | `/socket.io/` returns a real engine.io handshake through nginx |
| 11 | Main website unaffected | `https://7airtravels.com` → 200 after every nginx reload |
| 12 | OpenVPN installed | 2.6.19, config templates staged |
| 13 | Tunnel watchdog units installed | timer deliberately **disabled** until a tunnel exists |

Ports are **3010/3011** because the main site owns `:3000`. Neither is open in
UFW — nginx reaches them over loopback, and `WORKER_HOST=127.0.0.1` keeps the
worker off the public interface.

---

## Left to do

### Job 1 — Build the tunnel (blocks everything else) · *needs office access*

**Read [ROUTER-SETUP.md](./ROUTER-SETUP.md) first and check which router is
installed.** This determines the whole approach:

- **Archer C6** → Path A. Enable OpenVPN Server on the router, export the
  `.ovpn`, install it on the VPS as `/etc/openvpn/client/atfs.conf`.
  Needs a public office WAN IP or DDNS.
- **Archer C20** → **Path B, mandatory.** The C20 has no VPN Server at all.
  Run `deploy/openvpn/vps-server-setup.sh` on the VPS and put a small always-on
  box in the office to dial out.

Confirm with:

```bash
ssh 7air 'bash /var/www/atfs/deploy/vpn-check.sh'
```

All six hops must pass. Hop 5 (TCP 4370) is the one that proves it works.

### Job 2 — Enable the tunnel watchdog · *after Job 1*

```bash
ssh 7air 'systemctl enable --now atfs-tunnel-watchdog.timer'
```

Left off deliberately: with no tunnel it would restart a nonexistent unit every
five minutes.

### Job 3 — Point the device record at the terminal · *after Job 1*

The adapter reads the IP from the **database**, not from `K50A_IP` — that env
var only seeds a fresh install. The seeded record `K50A-001` already reads
`192.168.0.201:4370`, adapter `k50a`, so this is likely a no-op — but confirm in
**Admin → K50A Devices → K50A-001 → Test connection**.

Expected: TCP open in tens of ms plus tunnel latency, then a ZK handshake.

### Job 4 — Prove the K50A protocol works · *after Job 1* · **the real unknown**

Everything above is infrastructure and is verified. This is not.

The ZK protocol adapter has **never been tested against physical K50A
hardware** — the repo has said so since before this deployment
([K50A.md](./K50A.md)). The VPN neither helps nor hurts this.

Acceptance test:

1. Enroll a test employee on the terminal as device user `1001`
2. Place a finger on the K50A
3. Wait for the worker (30s) or hit **Sync now**
4. Confirm: one raw punch, updated daily summary, live dashboard row, 3 SMS
5. Sync again — still **one** punch (dedupe holds)

If TCP succeeds but the handshake fails, only
[`src/lib/devices/k50a-adapter.ts`](../src/lib/devices/k50a-adapter.ts) needs
replacing. Attendance rules, SMS, and the dashboard do not import the SDK.

### Job 5 — Change the bootstrap admin password · *do at go-live*

`.env` still carries the default `ChangeMe_Admin1!`. Log in and change it, or
reseed. `ADMIN_BOOTSTRAP_RESET_PASSWORD=false`, so a redeploy will not clobber
a changed password.

### Job 6 — Verify SMS actually sends · *independent of the tunnel*

BulkSMSBD key and the three admin numbers are set. **Admin → SMS → Send test.**
If it fails, check whether BulkSMSBD is IP-whitelisting — the VPS egress IP is
`104.207.75.193`; either whitelist it or disable source-IP checking.

### Job 7 — Add the deploy key so the VPS can `git pull` · *convenience*

Not added yet, so code currently ships with `git archive` over ssh. Add this as
a deploy key on `cadmostafijur/7airtravels_atfs`:

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIG4hfSvfpMwp7ag/TEMpg5EF7BVmZ6qZ5vAZ5LLdGXKy atfs-deploy-vps
```

The VPS remote is already `git@github-atfs:cadmostafijur/7airtravels_atfs.git`
with a matching ssh alias, so `git pull` starts working the moment the key lands.

### Job 8 — Merge the branch · *housekeeping*

Work is on `vps-openvpn-deployment`. Open a PR to `master` when the acceptance
test in Job 4 passes.

---

## Redeploying after a code change

```bash
cd /var/www/atfs
git pull                    # once Job 7 is done
npm ci
npx prisma migrate deploy
npm run build
npm run build:worker
pm2 restart atfs-web atfs-worker
```

## Monitoring

| Check | Meaning |
| --- | --- |
| `GET /health` on :3011 | worker alive, last sync result and error |
| `GET /health/devices` on :3011 | probes the K50A across the tunnel; **503** when unreachable |
| `journalctl -u openvpn-client@atfs -f` | tunnel up/down (`openvpn-server@atfs` on Path B) |
| `pm2 logs atfs-worker` | sync cycles, SMS sends |
| Admin → device → comm log | `TCP_PREFLIGHT` rows name the broken hop |

Point an uptime monitor at `/health/devices`. It returns 503 the moment the
tunnel dies, which is the difference between noticing in minutes and discovering
a lost day of attendance the next morning.

## Current expected state

Until Job 1 is done, `/health/devices` correctly returns **503** and the worker
logs:

```
K50A unreachable at 192.168.0.201:4370. No route to the office LAN.
The VPN tunnel is down or the route to the device subnet is missing.
```

That is the system working as designed, not a fault.

## Reference

- [ROUTER-SETUP.md](./ROUTER-SETUP.md) — C6 vs C20, both tunnel paths
- [VPS-VPN-DEPLOYMENT.md](./VPS-VPN-DEPLOYMENT.md) — full VPS runbook
- [K50A.md](./K50A.md) — adapter status and protocol notes
- [ADMS-CLOUD-PUSH.md](./ADMS-CLOUD-PUSH.md) — alternative if the device has a Cloud/ADMS menu
- [BANGLA-GUIDE.md](./BANGLA-GUIDE.md) — end-user guide
