import "server-only";

import { timingSafeEqual } from "crypto";

export type SepayWebhookPayload = {
  id: number;
  gateway: string;
  transactionDate: string;
  accountNumber: string;
  code: string | null;
  content: string;
  transferType: "in" | "out";
  transferAmount: number;
  accumulated: number;
  subAccount?: string | null;
  referenceCode: string;
  description?: string;
};

export function generateVietQRUrl(options: {
  accountNumber: string;
  bank: string;
  amount: number;
  content: string;
  template?: "compact" | "qronly";
}): string {
  const params = new URLSearchParams({
    acc: options.accountNumber.trim(),
    bank: options.bank.trim(),
    amount: String(Math.floor(options.amount)),
    des: options.content.trim(),
  });
  if (options.template) params.set("template", options.template);
  return `https://vietqr.app/img?${params.toString()}`;
}

export function parseOrderIdFromContent(content: string): string | null {
  const match = content.match(/DH\s*(\d{1,10})/i);
  return match ? `DH${match[1].padStart(6, "0")}` : null;
}

export function parsePhoneFromContent(content: string): string | null {
  const match = content.match(/(?:0|\+84)\d{9}/);
  if (!match) return null;
  return match[0].startsWith("+84") ? `0${match[0].slice(3)}` : match[0];
}

export function verifySepayAuth(authHeader: string | null, expectedKey: string): boolean {
  if (!authHeader || !expectedKey) return false;

  const match = authHeader.match(/^(?:Apikey|Bearer)\s+(.+)$/i);
  if (!match) return false;

  const expected = Buffer.from(expectedKey.trim());
  const provided = Buffer.from(match[1]);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}
