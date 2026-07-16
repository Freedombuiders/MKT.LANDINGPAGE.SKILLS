// app/api/checkout/route.ts — Next.js App Router
//
// POST /api/checkout
// Body: { name, phone, email, productName, amount }
// Response: { orderId, amount, bankInfo, qrUrl, content }
//
// Flow:
//   1. Validate input
//   2. Create lead in KV → ra orderId
//   3. Generate Sepay VietQR URL qua lib/sepay.ts
//   4. Return checkout payload — client redirect /checkout/[orderId] hoặc show modal

import { NextResponse } from 'next/server';
import { createLead } from '@/lib/leads-store';
import { generateVietQRUrl } from '@/lib/sepay';

/** Lấy mã affiliate từ cookie `aff_ref` (do AffiliateTracker ghi client-side). */
function readAffCookie(req: Request): string | undefined {
  const cookie = req.headers.get('cookie');
  if (!cookie) return undefined;
  const match = cookie.match(/(?:^|;\s*)aff_ref=([^;]+)/);
  if (!match) return undefined;
  const code = decodeURIComponent(match[1]).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return code || undefined;
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, phone, email, productName, amount } = body;

  // Basic validation
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return NextResponse.json({ error: 'Tên không hợp lệ' }, { status: 400 });
  }
  if (!phone || !/^0\d{9}$/.test(phone)) {
    return NextResponse.json({ error: 'SĐT phải là 10 số bắt đầu bằng 0' }, { status: 400 });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Email không hợp lệ' }, { status: 400 });
  }
  if (!productName || typeof productName !== 'string') {
    return NextResponse.json({ error: 'Sản phẩm không hợp lệ' }, { status: 400 });
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Số tiền không hợp lệ' }, { status: 400 });
  }

  const { orderId, lead } = await createLead({
    name: name.trim(),
    phone,
    email: email.toLowerCase().trim(),
    productName,
    amount,
    affCode: readAffCookie(req),   // biz-affiliate-system — gán đơn cho đối tác (nếu có)
  });

  const bank = process.env.SEPAY_BANK_NAME!;
  const accountNumber = process.env.SEPAY_BANK_ACCOUNT_NUMBER!;
  const qrUrl = generateVietQRUrl({
    accountNumber,
    bank,
    amount,
    content: orderId,
    template: 'compact',
  });

  return NextResponse.json({
    orderId,
    amount,
    productName: lead.productName,
    bankInfo: { bank, accountNumber, accountName: process.env.SEPAY_ACCOUNT_NAME },
    content: orderId,
    qrUrl,
  });
}
