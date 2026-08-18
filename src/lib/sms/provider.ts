import "server-only";

import { env } from "@/lib/env";
import type { SmsProvider, SmsSendResult } from "@/lib/sms/types";

export class ConsoleSmsProvider implements SmsProvider {
  readonly name = "console";
  async sendSms(phone: string, message: string): Promise<SmsSendResult> {
    console.log(JSON.stringify({ sms: true, phone, message }));
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
 * Generic Bangladesh SMS HTTP gateway.
 * Configure SMS_API_URL, SMS_API_KEY, SMS_SENDER_ID and optional body template.
 * Works with common local gateways (query-string or JSON POST) without hardcoding one vendor.
 */
export class BangladeshHttpSmsProvider implements SmsProvider {
  readonly name = "http";

  async sendSms(phone: string, message: string): Promise<SmsSendResult> {
    if (!env.sms.apiUrl || !env.sms.apiKey) {
      return { success: false, provider: this.name, response: "SMS_API_URL or SMS_API_KEY is not configured" };
    }

    const url = new URL(env.sms.apiUrl);
    const params: Record<string, string> = {
      [env.sms.phoneParam]: phone,
      [env.sms.messageParam]: message,
      sender: env.sms.senderId,
      senderid: env.sms.senderId,
      api_key: env.sms.apiKey,
      apikey: env.sms.apiKey,
    };

    try {
      let response: Response;
      if (env.sms.method === "GET") {
        for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
        response = await fetch(url, { method: "GET" });
      } else {
        const body = env.sms.bodyTemplate
          ? env.sms.bodyTemplate
              .replaceAll("{{phone}}", phone)
              .replaceAll("{{message}}", message)
              .replaceAll("{{sender}}", env.sms.senderId)
              .replaceAll("{{apiKey}}", env.sms.apiKey)
          : JSON.stringify(params);
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": env.sms.bodyTemplate ? "application/json" : "application/json",
            Authorization: `Bearer ${env.sms.apiKey}`,
          },
          body,
        });
      }
      const text = await response.text();
      return {
        success: response.ok,
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
    case "http":
      return new BangladeshHttpSmsProvider();
    default:
      return new ConsoleSmsProvider();
  }
}
