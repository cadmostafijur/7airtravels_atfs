#!/usr/bin/env bash
# ATFS tunnel check — run on the VPS.
#
#   INTERNET -> VPS worker -> OpenVPN -> Archer C6 -> office LAN -> K50A
#
# Walks the path hop by hop and stops at the first broken one, so you know which
# box to fix instead of guessing.
set -uo pipefail

DEV_IP="${K50A_IP:-192.168.0.201}"
DEV_PORT="${K50A_PORT:-4370}"
VPN_IF="${VPN_IF:-tun0}"
# Path A puts an OpenVPN *client* on this VPS (router is the server); Path B
# puts a *server* here and the office box dials in. Detect which one exists so
# the same script works for both router models.
detect_unit() {
  if [[ -n "${VPN_UNIT:-}" ]]; then echo "$VPN_UNIT"; return; fi
  if [[ -f /etc/openvpn/client/atfs.conf ]]; then echo "openvpn-client@atfs"; return; fi
  if [[ -f /etc/openvpn/server/atfs.conf ]]; then echo "openvpn-server@atfs"; return; fi
  echo "openvpn-client@atfs"
}
UNIT="$(detect_unit)"

ok()   { printf '  \033[32mOK\033[0m   %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m %s\n' "$1"; }
info() { printf '  ..   %s\n' "$1"; }

echo "ATFS tunnel check -> ${DEV_IP}:${DEV_PORT}"

echo "1. OpenVPN service"
if systemctl is-active --quiet "$UNIT"; then
  ok "$UNIT is active"
else
  fail "$UNIT is not running. Start it: systemctl start $UNIT"
  echo "     journalctl -u $UNIT -n 50 --no-pager"
  exit 1
fi

echo "2. Tunnel interface"
if ip link show "$VPN_IF" >/dev/null 2>&1; then
  ok "$VPN_IF is up ($(ip -4 -o addr show "$VPN_IF" | awk '{print $4}' | paste -sd, -))"
else
  fail "$VPN_IF does not exist. The tunnel did not come up — check the router's VPN server and the client config."
  exit 1
fi

echo "3. Route to the office LAN"
ROUTE=$(ip route get "$DEV_IP" 2>/dev/null | head -1)
if [[ "$ROUTE" == *"$VPN_IF"* ]]; then
  ok "route via $VPN_IF: $ROUTE"
else
  fail "traffic for $DEV_IP is NOT using $VPN_IF: ${ROUTE:-no route}"
  echo "     The router must push a route for the office subnet, or add one:"
  echo "     ip route add 192.168.0.0/24 dev $VPN_IF"
  exit 1
fi

echo "4. ICMP to the terminal (optional — many K50A units ignore ping)"
if ping -c 2 -W 3 "$DEV_IP" >/dev/null 2>&1; then
  ok "$DEV_IP answers ping"
else
  info "$DEV_IP does not answer ping. Not fatal; the TCP check below is what counts."
fi

echo "5. TCP $DEV_PORT (the check that matters)"
if timeout 8 bash -c "exec 3<>/dev/tcp/${DEV_IP}/${DEV_PORT}" 2>/dev/null; then
  ok "TCP ${DEV_IP}:${DEV_PORT} is open — the worker can reach the K50A"
else
  fail "cannot open TCP ${DEV_IP}:${DEV_PORT}"
  echo "     Tunnel is up but the terminal did not answer. Check that the K50A is"
  echo "     powered on, still holds ${DEV_IP}, and uses the Archer C6 as its gateway."
  exit 1
fi

echo "6. ATFS worker"
WORKER_PORT="${WORKER_PORT:-3011}"
if curl -fsS --max-time 10 "http://127.0.0.1:${WORKER_PORT}/health" >/dev/null 2>&1; then
  ok "worker healthy on :${WORKER_PORT}"
  curl -fsS --max-time 15 "http://127.0.0.1:${WORKER_PORT}/health/devices" | head -c 2000; echo
else
  fail "worker not responding on :${WORKER_PORT} (pm2 status atfs-worker)"
  exit 1
fi

echo "All hops OK."
