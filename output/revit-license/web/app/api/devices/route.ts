import { supabaseAdmin } from "@/lib/supabase-admin";
import { getAuthedUser } from "@/lib/auth-user";
import { ok, err, unauthenticated, readJson } from "@/lib/http";

export const runtime = "nodejs";

type PostBody = { device_id?: string; action?: string };

/**
 * GET /api/devices
 * Liệt kê thiết bị của user hiện tại (web dashboard).
 */
export async function GET(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return unauthenticated();

  const db = supabaseAdmin();
  try {
    const { data, error } = await db
      .from("device_activations")
      .select("id, device_id, device_name, last_seen_at, status, created_at")
      .eq("user_id", user.userId)
      .order("last_seen_at", { ascending: false });
    if (error) {
      return err("INTERNAL", "Không tải được danh sách thiết bị.");
    }
    return ok({ devices: data || [] });
  } catch {
    return err("INTERNAL", "Có lỗi xảy ra khi tải thiết bị.");
  }
}

/**
 * POST /api/devices  { device_id, action: 'revoke' }
 * Gỡ (revoke) một thiết bị để giải phóng seat.
 */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return unauthenticated();

  const body = (await readJson<PostBody>(req)) || {};
  const deviceId =
    typeof body.device_id === "string" ? body.device_id.trim() : "";
  const action = body.action;

  if (!deviceId) {
    return err("BAD_REQUEST", "Thiếu device_id.");
  }
  if (action !== "revoke") {
    return err("BAD_REQUEST", "Hành động không hợp lệ (chỉ hỗ trợ 'revoke').");
  }

  const db = supabaseAdmin();
  try {
    const { data, error } = await db
      .from("device_activations")
      .update({ status: "revoked" })
      .eq("user_id", user.userId)
      .eq("device_id", deviceId)
      .select("device_id");
    if (error) {
      return err("INTERNAL", "Không gỡ được thiết bị.");
    }
    if (!data || data.length === 0) {
      return err("NOT_FOUND", "Không tìm thấy thiết bị này.");
    }
    return ok({ device_id: deviceId, status: "revoked" });
  } catch {
    return err("INTERNAL", "Có lỗi xảy ra khi gỡ thiết bị.");
  }
}
