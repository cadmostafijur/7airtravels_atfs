import "server-only";

import net from "node:net";
import type { TcpProbeResult } from "@/lib/devices/types";

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
      });
    });
    socket.once("timeout", () => {
      finish({
        ok: false,
        ipAddress,
        port,
        latencyMs: Date.now() - started,
        error: `TCP timeout after ${timeoutMs}ms`,
      });
    });
    socket.once("error", (error) => {
      finish({
        ok: false,
        ipAddress,
        port,
        latencyMs: Date.now() - started,
        error: error.message,
      });
    });
    socket.connect(port, ipAddress);
  });
}
