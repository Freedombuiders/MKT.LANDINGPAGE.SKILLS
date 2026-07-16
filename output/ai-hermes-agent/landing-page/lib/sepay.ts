// lib/sepay.ts
//
// Pure helpers cho Sepay integration — không dependency Vercel KV hay framework.
// Reusable cho cả /api/checkout, /api/sepay-webhook, server components.
//
// Includes:
//   - generateVietQRUrl(): build QR URL theo VietQR standard
//   - parseOrderIdFromContent(): parse "DH000123" từ content khách dán
//                                handle bank dash-stripping + uppercase + extra prefix
//   - verifySepayAuth(): timing-safe comparison cho Apikey auth
//   - formatVND(): Vietnamese locale currency format

import { timingSafeEqual } from 'crypto';

// =============================================================================
// QR generation
// =============================================================================

export function generateVietQRUrl(opts: {
  accountNumber: string;
  bank: string;
  amount: number;
  content: string;
  template?: 'compact' | 'qronly' | '';
}): string {
  const params = new URLSearchParams({
    acc: opts.accountNumber,
    bank: opts.bank,
    amount: String(Math.floor(opts.amount)), // Sepay expect integer
    des: opts.content,
  });
  if (opts.template) params.set('template', opts.template);
  return `https://qr.sepay.vn/img?${params.toString()}`;
}

// =============================================================================
// Order ID parsing — handle real-world Vietnamese bank memo transformations
// =============================================================================

/**
 * Parse order ID dạng "DH<digits>" từ content. Handle:
 *   - "DH000123"                              ✓ standard
 *   - "DH 000123"                             ✓ space
 *   - "dh000123"                              ✓ lowercase (banks uppercase/lowercase)
 *   - "BankAPINotify DH000123-CHUYEN TIEN"   ✓ extra prefix + suffix
 *   - "DH000123 CHUYEN KHOAN"                ✓ với note thêm
 *   - "DH000123 0901234567"                  ✓ kèm phone (skill convention)
 *
 * Return: normalized order ID "DH000123" (always uppercase, no space) hoặc null.
 */
export function parseOrderIdFromContent(content: string): string | null {
  if (!content) return null;

  // Match DH + optional space + digits (case-insensitive)
  const match = content.match(/DH\s*(\d{1,10})/i);
  if (!match) return null;

  const digits = match[1].padStart(6, '0'); // normalize 6-digit format
  return `DH${digits}`;
}

/**
 * Fallback: parse phone VN từ content. Match "0\d{9}" (10-digit VN format).
 */
export function parsePhoneFromContent(content: string): string | null {
  if (!content) return null;
  const match = content.match(/0\d{9}/);
  return match ? match[0] : null;
}

// =============================================================================
// Webhook auth — timing-safe comparison
// =============================================================================

/**
 * Verify Sepay webhook auth header. Support cả "Apikey" và "Bearer" format.
 * Use timing-safe comparison để chống timing attacks.
 *
 * Sepay docs say "Authorization: Apikey YOUR_KEY" — nhưng có user vô tình config
 * "Bearer" trong dashboard, support cả 2 cho compat.
 */
export function verifySepayAuth(authHeader: string | null, expectedKey: string): boolean {
  if (!authHeader || !expectedKey) return false;

  let providedKey: string;
  if (authHeader.startsWith('Apikey ')) {
    providedKey = authHeader.slice(7);
  } else if (authHeader.startsWith('Bearer ')) {
    providedKey = authHeader.slice(7);
  } else {
    return false;
  }

  try {
    const expected = Buffer.from(expectedKey);
    const provided = Buffer.from(providedKey);
    if (expected.length !== provided.length) return false;
    return timingSafeEqual(expected, provided);
  } catch {
    return false;
  }
}

// =============================================================================
// Format helpers
// =============================================================================

/**
 * Format VND theo Vietnamese locale: 499000 → "499.000 ₫"
 * Hoặc compact "499K" / "1.99M" cho UI gọn.
 */
export function formatVND(amount: number, opts?: { compact?: boolean }): string {
  if (opts?.compact) {
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`;
    if (amount >= 1_000) return `${Math.floor(amount / 1_000)}K`;
    return String(amount);
  }
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
}

/**
 * Format VN phone: "0901234567" → "0901 234 567"
 */
export function formatPhoneVN(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) {
    return digits.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3');
  }
  return phone;
}

// =============================================================================
// Payload typing
// =============================================================================

export type SepayWebhookPayload = {
  id: number;                       // Transaction ID — INTEGER, not string. Use for dedup.
  gateway: string;                  // Bank name e.g. "Vietcombank"
  transactionDate: string;          // "YYYY-MM-DD HH:mm:ss" từ bank
  accountNumber: string;            // Số TK shop
  code: string | null;              // Sepay auto-detected payment code
  content: string;                  // Nội dung CK khách dán — chứa order ID
  transferType: 'in' | 'out';       // Filter chỉ xử lý 'in'
  transferAmount: number;           // VND raw integer
  accumulated: number;              // Số dư TK sau giao dịch
  subAccount: string | null;
  referenceCode: string;            // Bank ref code (FT…)
  description?: string;             // Optional — full text từ bank notification
};
