import type { Device } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ingestAttendanceLog } from "@/lib/attendance/sync";
import { logger } from "@/lib/logger";
import { APP_TZ } from "@/lib/time";
import type { DeviceAttendanceLog } from "@/lib/devices/types";

/**
 * ZKTeco ADMS / iClock push protocol helpers.
 * Device must support Cloud / ADMS and have internet to reach the public URL.
 * Not all K50A firmware builds include ADMS — check device menu for Cloud/ADMS/Server.
 */

export function admsPlain(text: string, status = 200) {
  return new Response(text, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export function buildOptionsReply(sn: string) {
  // Realtime=1 asks device to push punches quickly
  return [
    `GET OPTION FROM: ${sn}`,
    "ATTLOGStamp=0",
    "OPERLOGStamp=0",
    "BIODATAStamp=0",
    "ATTPHOTOStamp=0",
    "ErrorDelay=30",
    "Delay=10",
    "TransTimes=00:00;14:00",
    "TransInterval=1",
    "TransFlag=111100000000",
    "Realtime=1",
    "Encrypt=0",
    "ServerVer=3.0.1",
    "PushProtVer=2.4.1",
    "SupportPing=1",
  ].join("\n");
}

/** Parse device local wall time as Asia/Dhaka (no DST). */
export function parseAdmsTimestamp(raw: string, timeZone = APP_TZ): Date | null {
  const cleaned = raw.trim().replace("T", " ");
  const match = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})[ ](\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, ys, mos, ds, hs, mis, ss] = match;
  const y = Number(ys);
  const mo = Number(mos);
  const d = Number(ds);
  const h = Number(hs);
  const mi = Number(mis);
  const s = Number(ss);
  // Asia/Dhaka is UTC+6 year-round
  if (timeZone === "Asia/Dhaka" || timeZone.includes("Dhaka")) {
    return new Date(Date.UTC(y, mo - 1, d, h - 6, mi, s));
  }
  // Fallback: treat as UTC
  return new Date(Date.UTC(y, mo - 1, d, h, mi, s));
}

export type ParsedAttLog = {
  deviceUserId: string;
  timestamp: Date;
  statusCode: number;
  verifyCode: number;
  rawLine: string;
};

/** ATTLOG body: lines like `1\t2026-08-22 16:49:43\t0\t1\t0\t0\t0` */
export function parseAttLogBody(body: string): ParsedAttLog[] {
  const rows: ParsedAttLog[] = [];
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/\t/);
    if (parts.length < 2) {
      // some firmwares use spaces
      const spaced = trimmed.split(/\s+/);
      if (spaced.length < 3) continue;
      const pin = spaced[0]!;
      const ts = parseAdmsTimestamp(`${spaced[1]} ${spaced[2]}`);
      if (!ts) continue;
      rows.push({
        deviceUserId: pin,
        timestamp: ts,
        statusCode: Number(spaced[3] ?? 0) || 0,
        verifyCode: Number(spaced[4] ?? 1) || 1,
        rawLine: trimmed,
      });
      continue;
    }
    const pin = parts[0]!.trim();
    const ts = parseAdmsTimestamp(parts[1] ?? "");
    if (!pin || !ts) continue;
    rows.push({
      deviceUserId: pin,
      timestamp: ts,
      statusCode: Number(parts[2] ?? 0) || 0,
      verifyCode: Number(parts[3] ?? 1) || 1,
      rawLine: trimmed,
    });
  }
  return rows;
}

export async function resolveDeviceBySerial(sn: string): Promise<Device | null> {
  const serial = sn.trim();
  if (!serial) return null;

  const bySerial = await prisma.device.findFirst({
    where: { serialNumber: serial },
  });
  if (bySerial) return bySerial;

  // First-time bind: attach SN to the only K50A (or first device) if serial empty
  const unbound = await prisma.device.findFirst({
    where: {
      OR: [{ serialNumber: null }, { serialNumber: "" }],
      adapterType: "k50a",
    },
    orderBy: { createdAt: "asc" },
  });
  if (unbound) {
    return prisma.device.update({
      where: { id: unbound.id },
      data: { serialNumber: serial, lastConnectedAt: new Date(), status: "ONLINE", lastError: null },
    });
  }

  const anyUnbound = await prisma.device.findFirst({
    where: { OR: [{ serialNumber: null }, { serialNumber: "" }] },
    orderBy: { createdAt: "asc" },
  });
  if (anyUnbound) {
    return prisma.device.update({
      where: { id: anyUnbound.id },
      data: { serialNumber: serial, lastConnectedAt: new Date(), status: "ONLINE", lastError: null },
    });
  }

  return null;
}

export async function ingestAdmsAttLogs(sn: string, body: string) {
  const device = await resolveDeviceBySerial(sn);
  if (!device) {
    logger.warn("adms_unknown_serial", { sn });
    return { ok: false as const, reason: "unknown_serial", inserted: 0, skipped: 0 };
  }

  const rows = parseAttLogBody(body);
  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const log: DeviceAttendanceLog = {
      deviceUserId: row.deviceUserId,
      timestamp: row.timestamp,
      verificationMethod: "FINGERPRINT",
      attendanceType: "UNKNOWN",
      deviceTransactionId: null,
      raw: {
        source: "ADMS",
        sn,
        statusCode: row.statusCode,
        verifyCode: row.verifyCode,
        line: row.rawLine,
      },
    };
    const result = await ingestAttendanceLog({ device, log, source: "DEVICE" });
    if (result.inserted) inserted += 1;
    else if (result.skipped) skipped += 1;
  }

  await prisma.device.update({
    where: { id: device.id },
    data: {
      lastConnectedAt: new Date(),
      lastSyncAt: new Date(),
      status: "ONLINE",
      lastError: null,
      totalSynced: { increment: inserted },
    },
  });

  logger.info("adms_attlog_ingested", { sn, deviceId: device.id, rows: rows.length, inserted, skipped });
  return { ok: true as const, inserted, skipped, rows: rows.length };
}
