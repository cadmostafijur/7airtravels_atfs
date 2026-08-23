# Office router setup — Archer C6 and Archer C20

The VPS must reach the K50A at `192.168.0.201:4370` on the office LAN. How the
tunnel gets built depends on what the office router can do, and **the two models
are not equivalent.**

## Which path applies

| Router | OpenVPN Server built in? | Path |
| --- | --- | --- |
| **Archer C6** (A6/C6 V2+) | **Yes** — Advanced → VPN Server → OpenVPN | **Path A** |
| **Archer C20** (all versions) | **No** — the model has no VPN Server menu | **Path B** |
| Anything behind CGNAT | Irrelevant — nothing can dial in | **Path B** |

**Check before you plan anything.** Log into the router and look for
**Advanced → VPN Server**. If the menu is absent, it is Path B. Do not trust
spec sheets — TP-Link's own compatibility lists contradict each other, and the
menu is the only thing that settles it.

> The Archer C20 is an AC750 budget unit. Its user guide has no VPN Server
> chapter in any hardware revision, and TP-Link's community answers confirm it
> cannot act as a VPN server. **The topology as originally drawn — router as
> OpenVPN server — cannot work on a C20.** Path B is how a C20 office runs this
> system.

---

## Path A — Archer C6 as the OpenVPN server

The VPS dials into the router. This is the diagram as drawn.

```
VPS (OpenVPN client)  --->  Archer C6 (OpenVPN server)  --->  LAN  --->  K50A
```

**Requires the office WAN to have a public IP** (static, or dynamic + DDNS).

### On the router

Advanced → **VPN Server → OpenVPN**:

1. **Service Type**: UDP · **Service Port**: 1194
2. **VPN Subnet/Netmask**: `10.8.0.0 / 255.255.255.0` — must not overlap `192.168.0.0/24`
3. **Client Access**: **Home Network and Internet** (this is what makes the
   router advertise the LAN; the VPS config refuses the default route anyway)
4. **Generate** the certificate, tick **Enable VPN Server**, **Save**
5. **Export** the `.ovpn` file

Dynamic WAN IP? Also set Advanced → Network → **Dynamic DNS** and use that
hostname as `remote`.

### On the VPS

```bash
scp Archer_C6.ovpn 7air:/etc/openvpn/client/atfs.conf
```

Then append the additions from [`deploy/openvpn/atfs.conf.example`](../deploy/openvpn/atfs.conf.example):

```
keepalive 10 60
route 192.168.0.0 255.255.255.0
route-nopull
```

```bash
systemctl enable --now openvpn-client@atfs
bash /var/www/atfs/deploy/vpn-check.sh
```

### Path A gotcha — the K50A's gateway

With Path A, replies from the terminal to the `10.8.0.x` VPN client must go back
through the router. **The K50A must have the Archer C6 as its default gateway.**
If the terminal has a static IP configured with no gateway, or a different one,
the tunnel will come up and TCP will still time out.

Check on the terminal: Menu → Comm./Network → confirm Gateway is the router's
LAN IP (typically `192.168.0.1`).

---

## Path B — VPS as the OpenVPN server (works on **both** models)

The office dials out to the VPS. The router is not involved in the VPN at all,
so **this works on a C20, a C6, or any other router**, and it works behind
CGNAT.

```
VPS (OpenVPN server, public IP)  <---  office box (OpenVPN client)  --->  K50A
```

The cost is one small always-on device in the office. It runs **only OpenVPN** —
not Node, not the worker, not the database. A Raspberry Pi, an old thin client,
or any always-on PC is enough.

### 1. On the VPS

```bash
bash /var/www/atfs/deploy/openvpn/vps-server-setup.sh
```

Idempotent — builds the CA, server config, and one client profile, opens UDP
1194, and prints the `.ovpn` path (`/root/office-atfs.ovpn`).

### 2. On the office box

```bash
sudo apt-get install -y openvpn
sudo cp office-atfs.ovpn /etc/openvpn/client/atfs.conf
sudo systemctl enable --now openvpn-client@atfs
```

### 3. Let the office box bridge the tunnel onto the LAN

```bash
echo 'net.ipv4.ip_forward=1' | sudo tee /etc/sysctl.d/99-atfs.conf
sudo sysctl -p /etc/sysctl.d/99-atfs.conf
sudo iptables -t nat -A POSTROUTING -s 10.9.0.0/24 -o eth0 -j MASQUERADE
sudo apt-get install -y iptables-persistent
```

Replace `eth0` with the box's LAN interface (`ip -br addr`).

### Why Path B is the more robust option

The MASQUERADE rule makes traffic arrive at the K50A **from the office box's own
LAN address**, so the terminal replies to a neighbour on its own subnet. It
never needs a correct default gateway, and it never needs to know the VPN
exists. Path A's most common failure — the gateway gotcha above — cannot happen
here.

Path B also survives an ISP switching you to CGNAT, and a router swap.

---

## Choosing

| If | Use |
| --- | --- |
| C6 **and** a public office IP **and** no spare office device | Path A |
| C20 | **Path B** (Path A is impossible) |
| CGNAT, or the WAN IP is unreliable | Path B |
| You want the setup to survive a router replacement | Path B |

Both paths are interchangeable from the application's point of view. The worker,
the device record, nginx, and pm2 are identical either way — the app only ever
sees a route to `192.168.0.201`. Switching paths later does not touch the app.

---

## Verifying either path

```bash
bash /var/www/atfs/deploy/vpn-check.sh
```

It auto-detects whether this VPS runs the client (Path A) or the server
(Path B), then walks every hop and stops at the first broken one. Hop 5 (TCP
4370) is the one that matters — many K50A units ignore ping, so a failed hop 4
is not fatal.

| Symptom | Cause |
| --- | --- |
| `ENETUNREACH` / `EHOSTUNREACH` | tunnel down, or the `192.168.0.0/24` route is missing |
| TCP timeout, tunnel up | **Path A:** the K50A gateway gotcha. **Path B:** missing MASQUERADE or IP forwarding on the office box |
| `ECONNREFUSED` | host answered but nothing on 4370 — wrong port |
| Tunnel drops every few minutes | UDP blocked or MTU — try `proto tcp`, or add `mssfix 1300` |
| Whole VPS loses internet | `route-nopull` missing from the Path A client config |

Sources: [Archer A6 & C6 V2 user guide, ch. 11 VPN Server](https://www.tp-link.com/us/user-guides/Archer-A6&C6_V2/chapter-11-vpn-server) ·
[Archer C20 V5 user guide (no VPN Server chapter)](https://www.tp-link.com/us/user-guides/Archer-C20_V5/) ·
[TP-Link: setting up a VPN connection on your router](https://www.tp-link.com/us/support/faq/2801/)
