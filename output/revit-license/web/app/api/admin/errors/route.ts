import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function checkAdmin(req: Request): boolean {
  const expected = process.env.ADMIN_PASSWORD || "123456";
  return req.headers.get("x-admin-pass") === expected;
}

type ErrAgg = {
  error_code: string;
  error_message: string;
  count: number;
  sample_stack: string | null;
  last_at: string | null;
};

/**
 * GET /api/admin/errors
 * Top lỗi: group theo (error_code, error_message), kèm 1 stack_trace mẫu.
 */
export async function GET(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ ok: false, message: "Không có quyền." }, { status: 401 });
  }

  const db = supabaseAdmin();

  try {
    const { data, error } = await db
      .from("usage_events")
      .select("error_code, error_message, stack_trace, started_at")
      .eq("status", "error")
      .order("started_at", { ascending: false })
      .limit(5000);

    if (error) {
      return NextResponse.json(
        { ok: false, message: "Không đọc được nhật ký lỗi." },
        { status: 500 }
      );
    }

    const agg = new Map<string, ErrAgg>();
    for (const r of (data || []) as {
      error_code: string | null;
      error_message: string | null;
      stack_trace: string | null;
      started_at: string | null;
    }[]) {
      const code = r.error_code || "(không rõ)";
      const message = r.error_message || "(không rõ)";
      const key = code + "||" + message;
      const cur =
        agg.get(key) ||
        ({
          error_code: code,
          error_message: message,
          count: 0,
          sample_stack: null,
          last_at: null,
        } as ErrAgg);
      cur.count += 1;
      if (!cur.sample_stack && r.stack_trace) cur.sample_stack = r.stack_trace;
      if (!cur.last_at && r.started_at) cur.last_at = r.started_at;
      agg.set(key, cur);
    }

    const errors = Array.from(agg.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);

    return NextResponse.json({ ok: true, errors });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: "Lỗi truy vấn nhật ký.", detail: String(e) },
      { status: 500 }
    );
  }
}
