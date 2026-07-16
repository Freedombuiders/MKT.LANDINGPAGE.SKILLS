import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireSuperAdmin, findUserByEmail } from "@/lib/superadmin-auth";

export const runtime = "nodejs";

const VALID_PRODUCTS = ["ARC", "STR", "MEP"] as const;
type Product = (typeof VALID_PRODUCTS)[number];

type Body = {
  email?: string;
  scope?: "ARC" | "STR" | "MEP" | "combo";
  unit?: "month" | "day";
  amount?: number;
};

/** Cộng `amount` tháng hoặc ngày vào 1 mốc thời gian (giữ đúng ngày trong tháng). */
function addDuration(base: Date, unit: "month" | "day", amount: number): Date {
  const d = new Date(base.getTime());
  if (unit === "month") d.setMonth(d.getMonth() + amount);
  else d.setDate(d.getDate() + amount);
  return d;
}

/**
 * POST /api/superadmin/grant-license
 * Body: { email, scope: 'ARC'|'STR'|'MEP'|'combo', unit: 'month'|'day', amount }
 * Cấp/gia hạn license THỦ CÔNG cho user — cộng dồn vào hạn hiện tại (không mất ngày còn lại).
 */
export async function POST(req: Request) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok)
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, message: "Body không hợp lệ." }, { status: 400 });
  }

  const email = (body.email || "").trim();
  const scope = body.scope;
  const unit = body.unit === "day" ? "day" : "month";
  const amount = Number(body.amount);

  if (!email)
    return NextResponse.json({ ok: false, message: "Thiếu email khách hàng." }, { status: 400 });
  if (!scope || (scope !== "combo" && !VALID_PRODUCTS.includes(scope as Product)))
    return NextResponse.json({ ok: false, message: "Bộ môn không hợp lệ." }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0 || amount > 120)
    return NextResponse.json({ ok: false, message: "Thời hạn không hợp lệ." }, { status: 400 });

  const user = await findUserByEmail(email);
  if (!user)
    return NextResponse.json(
      { ok: false, message: `Không tìm thấy tài khoản với email ${email}. Khách cần đăng ký trước.` },
      { status: 404 }
    );

  const products: Product[] =
    scope === "combo" ? [...VALID_PRODUCTS] : [scope as Product];

  const db = supabaseAdmin();
  const now = new Date();
  const nowIso = now.toISOString();
  const results: { product_code: string; current_period_end: string }[] = [];

  for (const product of products) {
    const { data: existing } = await db
      .from("subscriptions")
      .select("current_period_end")
      .eq("user_id", user.id)
      .eq("product_code", product)
      .maybeSingle();

    let base = now;
    if (existing?.current_period_end) {
      const cur = new Date(existing.current_period_end);
      if (cur.getTime() > now.getTime()) base = cur;
    }
    const periodEnd = addDuration(base, unit, amount);

    const { error } = await db.from("subscriptions").upsert(
      {
        user_id: user.id,
        product_code: product,
        source: "paid",
        status: "active",
        current_period_end: periodEnd.toISOString(),
        updated_at: nowIso,
      },
      { onConflict: "user_id,product_code" }
    );
    if (error)
      return NextResponse.json(
        { ok: false, message: `Lỗi cấp ${product}: ${error.message}` },
        { status: 500 }
      );
    results.push({ product_code: product, current_period_end: periodEnd.toISOString() });
  }

  return NextResponse.json({
    ok: true,
    email: user.email,
    full_name: user.full_name || "",
    granted: results,
    unit,
    amount,
  });
}
