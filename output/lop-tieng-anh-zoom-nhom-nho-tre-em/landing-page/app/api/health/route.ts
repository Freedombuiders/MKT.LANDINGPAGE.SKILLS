import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("order_counter")
      .select("current_value")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
    }

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      counter: data?.current_value ?? 0,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Lỗi không xác định" },
      { status: 503 },
    );
  }
}
