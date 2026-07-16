import { supabaseAdmin } from "@/lib/supabase-admin";
import { getAuthedUser } from "@/lib/auth-user";
import { ok, err, unauthenticated, readJson } from "@/lib/http";

export const runtime = "nodejs";

type Body = { device_fingerprint?: string };

const TRIAL_DAYS = 30;
const TRIAL_PRODUCTS = ["ARC", "STR", "MEP"] as const;

/**
 * POST /api/issue-trial
 * Cấp trial 30 ngày cho cả 3 bộ môn. Chống lạm dụng: chặn theo user_id LẪN device_fingerprint.
 */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return unauthenticated();

  const body = (await readJson<Body>(req)) || {};
  const fingerprint =
    typeof body.device_fingerprint === "string" && body.device_fingerprint.trim()
      ? body.device_fingerprint.trim()
      : null;

  const db = supabaseAdmin();

  try {
    // Đã từng có trial theo user_id HOẶC theo device_fingerprint?
    let existsQuery = db.from("trials").select("id").limit(1);
    if (fingerprint) {
      existsQuery = existsQuery.or(
        `user_id.eq.${user.userId},device_fingerprint.eq.${fingerprint}`
      );
    } else {
      existsQuery = existsQuery.eq("user_id", user.userId);
    }
    const { data: existing, error: selErr } = await existsQuery;
    if (selErr) {
      return err("INTERNAL", "Không kiểm tra được trạng thái dùng thử.");
    }
    if (existing && existing.length > 0) {
      return err("TRIAL_USED", "Tài khoản hoặc máy này đã dùng thử rồi.");
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    const expiresIso = expiresAt.toISOString();

    // Insert trial — unique(user_id) sẽ bắt race condition.
    const { error: trialErr } = await db.from("trials").insert({
      user_id: user.userId,
      device_fingerprint: fingerprint,
      granted_at: now.toISOString(),
      expires_at: expiresIso,
    });
    if (trialErr) {
      // 23505 = unique_violation → đã có trial.
      if ((trialErr as { code?: string }).code === "23505") {
        return err("TRIAL_USED", "Tài khoản hoặc máy này đã dùng thử rồi.");
      }
      return err("INTERNAL", "Không tạo được bản ghi dùng thử.");
    }

    // Upsert 3 subscriptions trial (ARC/STR/MEP).
    const rows = TRIAL_PRODUCTS.map((code) => ({
      user_id: user.userId,
      product_code: code,
      source: "trial",
      status: "active",
      current_period_end: expiresIso,
      max_devices: 2,
      updated_at: now.toISOString(),
    }));
    const { error: subErr } = await db
      .from("subscriptions")
      .upsert(rows, { onConflict: "user_id,product_code" });
    if (subErr) {
      return err("INTERNAL", "Không tạo được quyền dùng thử cho các bộ môn.");
    }

    return ok({ expires_at: expiresIso });
  } catch {
    return err("INTERNAL", "Có lỗi xảy ra khi cấp bản dùng thử.");
  }
}
