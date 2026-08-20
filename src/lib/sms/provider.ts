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
 * BulkSMSBD (bulksmsbd.net) — GET/POST query params.
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
    const url = new URL(env.sms.apiUrl);
    url.searchParams.set("api_key", env.sms.apiKey);
    url.searchParams.set("type", env.sms.type || "text");
    url.searchParams.set("number", number);
    url.searchParams.set("senderid", env.sms.senderId);
    url.searchParams.set("message", message);

    try {
      const response = await fetch(url.toString(), {
        method: env.sms.method === "GET" ? "GET" : "POST",
      });
      const text = await response.text();
      const code = parseBulkSmsBdCode(text);
      const success = code === 202;
      return {
        success,
        provider: this.name,
        response: text.slice(0, 2000),
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
    const url = new URL(env.sms.apiUrl);
    const params: Record<string, string> = {
      [env.sms.phoneParam]: number,
      [env.sms.messageParam]: message,
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
        response = await fetch(url, { method: "GET" });
      } else {
        const body = env.sms.bodyTemplate
          ? env.sms.bodyTemplate
              .replaceAll("{{phone}}", number)
              .replaceAll("{{message}}", message)
              .replaceAll("{{sender}}", env.sms.senderId)
              .replaceAll("{{apiKey}}", env.sms.apiKey)
          : JSON.stringify(params);
        response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
      }
      const text = await response.text();
      const code = parseBulkSmsBdCode(text);
      const success = code === 202 || (code === null && response.ok);
      return {
        success,
        provider: this.name,
        response: text.slice(0, 2000),
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
