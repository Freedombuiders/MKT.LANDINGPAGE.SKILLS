import { supabaseAdmin } from "@/lib/supabase-admin";
import { getAuthedUser } from "@/lib/auth-user";
import { ok, err, unauthenticated, readJson } from "@/lib/http";

export const runtime = "nodejs";

type Body = { plan_id?: string };

/**
 * POST /api/create-order
 * Verify user JWT, nhận { plan_id }, tạo đơn pending + trả VietQR.
 */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return unauthenticated();

  const body = (await readJson<Body>(req)) || {};
  const planId =
    typeof body.plan_id === "string" && body.plan_id.trim()
      ? body.plan_id.trim()
      : null;
  if (!planId) {
    return err("BAD_REQUEST", "Thiếu plan_id.");
  }

  const bankAccount = process.env.SEPAY_BANK_ACCOUNT;
  const bankCode = process.env.SEPAY_BANK_CODE;
  const bankName = process.env.SEPAY_BANK_NAME || "";
  if (!bankAccount || !bankCode) {
    return err("INTERNAL", "Hệ thống thanh toán chưa được cấu hình.");
  }

  const db = supabaseAdmin();

  try {
    // Lấy plan, phải đang active.
    const { data: plan, error: planErr } = await db
      .from("plans")
      .select("id, name, period, price_vnd, is_active")
      .eq("id", planId)
      .maybeSingle();
    if (planErr) {
      return err("INTERNAL", "Không đọc được thông tin gói.");
    }
    if (!plan || !plan.is_active) {
      return err("NOT_FOUND", "Gói không tồn tại hoặc đã ngừng bán.");
    }

    // Sinh order_id (DH######) qua RPC next_order_id.
    const { data: orderId, error: idErr } = await db.rpc("next_order_id");
    if (idErr || !orderId) {
      return err("INTERNAL", "Không tạo được mã đơn hàng.");
    }

    const amount = plan.price_vnd as number;
    const nowIso = new Date().toISOString();

    const { error: insErr } = await db.from("orders").insert({
      id: orderId,
      user_id: user.userId,
      plan_id: plan.id,
      amount_vnd: amount,
      status: "pending",
      created_at: nowIso,
    });
    if (insErr) {
      return err("INTERNAL", "Không tạo được đơn hàng.");
    }

    // VietQR qua Sepay image API — nội dung CK = order_id.
    const qrUrl =
      `https://qr.sepay.vn/img?acc=${encodeURIComponent(bankAccount)}` +
      `&bank=${encodeURIComponent(bankCode)}` +
      `&amount=${encodeURIComponent(String(amount))}` +
      `&des=${encodeURIComponent(orderId)}`;

    return ok({
      order_id: orderId,
      amount,
      qr_url: qrUrl,
      bank_info: {
        account: bankAccount,
        bank_code: bankCode,
        bank_name: bankName,
        content: orderId,
      },
    });
  } catch {
    return err("INTERNAL", "Có lỗi xảy ra khi tạo đơn hàng.");
  }
}
