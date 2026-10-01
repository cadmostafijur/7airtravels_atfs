import "server-only";

import net from "node:net";
import type { TcpProbeDiagnosis, TcpProbeResult } from "@/lib/devices/types";

type DiagnosedFailure = { diagnosis: TcpProbeDiagnosis; hint: string };

/**
 * The K50A is reached over an OpenVPN tunnel (VPS -> Archer C6 -> office LAN).
 * Every hop fails as "cannot connect", so map the socket error code to the hop
 * that is actually broken instead of logging one generic timeout.
 */
export function diagnoseSocketError(code: string | undefined, message: string): DiagnosedFailure {
  switch (code) {
    case "ENETUNREACH":
    case "EHOSTUNREACH":
      return {
        diagnosis: "tunnel_down",
        hint: "No route to the office LAN. The VPN tunnel is down or the route to the device subnet is missing — check `systemctl status openvpn-client@atfs` and `ip route` on the VPS.",
      };
    case "ECONNREFUSED":
      return {
        diagnosis: "port_closed",
        hint: "The tunnel works and the host answered, but nothing is listening on that port. Confirm the K50A port (usually 4370) and that the terminal is powered on.",
      };
    case "ETIMEDOUT":
      return {
        diagnosis: "no_reply",
        hint: "The route to the office LAN exists, but the K50A did not answer. Power-cycle the terminal, confirm its IP is still the one saved on the device page, and check the router VPN is forwarding that LAN address.",
      };
    case "ENOTFOUND":
    case "EAI_AGAIN":
      return {
        diagnosis: "bad_address",
        hint: "The device address could not be resolved. Use the K50A's LAN IP (for example 192.168.0.201), not a hostname.",
      };
    default:
      return { diagnosis: "unknown", hint: message };
  }
}

export function probeTcp(ipAddress: string, port: number, timeoutMs = 4000): Promise<TcpProbeResult> {
  const started = Date.now();
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (result: TcpProbeResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      finish({
        ok: true,
        ipAddress,
        port,
        latencyMs: Date.now() - started,
        diagnosis: "ok",
      });
    });
    socket.once("timeout", () => {
      finish({
        ok: false,
        ipAddress,
        port,
        latencyMs: Date.now() - started,
        error: `TCP timeout after ${timeoutMs}ms`,
        diagnosis: "no_reply",
        hint: "The terminal did not answer. It allows only one connection, so a sync already in progress looks like a timeout. Wait for that sync to finish, and confirm the terminal is powered on at this IP.",
      });
    });
    socket.once("error", (error) => {
      const code = (error as NodeJS.ErrnoException).code;
      const { diagnosis, hint } = diagnoseSocketError(code, error.message);
      finish({
        ok: false,
        ipAddress,
        port,
        latencyMs: Date.now() - started,
        error: code ? `${code}: ${error.message}` : error.message,
        diagnosis,
        hint,
      });
    });
    socket.connect(port, ipAddress);
  });
}
