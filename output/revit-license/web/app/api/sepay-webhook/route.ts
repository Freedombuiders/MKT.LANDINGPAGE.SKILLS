import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { renewSubscription, type Period } from "@/lib/renew";
import {
  sendTelegramNotification,
  formatPaymentMessage,
} from "@/lib/telegram";

export const runtime = "nodejs";

/**
 * Sepay payload (các field thường dùng). Tên field có thể khác nhau giữa các
 * phiên bản nên ta đọc linh hoạt.
 */
type SepayBody = {
  transferAmount?: number;
  content?: string;
  code?: string;
  id?: string | number;
  referenceCode?: string;
  [k: string]: unknown;
};

const ORDER_ID_RE = /DH\d{6}/;

/** Luôn trả 200 cho Sepay (trừ lỗi xác thực) để tránh retry gây cộng tiền 2 lần. */
function ok200() {
  return NextResponse.json({ ok: true }, { status: 200 });
}

/**
 * POST /api/sepay-webhook — handler idempotent (CỐT LÕI).
 * Sepay gửi header Authorization: Apikey <SEPAY_WEBHOOK_SECRET>.
 */
export async function POST(req: Request) {
  // (a) Xác thực Sepay.
  const secret = process.env.SEPAY_WEBHOOK_SECRET;
  const authHeader =
    req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const m = authHeader.match(/^Apikey\s+(.+)$/i);
  const presented = m ? m[1].trim() : "";
  if (!secret || presented !== secret) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  // (b) Parse body.
  let body: SepayBody;
  try {
    body = (await req.json()) as SepayBody;
  } catch {
    console.warn("[sepay-webhook] Không parse được body");
    return ok200();
  }

  const amount = Number(body.transferAmount);
  const contentRaw = `${body.content ?? ""} ${body.code ?? ""}`;
  const orderMatch = contentRaw.match(ORDER_ID_RE);
  const orderId = orderMatch ? orderMatch[0] : null;

  if (!orderId || !Number.isFinite(amount)) {
    console.warn(
      "[sepay-webhook] Thiếu order_id hoặc số tiền không hợp lệ:",
      contentRaw,
      body.transferAmount
    );
    return ok200();
  }

  const db = supabaseAdmin();

  try {
    // (c) Tìm order pending khớp order_id + amount.
    const { data: order, error: orderErr } = await db
      .from("orders")
      .select("id, user_id, plan_id, amount_vnd, status")
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr) {
      console.error("[sepay-webhook] Lỗi đọc order:", orderErr.message);
      return ok200();
    }
    if (!order) {
      console.warn("[sepay-webhook] Không tìm thấy order:", orderId);
      return ok200();
    }

    // (d) Idempotency: đơn đã paid → không cộng lại.
    if (order.status === "paid") {
      console.log("[sepay-webhook] Order đã paid, bỏ qua:", orderId);
      return ok200();
    }

    if (order.status !== "pending" || order.amount_vnd !== amount) {
      console.warn(
        "[sepay-webhook] Order không khớp trạng thái/số tiền:",
        orderId,
        order.status,
        order.amount_vnd,
        amount
      );
      return ok200();
    }

    // (e) Đánh dấu paid + lưu payment. Dùng điều kiện status='pending' để
    // chống race (hai webhook trùng chạy song song chỉ 1 cái cập nhật được).
    const paidAt = new Date().toISOString();
    const { data: updated, error: updErr } = await db
      .from("orders")
      .update({ status: "paid", paid_at: paidAt })
      .eq("id", orderId)
      .eq("status", "pending")
      .select("id");

    if (updErr) {
      console.error("[sepay-webhook] Lỗi cập nhật order:", updErr.message);
      return ok200();
    }
    if (!updated || updated.length === 0) {
      // Webhook khác đã xử lý xong (đã chuyển khỏi pending) → không cộng lại.
      console.log("[sepay-webhook] Order vừa được xử lý bởi webhook khác:", orderId);
      return ok200();
    }

    const { error: payErr } = await db.from("payments").insert({
      order_id: orderId,
      gateway: "sepay",
      raw: body,
      received_at: paidAt,
    });
    if (payErr) {
      console.error("[sepay-webhook] Lỗi lưu payment:", payErr.message);
    }

    // (f) Load plan (lấy period) + plan_products → gia hạn từng bộ môn.
    const { data: plan, error: planErr } = await db
      .from("plans")
      .select("id, name, period")
      .eq("id", order.plan_id)
      .maybeSingle();
    if (planErr || !plan) {
      console.error(
        "[sepay-webhook] Không đọc được plan của order:",
        orderId,
        planErr?.message
      );
      // Đơn đã paid nhưng không gia hạn được → vẫn trả 200, cần xử lý thủ công.
      return ok200();
    }

    const period = plan.period as Period;

    const { data: products, error: prodErr } = await db
      .from("plan_products")
      .select("product_code")
      .eq("plan_id", order.plan_id);
    if (prodErr) {
      console.error(
        "[sepay-webhook] Không đọc được plan_products:",
        prodErr.message
      );
      return ok200();
    }

    const codes = (products || []).map((p) => p.product_code as string);
    for (const code of codes) {
      try {
        await renewSubscription(order.user_id, code, period);
      } catch (e) {
        console.error(
          `[sepay-webhook] Lỗi gia hạn ${code} cho order ${orderId}:`,
          e
        );
      }
    }

    // Mốc hết hạn để hiển thị trong email (đọc lại 1 sub vừa gia hạn).
    let expiresAt: string | null = null;
    if (codes.length > 0) {
      const { data: sub } = await db
        .from("subscriptions")
        .select("current_period_end")
        .eq("user_id", order.user_id)
        .eq("product_code", codes[0])
        .maybeSingle();
      expiresAt = sub?.current_period_end ?? null;
    }

    // Thông tin khách (email + tên) từ Supabase Auth.
    let toEmail: string | null = null;
    let fullName: string | null = null;
    let phone: string | null = null;
    try {
      const { data: authUser } = await db.auth.admin.getUserById(order.user_id);
      toEmail = authUser?.user?.email ?? null;
      const meta = (authUser?.user?.user_metadata || {}) as Record<string, unknown>;
      fullName =
        (typeof meta.full_name === "string" && meta.full_name) ||
        (typeof meta.name === "string" && meta.name) ||
        null;
      phone =
        (typeof meta.phone === "string" && meta.phone) ||
        authUser?.user?.phone ||
        null;
    } catch (e) {
      console.error("[sepay-webhook] Không lấy được thông tin user:", e);
    }

    // (g) Side-effects fire-and-forget qua Promise.allSettled — không bao giờ chặn 200.
    await Promise.allSettled([
      (async () => {
        if (!toEmail) return;
        try {
          const mod = await import("@/lib/mailer");
          await mod.sendPurchaseConfirmEmail({
            to: toEmail,
            fullName: fullName || "",
            planName: plan.name as string,
            expiresAt: expiresAt || "",
          });
        } catch (e) {
          console.error("[sepay-webhook] Lỗi gửi email xác nhận:", e);
        }
      })(),
      (async () => {
        try {
          await sendTelegramNotification(
            formatPaymentMessage({
              fullName,
              phone,
              email: toEmail,
              amount: order.amount_vnd as number,
              planName: plan.name as string,
            })
          );
        } catch (e) {
          console.error("[sepay-webhook] Lỗi gửi Telegram:", e);
        }
      })(),
    ]);

    // (h) LUÔN trả 200.
    return ok200();
  } catch (e) {
    console.error("[sepay-webhook] Lỗi không xác định:", e);
    // Vẫn trả 200 để Sepay không retry trùng.
    return ok200();
  }
}
