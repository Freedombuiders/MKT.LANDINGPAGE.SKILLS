import { supabaseAdmin } from "@/lib/supabase-admin";
import { getAuthedUser } from "@/lib/auth-user";
import { ok, err, unauthenticated, readJson } from "@/lib/http";
import { signEntitlement, verifyEntitlement } from "@/lib/signing";
import { getActiveDisciplines, derivePlan } from "@/lib/entitlement";

export const runtime = "nodejs";

type Body = { device_id?: string; token?: string };

/**
 * POST /api/refresh-token
 * Cấp lại entitlement token: kiểm tra revoked_devices, cập nhật last_seen,
 * tính lại disciplines theo sub mới nhất.
 *
 * Vẫn BẮT BUỘC user JWT cho bảo mật. Nếu body có token cũ thì verify chữ ký
 * (cùng device) như một lớp kiểm tra phụ — nhưng không thay thế user JWT.
 */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return unauthenticated();

  const body = (await readJson<Body>(req)) || {};
  let deviceId =
    typeof body.device_id === "string" ? body.device_id.trim() : "";

  // Nếu client gửi token cũ, verify chữ ký để lấy/đối chiếu device.
  if (body.token) {
    const old = verifyEntitlement(body.token);
    if (!old) {
      return err("BAD_REQUEST", "Token cũ không hợp lệ.");
    }
    if (!deviceId) deviceId = old.device;
    if (old.device !== deviceId || old.sub !== user.userId) {
      return err("BAD_REQUEST", "Token cũ không khớp thiết bị hoặc tài khoản.");
    }
  }

  if (!deviceId) {
    return err("BAD_REQUEST", "Thiếu device_id của thiết bị.");
  }

  const db = supabaseAdmin();

  try {
    // Thiết bị bị thu hồi (refund/chargeback)?
    const { data: revoked, error: revErr } = await db
      .from("revoked_devices")
      .select("device_id")
      .eq("device_id", deviceId)
      .limit(1);
    if (revErr) {
      return err("INTERNAL", "Không kiểm tra được trạng thái thu hồi thiết bị.");
    }
    if (revoked && revoked.length > 0) {
      return err(
        "REVOKED",
        "Thiết bị này đã bị thu hồi quyền. Vui lòng liên hệ hỗ trợ."
      );
    }

    // Cập nhật last_seen_at.
    const now = new Date().toISOString();
    await db
      .from("device_activations")
      .update({ last_seen_at: now })
      .eq("user_id", user.userId)
      .eq("device_id", deviceId);

    const disciplines = await getActiveDisciplines(db, user.userId);
    const plan = derivePlan(disciplines);

    const { token, kid, exp, grace_until } = signEntitlement({
      sub: user.userId,
      device: deviceId,
      disciplines,
      plan,
    });

    return ok({ token, kid, exp, grace_until, disciplines });
  } catch {
    return err("INTERNAL", "Có lỗi xảy ra khi làm mới token.");
  }
}
