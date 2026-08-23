#!/usr/bin/env bash
# Path B — OpenVPN *server* on the VPS, office box dials OUT to it.
#
# Use this when the office router cannot be an OpenVPN server (Archer C20 and
# other budget models have no VPN Server menu at all), or when the office WAN
# is behind CGNAT so nothing can dial in.
#
#   VPS (public IP, runs OpenVPN server)  <---  office box (OpenVPN client)
#                                                     |
#                                              office LAN -> K50A
#
# Idempotent: safe to re-run. Creates the CA, the server config, and one client
# profile, then prints the .ovpn to copy to the office box.
set -euo pipefail

VPN_PORT="${VPN_PORT:-1194}"
VPN_SUBNET="${VPN_SUBNET:-10.9.0.0}"
VPN_MASK="${VPN_MASK:-255.255.255.0}"
OFFICE_LAN="${OFFICE_LAN:-192.168.0.0}"
OFFICE_MASK="${OFFICE_MASK:-255.255.255.0}"
CLIENT_NAME="${CLIENT_NAME:-office}"
PUBLIC_HOST="${PUBLIC_HOST:-$(curl -fsS --max-time 10 ifconfig.me)}"

EASYRSA_DIR=/etc/openvpn/easy-rsa
SERVER_DIR=/etc/openvpn/server
CCD_DIR=/etc/openvpn/ccd

echo "==> Installing packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y openvpn easy-rsa >/dev/null

echo "==> Building the CA and certificates (only on first run)"
if [[ ! -d "$EASYRSA_DIR/pki" ]]; then
  mkdir -p "$EASYRSA_DIR"
  cp -r /usr/share/easy-rsa/* "$EASYRSA_DIR/"
  cd "$EASYRSA_DIR"
  export EASYRSA_BATCH=1 EASYRSA_REQ_CN="ATFS-VPN-CA"
  ./easyrsa init-pki
  ./easyrsa build-ca nopass
  ./easyrsa build-server-full server nopass
  ./easyrsa build-client-full "$CLIENT_NAME" nopass
  ./easyrsa gen-dh
  openvpn --genkey secret "$EASYRSA_DIR/pki/ta.key"
else
  echo "    PKI already exists, reusing it"
  cd "$EASYRSA_DIR"
  # Add the client only if it is new, so re-running can mint extra profiles.
  if [[ ! -f "pki/issued/${CLIENT_NAME}.crt" ]]; then
    EASYRSA_BATCH=1 ./easyrsa build-client-full "$CLIENT_NAME" nopass
  fi
fi

echo "==> Writing the server config"
mkdir -p "$SERVER_DIR" "$CCD_DIR"
cat > "$SERVER_DIR/atfs.conf" <<CONF
port ${VPN_PORT}
proto udp
dev tun

ca ${EASYRSA_DIR}/pki/ca.crt
cert ${EASYRSA_DIR}/pki/issued/server.crt
key ${EASYRSA_DIR}/pki/private/server.key
dh ${EASYRSA_DIR}/pki/dh.pem
tls-crypt ${EASYRSA_DIR}/pki/ta.key

server ${VPN_SUBNET} ${VPN_MASK}
topology subnet
ifconfig-pool-persist /var/log/openvpn/ipp.txt

# Teach this VPS that the office LAN lives behind the tunnel. The matching
# iroute in the ccd file below tells OpenVPN which client owns that subnet.
route ${OFFICE_LAN} ${OFFICE_MASK}
client-config-dir ${CCD_DIR}

# Only the office LAN goes over the VPN. Never push a default route -- the VPS
# must keep serving the public website over its own uplink.
keepalive 10 60
persist-key
persist-tun
verb 3
status /var/log/openvpn/atfs-status.log
CONF

# iroute is what makes OpenVPN route the office subnet to this specific client.
echo "iroute ${OFFICE_LAN} ${OFFICE_MASK}" > "${CCD_DIR}/${CLIENT_NAME}"

mkdir -p /var/log/openvpn

echo "==> Enabling IP forwarding"
echo 'net.ipv4.ip_forward=1' > /etc/sysctl.d/99-atfs-vpn.conf
sysctl -q -p /etc/sysctl.d/99-atfs-vpn.conf

echo "==> Opening UDP ${VPN_PORT}"
ufw allow "${VPN_PORT}/udp" comment "ATFS OpenVPN" >/dev/null || true

echo "==> Starting the service"
systemctl enable --now "openvpn-server@atfs"
sleep 2
systemctl is-active --quiet "openvpn-server@atfs" \
  && echo "    openvpn-server@atfs is running" \
  || { echo "    FAILED -- journalctl -u openvpn-server@atfs -n 40 --no-pager"; exit 1; }

echo "==> Writing the client profile"
OUT="/root/${CLIENT_NAME}-atfs.ovpn"
cat > "$OUT" <<CONF
client
dev tun
proto udp
remote ${PUBLIC_HOST} ${VPN_PORT}
resolv-retry infinite
nobind
persist-key
persist-tun
remote-cert-tls server
keepalive 10 60

# Only reach the VPS over this tunnel; the office keeps its own internet.
route-nopull
route ${VPN_SUBNET} ${VPN_MASK}

verb 3
CONF
{
  echo "<ca>";        cat "${EASYRSA_DIR}/pki/ca.crt";                        echo "</ca>"
  echo "<cert>";      cat "${EASYRSA_DIR}/pki/issued/${CLIENT_NAME}.crt";     echo "</cert>"
  echo "<key>";       cat "${EASYRSA_DIR}/pki/private/${CLIENT_NAME}.key";    echo "</key>"
  echo "<tls-crypt>"; cat "${EASYRSA_DIR}/pki/ta.key";                        echo "</tls-crypt>"
} >> "$OUT"
chmod 600 "$OUT"

cat <<DONE

Done. Client profile: ${OUT}

Copy it to the always-on office box and finish there:

  scp root@${PUBLIC_HOST}:${OUT} .
  sudo cp ${CLIENT_NAME}-atfs.ovpn /etc/openvpn/client/atfs.conf
  sudo systemctl enable --now openvpn-client@atfs

Then, ON THE OFFICE BOX, let it forward and masquerade tunnel traffic onto the
LAN. This is what lets the VPS reach the K50A without touching the terminal's
gateway settings:

  echo 'net.ipv4.ip_forward=1' | sudo tee /etc/sysctl.d/99-atfs.conf
  sudo sysctl -p /etc/sysctl.d/99-atfs.conf
  sudo iptables -t nat -A POSTROUTING -s ${VPN_SUBNET}/24 -o <lan-iface> -j MASQUERADE
  sudo apt-get install -y iptables-persistent   # to survive reboot

Verify from the VPS:

  ping -c2 10.9.0.2                       # the office box across the tunnel
  bash /var/www/atfs/deploy/vpn-check.sh  # full path to the K50A
DONE
