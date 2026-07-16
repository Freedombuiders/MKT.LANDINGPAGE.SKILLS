import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function checkAdmin(req: Request): boolean {
  const expected = process.env.ADMIN_PASSWORD || "123456";
  return req.headers.get("x-admin-pass") === expected;
}

/**
 * GET /api/admin/licenses?q=<email|phone>
 * Tìm user theo email/phone (bảng profiles) → trả subs + devices của user đó.
 */
export async function GET(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ ok: false, message: "Không có quyền." }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const db = supabaseAdmin();

  try {
    let profQuery = db
      .from("profiles")
      .select("id, full_name, phone, company, created_at")
      .order("created_at", { ascending: false })
      .limit(25);

    if (q) {
      profQuery = profQuery.or(`phone.ilike.%${q}%,full_name.ilike.%${q}%`);
    }

    const { data: profiles, error: profErr } = await profQuery;
    if (profErr) {
      return NextResponse.json(
        { ok: false, message: "Không tìm được người dùng." },
        { status: 500 }
      );
    }

    // Bổ sung email từ auth (profiles không giữ email). Nếu q là email → lọc theo email.
    const enriched = await Promise.all(
      (profiles || []).map(async (p: { id: string; full_name: string | null; phone: string | null; company: string | null; created_at: string | null }) => {
        let email: string | null = null;
        try {
          const { data } = await db.auth.admin.getUserById(p.id);
          email = data?.user?.email ?? null;
        } catch {
          email = null;
        }
        return { ...p, email };
      })
    );

    let users = enriched;
    if (q && q.includes("@")) {
      const ql = q.toLowerCase();
      users = enriched.filter((u) => (u.email || "").toLowerCase().includes(ql));
    }

    const userIds = users.map((u) => u.id);
    let subs: unknown[] = [];
    let devices: unknown[] = [];

    if (userIds.length > 0) {
      const { data: subData } = await db
        .from("subscriptions")
        .select("id, user_id, product_code, source, status, current_period_end, max_devices")
        .in("user_id", userIds);
      subs = subData || [];

      const { data: devData } = await db
        .from("device_activations")
        .select("id, user_id, device_id, device_name, last_seen_at, status")
        .in("user_id", userIds);
      devices = devData || [];
    }

    return NextResponse.json({ ok: true, users, subscriptions: subs, devices });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: "Lỗi tìm kiếm.", detail: String(e) },
      { status: 500 }
    );
  }
}

type PostBody = {
  action?: "renew" | "revoke_device" | "revoke_refund";
  subscription_id?: string;
  days?: number;
  device_id?: string;
  user_id?: string;
  reason?: string;
};

/**
 * POST /api/admin/licenses
 * - renew: gia hạn thủ công 1 sub (cộng dồn current_period_end + days, mặc định 30).
 * - revoke_device: gỡ 1 thiết bị (set status='revoked').
 * - revoke_refund: thêm device_id vào revoked_devices (chặn refresh — refund/chargeback).
 */
export async function POST(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ ok: false, message: "Không có quyền." }, { status: 401 });
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ ok: false, message: "Body không hợp lệ." }, { status: 400 });
  }

  const db = supabaseAdmin();

  try {
    if (body.action === "renew") {
      if (!body.subscription_id) {
        return NextResponse.json(
          { ok: false, message: "Thiếu subscription_id." },
          { status: 400 }
        );
      }
      const days = typeof body.days === "number" && body.days > 0 ? body.days : 30;

      const { data: sub, error: subErr } = await db
        .from("subscriptions")
        .select("id, current_period_end")
        .eq("id", body.subscription_id)
        .maybeSingle();
      if (subErr || !sub) {
        return NextResponse.json(
          { ok: false, message: "Không tìm thấy subscription." },
          { status: 404 }
        );
      }

      const now = Date.now();
      const curEnd = sub.current_period_end
        ? new Date(sub.current_period_end).getTime()
        : now;
      const base = Math.max(now, curEnd);
      const newEnd = new Date(base + days * 24 * 60 * 60 * 1000).toISOString();

      const { error: upErr } = await db
        .from("subscriptions")
        .update({
          current_period_end: newEnd,
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", body.subscription_id);
      if (upErr) {
        return NextResponse.json(
          { ok: false, message: "Không gia hạn được." },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: true, current_period_end: newEnd });
    }

    if (body.action === "revoke_device") {
      if (!body.device_id) {
        return NextResponse.json(
          { ok: false, message: "Thiếu device_id." },
          { status: 400 }
        );
      }
      let query = db
        .from("device_activations")
        .update({ status: "revoked" })
        .eq("device_id", body.device_id);
      if (body.user_id) query = query.eq("user_id", body.user_id);

      const { error: revErr } = await query;
      if (revErr) {
        return NextResponse.json(
          { ok: false, message: "Không gỡ được thiết bị." },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: true });
    }

    if (body.action === "revoke_refund") {
      if (!body.device_id) {
        return NextResponse.json(
          { ok: false, message: "Thiếu device_id." },
          { status: 400 }
        );
      }
      const { error: insErr } = await db.from("revoked_devices").upsert(
        {
          device_id: body.device_id,
          reason: body.reason || "refund",
          at: new Date().toISOString(),
        },
        { onConflict: "device_id" }
      );
      if (insErr) {
        return NextResponse.json(
          { ok: false, message: "Không thêm được vào danh sách thu hồi." },
          { status: 500 }
        );
      }
      // Đồng thời revoke device_activations tương ứng nếu có.
      await db
        .from("device_activations")
        .update({ status: "revoked" })
        .eq("device_id", body.device_id);

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { ok: false, message: "Hành động không hợp lệ." },
      { status: 400 }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: "Lỗi xử lý.", detail: String(e) },
      { status: 500 }
    );
  }
}
