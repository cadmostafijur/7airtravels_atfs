#!/usr/bin/env bash
# Restart the OpenVPN client when the K50A stops answering across the tunnel.
#
# OpenVPN can hold a session that looks "connected" while the far side has gone
# away (router reboot, ISP re-IP). The device TCP port is the honest signal, so
# probe that and bounce the tunnel if it fails twice in a row.
set -uo pipefail

DEV_IP="${K50A_IP:-192.168.0.201}"
DEV_PORT="${K50A_PORT:-4370}"
UNIT="${VPN_UNIT:-openvpn-client@atfs}"

probe() { timeout 8 bash -c "exec 3<>/dev/tcp/${DEV_IP}/${DEV_PORT}" 2>/dev/null; }

if probe; then
  exit 0
fi

sleep 15
if probe; then
  exit 0
fi

logger -t atfs-watchdog "K50A ${DEV_IP}:${DEV_PORT} unreachable twice; restarting ${UNIT}"
systemctl restart "$UNIT"
