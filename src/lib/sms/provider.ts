import "server-only";

import { env } from "@/lib/env";
import { normalizeBdPhone } from "@/lib/sms/phone";
import type { SmsProvider, SmsSendResult } from "@/lib/sms/types";

export class ConsoleSmsProvider implements SmsProvider {
  readonly name = "console";
  async sendSms(phone: string, message: string): Promise<SmsSendResult> {
    console.log(JSON.stringify({ sms: true, phone: normalizeBdPhone(phone), message }));
    return { success: true, provider: this.name, response: "logged-to-console" };
  }
}

export class FailingSmsProvider implements SmsProvider {
  readonly name = "failing";
  async sendSms(): Promise<SmsSendResult> {
    return { success: false, provider: this.name, response: "Simulated SMS provider failure" };
  }
}

/**
 * BulkSMSBD (bulksmsbd.net) — form POST (preferred) or GET.
 * Success response_code: 202
 * Docs: api_key, type=text, number, senderid, message
 */
export class BulkSmsBdProvider implements SmsProvider {
  readonly name = "bulksmsbd";

  async sendSms(phone: string, message: string): Promise<SmsSendResult> {
    if (!env.sms.apiUrl || !env.sms.apiKey) {
      return { success: false, provider: this.name, response: "SMS_API_URL or SMS_API_KEY is not configured" };
    }

    const number = normalizeBdPhone(phone);
    // Single-line body is more reliable on BD gateways than raw newlines in query strings
    const text = flattenSmsBody(message);
    const fields: Record<string, string> = {
      api_key: env.sms.apiKey,
      type: env.sms.type || "text",
      number,
      senderid: env.sms.senderId,
      message: text,
    };

    try {
      const useGet = env.sms.method === "GET";
      let response: Response;
      if (useGet) {
        const url = new URL(env.sms.apiUrl);
        for (const [key, value] of Object.entries(fields)) url.searchParams.set(key, value);
        response = await fetch(url.toString(), { method: "GET", cache: "no-store" });
      } else {
        response = await fetch(env.sms.apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(fields),
          cache: "no-store",
        });
      }
      const raw = await response.text();
      const code = parseBulkSmsBdCode(raw);
      const success = code === 202;
      return {
        success,
        provider: this.name,
        response: enrichBulkSmsResponse(raw, code),
      };
    } catch (error) {
      return {
        success: false,
        provider: this.name,
        response: error instanceof Error ? error.message : "SMS request failed",
      };
    }
  }
}

/** Prefer one line so GET/POST gateways do not drop or break the body. */
export function flattenSmsBody(message: string): string {
  return message
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" | ");
}

function enrichBulkSmsResponse(text: string, code: number | null): string {
  if (code === 1032) {
    const ip = text.match(/ip\s+([0-9.]+)/i)?.[1];
    const hint = ip
      ? `IP ${ip} not whitelisted on BulkSMSBD Phone Book. Add this IP (API type) then Retry failed / Test SMS.`
      : "IP not whitelisted on BulkSMSBD Phone Book. Add your PC public IP then Retry failed / Test SMS.";
    return `${text}\n---\n${hint}`.slice(0, 2000);
  }
  return text.slice(0, 2000);
}

function parseBulkSmsBdCode(text: string): number | null {
  try {
    const json = JSON.parse(text) as { response_code?: number | string; code?: number | string };
    const raw = json.response_code ?? json.code;
    if (raw !== undefined) return Number(raw);
  } catch {
    // plain text / HTML
  }
  const match = text.match(/\b(202|10\d{2})\b/);
  return match ? Number(match[1]) : null;
}

/**
 * Generic Bangladesh SMS HTTP gateway (JSON POST or query GET).
 */
export class BangladeshHttpSmsProvider implements SmsProvider {
  readonly name = "http";

  async sendSms(phone: string, message: string): Promise<SmsSendResult> {
    if (!env.sms.apiUrl || !env.sms.apiKey) {
      return { success: false, provider: this.name, response: "SMS_API_URL or SMS_API_KEY is not configured" };
    }

    const number = normalizeBdPhone(phone);
    const text = flattenSmsBody(message);
    const url = new URL(env.sms.apiUrl);
    const params: Record<string, string> = {
      [env.sms.phoneParam]: number,
      [env.sms.messageParam]: text,
      sender: env.sms.senderId,
      senderid: env.sms.senderId,
      api_key: env.sms.apiKey,
      apikey: env.sms.apiKey,
      type: env.sms.type || "text",
    };

    try {
      let response: Response;
      if (env.sms.method === "GET") {
        for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
        response = await fetch(url, { method: "GET", cache: "no-store" });
      } else {
        const body = env.sms.bodyTemplate
          ? env.sms.bodyTemplate
              .replaceAll("{{phone}}", number)
              .replaceAll("{{message}}", text)
              .replaceAll("{{sender}}", env.sms.senderId)
              .replaceAll("{{apiKey}}", env.sms.apiKey)
          : JSON.stringify(params);
        response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          cache: "no-store",
        });
      }
      const raw = await response.text();
      const code = parseBulkSmsBdCode(raw);
      const success = code === 202 || (code === null && response.ok);
      return {
        success,
        provider: this.name,
        response: enrichBulkSmsResponse(raw, code).slice(0, 2000),
      };
    } catch (error) {
      return {
        success: false,
        provider: this.name,
        response: error instanceof Error ? error.message : "SMS request failed",
      };
    }
  }
}

export function createSmsProvider(): SmsProvider {
  switch (env.sms.provider) {
    case "failing":
      return new FailingSmsProvider();
    case "bulksmsbd":
      return new BulkSmsBdProvider();
    case "http":
      return new BangladeshHttpSmsProvider();
    default:
      return new ConsoleSmsProvider();
  }
}

/** Best-effort: public IP BulkSMSBD will see from this machine/process. */
export async function detectOutboundPublicIp(): Promise<string | null> {
  try {
    const response = await fetch("https://api.ipify.org?format=json", { cache: "no-store" });
    if (!response.ok) return null;
    const data = (await response.json()) as { ip?: string };
    return data.ip?.trim() || null;
  } catch {
    return null;
  }
}
