import { NextResponse } from "next/server";

import { createLead } from "@/lib/leads-store";
import { generateVietQRUrl } from "@/lib/sepay";

const PRODUCT_NAME = "English Zoom Kids · Trọn gói 10 buổi";
const DEFAULT_PRODUCT_AMOUNT = 3_000_000;
const phonePattern = /^(0|\+84)[0-9]{9}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizePhone(phone: string): string {
  return phone.startsWith("+84") ? `0${phone.slice(3)}` : phone;
}

function getProductAmount(): number {
  const configuredAmount = Number(process.env.SEPAY_PAYMENT_AMOUNT);
  return Number.isSafeInteger(configuredAmount) && configuredAmount > 0
    ? configuredAmount
    : DEFAULT_PRODUCT_AMOUNT;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const rawPhone = typeof body.phone === "string" ? body.phone.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (name.length < 2) {
      return NextResponse.json({ error: "Vui lòng nhập họ tên hợp lệ." }, { status: 400 });
    }
    if (!phonePattern.test(rawPhone)) {
      return NextResponse.json(
        { error: "Số điện thoại cần có dạng 0xxxxxxxxx hoặc +84xxxxxxxxx." },
        { status: 400 },
      );
    }
    if (!emailPattern.test(email)) {
      return NextResponse.json({ error: "Vui lòng nhập email hợp lệ." }, { status: 400 });
    }

    const bank = process.env.SEPAY_BANK_NAME?.trim();
    const accountNumber = process.env.SEPAY_BANK_ACCOUNT_NUMBER?.trim();
    const accountName = process.env.SEPAY_ACCOUNT_NAME?.trim();

    if (!bank || !accountNumber || !accountName) {
      console.error("[checkout] Missing Sepay bank environment variables");
      return NextResponse.json(
        { error: "Hệ thống thanh toán đang được cấu hình. Vui lòng quay lại sau." },
        { status: 503 },
      );
    }

    const productAmount = getProductAmount();
    const { orderId } = await createLead({
      name,
      phone: normalizePhone(rawPhone),
      email,
      productName: PRODUCT_NAME,
      amount: productAmount,
    });

    const paymentContent = `SEVQR TKPCOD ${orderId}`;

    return NextResponse.json({
      orderId,
      amount: productAmount,
      productName: PRODUCT_NAME,
      bankInfo: { bank, accountNumber, accountName },
      content: paymentContent,
      qrUrl: generateVietQRUrl({
        accountNumber,
        bank,
        amount: productAmount,
        content: paymentContent,
        template: "compact",
      }),
    });
  } catch (error) {
    console.error("[checkout] Unhandled error", error);
    return NextResponse.json(
      { error: "Chưa thể tạo đơn lúc này. Anh/chị vui lòng thử lại." },
      { status: 500 },
    );
  }
}
