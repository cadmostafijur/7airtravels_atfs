# K50A Cloud Push (ADMS) — no office worker

Use this when you **do not** want a mini PC / worker always on.

The fingerprint device must **push** punches to your public website (Vercel) over the internet.

## Important limits

1. **Your K50A firmware must support Cloud / ADMS / iClock.**  
   Many K50A units are **pull-only** (TCP 4370). If there is no Cloud/ADMS/Server menu on the device, this path will not work — use office worker instead.
2. Device needs **internet** (office router with WAN, or 4G dongle) — not only LAN to a PC.
3. On BulkSMSBD, either **disable IP whitelist** or whitelist **Vercel egress IPs** (they change). Easiest: disable source IP checking for API.

## What we implemented

Public endpoints (no login):

| URL | Purpose |
| --- | --- |
| `GET/POST /iclock/cdata` | Options handshake + ATTLOG attendance push |
| `GET /iclock/getrequest` | Device heartbeat / command poll |
| `GET/POST /iclock/registry` | Device registration |
| `GET/POST /iclock/devicecmd` | Command result ack |

When `table=ATTLOG` is posted, punches are saved and **SMS is sent** (same pipeline as sync).

## Setup

### 1. Deploy website to Vercel

Set Neon + SMS env vars. Note your URL, e.g. `https://atfs.vercel.app`.

### 2. Save device Serial Number (SN)

On the K50A menu, find **Serial Number / Device ID**.  
In Admin → Devices → open device → set **Serial Number** to that value  
(or leave empty once: first ADMS request auto-binds SN to the first unbound K50A).

### 3. Configure device Cloud / ADMS

On the terminal (menu names vary by firmware):

1. Network → enable DHCP or set gateway/DNS so device reaches the internet  
2. Cloud / ADMS / Server settings:
   - Server Address: `atfs.vercel.app` (host only, or full URL if menu asks)
   - Server URL / Path: `/iclock` or `https://atfs.vercel.app/iclock`
   - Port: `443` (HTTPS) or `80` (HTTP — not recommended)
   - Enable ADMS / Cloud / Real-time push: **ON**
3. Save and reboot the device

Exact labels differ; look for **ADMS**, **Cloud Server**, **Push**, or **iClock**.

### 4. Test

1. Fingerprint on K50A  
2. Within ~1 minute, Admin → Attendance / SMS log should show the punch  
3. SMS should send if BulkSMSBD allows Vercel’s outbound IP

### 5. Optional: keep LAN sync as backup

Office worker + ADMS can both run. Duplicate punches are ignored (`uniq_raw_punch`).

## If device has no ADMS menu

Cloud push is **not available** on that unit. Then you must use:

- Always-on office worker (mini PC / spare PC), or  
- VPS + VPN  

There is no way for Vercel alone to “see” a LAN-only K50A.
