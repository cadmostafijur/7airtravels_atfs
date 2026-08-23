#!/usr/bin/env npx tsx
/**
 * Standalone K50A connectivity probe.
 * Does not claim success unless TCP and (optionally) ZK protocol handshake both work.
 *
 *   npx tsx scripts/device-probe.ts --ip 192.168.1.201 --port 4370
 */
import { probeTcp } from "../src/lib/devices/tcp-probe";
import { K50AAdapter } from "../src/lib/devices/k50a-adapter";

function arg(name: string, fallback?: string) {
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) return process.argv[index + 1];
  return fallback;
}

async function main() {
  const ip = arg("ip", process.env.K50A_IP ?? "192.168.0.201")!;
  const port = Number(arg("port", process.env.K50A_PORT ?? "4370"));
  console.log(`TCP probe ${ip}:${port}`);
  const tcp = await probeTcp(ip, port, 8000);
  console.log(tcp);
  if (!tcp.ok) {
    // Across the VPN, the hint names which hop is broken.
    if (tcp.hint) console.error(`
What to check: ${tcp.hint}`);
    process.exitCode = 2;
    return;
  }
  const adapter = new K50AAdapter({ ipAddress: ip, port, timeoutMs: 8000 });
  try {
    await adapter.connect();
    const info = await adapter.getDeviceInfo();
    console.log("protocol handshake ok", info);
    const users = await adapter.getUsers();
    console.log(`users: ${users.length}`);
    const logs = await adapter.getAttendanceLogs();
    console.log(`transactions: ${logs.length}`);
    console.log("latest", logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0] ?? null);
  } catch (error) {
    console.error("ZK protocol failed (adapter is replaceable):", error instanceof Error ? error.message : error);
    process.exitCode = 3;
  } finally {
    await adapter.disconnect();
  }
}

void main();
