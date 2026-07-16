import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function checkAdmin(req: Request): boolean {
  const expected = process.env.ADMIN_PASSWORD || "123456";
  return req.headers.get("x-admin-pass") === expected;
}

type ToolAgg = {
  command_id: string;
  product_code: string | null;
  runs: number;
  errors: number;
};

/**
 * GET /api/admin/tools
 * Top tool ưa thích (tổng runs) + tỷ lệ lỗi mỗi tool.
 * Ưu tiên mv_tool_daily; fallback usage_events.
 */
export async function GET(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ ok: false, message: "Không có quyền." }, { status: 401 });
  }

  const db = supabaseAdmin();
  const agg = new Map<string, ToolAgg>();

  try {
    const { data: mv, error: mvErr } = await db
      .from("mv_tool_daily")
      .select("command_id, product_code, runs, errors");

    if (!mvErr && mv && mv.length > 0) {
      for (const r of mv as {
        command_id: string;
        product_code: string | null;
        runs: number | null;
        errors: number | null;
      }[]) {
        const cur =
          agg.get(r.command_id) ||
          ({ command_id: r.command_id, product_code: r.product_code, runs: 0, errors: 0 } as ToolAgg);
        cur.runs += r.runs || 0;
        cur.errors += r.errors || 0;
        if (!cur.product_code) cur.product_code = r.product_code;
        agg.set(r.command_id, cur);
      }
    } else {
      // Fallback: đếm từ usage_events.
      const { data: events } = await db
        .from("usage_events")
        .select("command_id, product_code, status")
        .limit(50000);
      for (const e of (events || []) as {
        command_id: string;
        product_code: string | null;
        status: string;
      }[]) {
        if (!e.command_id) continue;
        const cur =
          agg.get(e.command_id) ||
          ({ command_id: e.command_id, product_code: e.product_code, runs: 0, errors: 0 } as ToolAgg);
        cur.runs += 1;
        if (e.status === "error") cur.errors += 1;
        agg.set(e.command_id, cur);
      }
    }

    const tools = Array.from(agg.values())
      .map((t) => ({
        ...t,
        error_rate: t.runs > 0 ? Math.round((t.errors / t.runs) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.runs - a.runs);

    return NextResponse.json({ ok: true, tools });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: "Lỗi truy vấn công cụ.", detail: String(e) },
      { status: 500 }
    );
  }
}
