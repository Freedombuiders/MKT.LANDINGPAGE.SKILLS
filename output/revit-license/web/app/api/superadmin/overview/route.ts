import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireSuperAdmin } from "@/lib/superadmin-auth";

export const runtime = "nodejs";

type PaidOrder = {
  id: string;
  amount_vnd: number;
  paid_at: string | null;
  plan_id: string | null;
  user_id: string | null;
};

export async function GET(req: Request) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok)
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });

  const db = supabaseAdmin();
  const nowIso = new Date().toISOString();

  // --- KPIs (đếm bằng head + count exact) ---
  const [{ count: customers }, { count: activeSubs }, { count: trialUsers }] =
    await Promise.all([
      db.from("profiles").select("id", { count: "exact", head: true }),
      db
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .gt("current_period_end", nowIso),
      db.from("trials").select("id", { count: "exact", head: true }),
    ]);

  // Khách đã thanh toán (distinct user có sub source='paid').
  const { data: paidSubs } = await db
    .from("subscriptions")
    .select("user_id")
    .eq("source", "paid");
  const paidCustomers = new Set((paidSubs || []).map((s) => s.user_id)).size;

  // --- Doanh thu từ đơn đã thanh toán ---
  const { data: orders } = await db
    .from("orders")
    .select("id, amount_vnd, paid_at, plan_id, user_id")
    .eq("status", "paid")
    .order("paid_at", { ascending: false })
    .limit(2000);
  const paidOrders = (orders || []) as PaidOrder[];

  const revenue = paidOrders.reduce((s, o) => s + (o.amount_vnd || 0), 0);
  const ordersPaid = paidOrders.length;

  // --- Doanh thu theo ngày (30 ngày gần nhất) ---
  const days: string[] = [];
  const byDay = new Map<string, { revenue: number; orders: number }>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push(key);
    byDay.set(key, { revenue: 0, orders: 0 });
  }
  for (const o of paidOrders) {
    if (!o.paid_at) continue;
    const key = o.paid_at.slice(0, 10);
    const slot = byDay.get(key);
    if (slot) {
      slot.revenue += o.amount_vnd || 0;
      slot.orders += 1;
    }
  }
  const salesByDay = days.map((d) => ({
    day: d.slice(5), // MM-DD
    revenue: byDay.get(d)!.revenue,
    orders: byDay.get(d)!.orders,
  }));

  // --- 10 đơn gần nhất (kèm tên gói + email) ---
  const { data: plans } = await db.from("plans").select("id, name");
  const planMap = new Map((plans || []).map((p) => [p.id, p.name]));

  const recent = await Promise.all(
    paidOrders.slice(0, 10).map(async (o) => {
      let email = "";
      if (o.user_id) {
        const { data: u } = await db.auth.admin.getUserById(o.user_id);
        email = u?.user?.email || "";
      }
      return {
        order_id: o.id,
        email,
        planName: o.plan_id ? planMap.get(o.plan_id) || o.plan_id : "",
        amount: o.amount_vnd,
        paid_at: o.paid_at,
      };
    })
  );

  return NextResponse.json({
    ok: true,
    email: auth.email,
    kpis: {
      revenue,
      customers: customers || 0,
      paidCustomers,
      activeSubs: activeSubs || 0,
      trialUsers: trialUsers || 0,
      ordersPaid,
    },
    salesByDay,
    recent,
  });
}
