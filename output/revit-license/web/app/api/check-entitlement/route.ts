import { supabaseAdmin } from "@/lib/supabase-admin";
import { getAuthedUser } from "@/lib/auth-user";
import { ok, err, unauthenticated, readJson } from "@/lib/http";

export const runtime = "nodejs";

type Body = { device_id?: string; command_id?: string };

/**
 * POST /api/check-entitlement  (tuỳ chọn — online check thuần theo command)
 * Tra command_registry → product_code → kiểm tra sub active → trả {allowed, reason}.
 * Luôn HTTP 200 (kể cả khi không có quyền) để add-in tự xử lý theo reason.
 */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return unauthenticated();

  const body = (await readJson<Body>(req)) || {};
  const deviceId =
    typeof body.device_id === "string" ? body.device_id.trim() : "";
  const commandId =
    typeof body.command_id === "string" ? body.command_id.trim() : "";
  if (!commandId) {
    return err("BAD_REQUEST", "Thiếu command_id.");
  }

  const db = supabaseAdmin();

  try {
    // Tra command_registry → product_code.
    const { data: cmd, error: cmdErr } = await db
      .from("command_registry")
      .select("product_code")
      .eq("command_id", commandId)
      .maybeSingle();
    if (cmdErr) {
      return err("INTERNAL", "Không tra được command registry.");
    }
    if (!cmd) {
      return err("NOT_FOUND", "Không tìm thấy command này trong hệ thống.");
    }
    const productCode = (cmd as { product_code: string }).product_code;

    // Kiểm tra sub active cho product này.
    const { data: subs, error: subErr } = await db
      .from("subscriptions")
      .select("id")
      .eq("user_id", user.userId)
      .eq("product_code", productCode)
      .eq("status", "active")
      .gt("current_period_end", new Date().toISOString())
      .limit(1);
    if (subErr) {
      return err("INTERNAL", "Không kiểm tra được quyền sử dụng.");
    }

    const allowed = !!(subs && subs.length > 0);
    const reason = allowed ? "OK" : "NO_ENTITLEMENT";

    // Ghi check_logs (audit) — không chặn response nếu lỗi.
    await db
      .from("check_logs")
      .insert({
        user_id: user.userId,
        device_id: deviceId || null,
        command_id: commandId,
        result: allowed ? "allowed" : "denied",
        at: new Date().toISOString(),
      })
      .then(
        () => undefined,
        () => undefined
      );

    return ok({ allowed, reason });
  } catch {
    return err("INTERNAL", "Có lỗi xảy ra khi kiểm tra quyền.");
  }
}
