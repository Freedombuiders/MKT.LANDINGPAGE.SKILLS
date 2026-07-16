import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireSuperAdmin } from "@/lib/superadmin-auth";

export const runtime = "nodejs";

/**
 * GET /api/superadmin/customers?q=<email|tên|sđt>
 * Danh sách khách hàng (profiles) + email + bộ môn đang active + hạn dùng.
 */
export async function GET(req: Request) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok)
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });

  const db = supabaseAdmin();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const nowMs = Date.now();

  // Lấy danh sách user qua auth (có email) — nguồn chuẩn cho email.
  const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let users = (list?.users || []).map((u) => {
    const meta = (u.user_metadata || {}) as Record<string, unknown>;
    return {
      id: u.id,
      email: u.email || "",
      full_name: (meta.full_name as string) || (meta.name as string) || "",
      phone: (meta.phone as string) || "",
      created_at: u.created_at,
    };
  });

  if (q) {
    users = users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.full_name.toLowerCase().includes(q) ||
        u.phone.toLowerCase().includes(q)
    );
  }
  users = users.slice(0, 100);

  // Gắn subscriptions cho từng user.
  const ids = users.map((u) => u.id);
  const subsByUser = new Map<string, { product_code: string; status: string; current_period_end: string; source: string }[]>();
  if (ids.length) {
    const { data: subs } = await db
      .from("subscriptions")
      .select("user_id, product_code, status, current_period_end, source")
      .in("user_id", ids);
    for (const s of subs || []) {
      const arr = subsByUser.get(s.user_id) || [];
      arr.push(s);
      subsByUser.set(s.user_id, arr);
    }
  }

  const customers = users.map((u) => {
    const subs = subsByUser.get(u.id) || [];
    const active = subs
      .filter((s) => s.status === "active" && new Date(s.current_period_end).getTime() > nowMs)
      .map((s) => ({
        product_code: s.product_code,
        source: s.source,
        current_period_end: s.current_period_end,
      }));
    return { ...u, active };
  });

  return NextResponse.json({ ok: true, total: customers.length, customers });
}
