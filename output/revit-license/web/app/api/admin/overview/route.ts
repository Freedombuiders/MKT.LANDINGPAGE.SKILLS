import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function checkAdmin(req: Request): boolean {
  const expected = process.env.ADMIN_PASSWORD || "123456";
  return req.headers.get("x-admin-pass") === expected;
}

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

/**
 * GET /api/admin/overview
 * KPI tổng quan + chuỗi usage theo ngày (14 ngày gần nhất).
 */
export async function GET(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ ok: false, message: "Không có quyền." }, { status: 401 });
  }

  const db = supabaseAdmin();

  try {
    // Tổng số user (profiles).
    const { count: totalUsers } = await db
      .from("profiles")
      .select("id", { count: "exact", head: true });

    // Subscription đang active.
    const { count: activeSubs } = await db
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");

    // Doanh thu = tổng amount_vnd các đơn paid.
    const { data: paidOrders } = await db
      .from("orders")
      .select("amount_vnd")
      .eq("status", "paid");
    const revenue = (paidOrders || []).reduce(
      (sum, o: { amount_vnd: number | null }) => sum + (o.amount_vnd || 0),
      0
    );

    // DAU = số user_id distinct trong usage_events hôm nay.
    const { data: todayEvents } = await db
      .from("usage_events")
      .select("user_id")
      .gte("started_at", startOfTodayIso());
    const dau = new Set(
      (todayEvents || []).map((e: { user_id: string | null }) => e.user_id).filter(Boolean)
    ).size;

    // Usage theo ngày (14 ngày). Ưu tiên mv_tool_daily; fallback usage_events.
    const since = new Date();
    since.setDate(since.getDate() - 13);
    since.setHours(0, 0, 0, 0);
    const sinceIso = since.toISOString();

    const series: { day: string; runs: number }[] = [];
    const byDay = new Map<string, number>();

    const { data: mv, error: mvErr } = await db
      .from("mv_tool_daily")
      .select("day, runs")
      .gte("day", sinceIso.slice(0, 10));

    if (!mvErr && mv && mv.length > 0) {
      for (const row of mv as { day: string; runs: number | null }[]) {
        const k = String(row.day).slice(0, 10);
        byDay.set(k, (byDay.get(k) || 0) + (row.runs || 0));
      }
    } else {
      const { data: events } = await db
        .from("usage_events")
        .select("started_at")
        .gte("started_at", sinceIso);
      for (const ev of (events || []) as { started_at: string }[]) {
        const k = dayKey(ev.started_at);
        byDay.set(k, (byDay.get(k) || 0) + 1);
      }
    }

    // Lấp đầy đủ 14 ngày liên tục để chart đẹp.
    for (let i = 0; i < 14; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const k = d.toISOString().slice(0, 10);
      series.push({ day: k, runs: byDay.get(k) || 0 });
    }

    return NextResponse.json({
      ok: true,
      kpis: {
        total_users: totalUsers || 0,
        active_subs: activeSubs || 0,
        revenue,
        dau,
      },
      usage_by_day: series,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: "Lỗi truy vấn thống kê.", detail: String(e) },
      { status: 500 }
    );
  }
}
