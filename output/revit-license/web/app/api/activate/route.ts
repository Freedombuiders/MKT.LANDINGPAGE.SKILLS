import { supabaseAdmin } from "@/lib/supabase-admin";
import { getAuthedUser } from "@/lib/auth-user";
import { ok, err, unauthenticated, readJson } from "@/lib/http";
import { signEntitlement } from "@/lib/signing";
import { getActiveDisciplines, derivePlan } from "@/lib/entitlement";

export const runtime = "nodejs";

type Body = { device_id?: string; device_name?: string };

const MAX_DEVICES = 2;

/**
 * POST /api/activate
 * Đăng ký thiết bị (giới hạn seat) + phát entitlement token Ed25519.
 */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return unauthenticated();

  const body = (await readJson<Body>(req)) || {};
  const deviceId =
    typeof body.device_id === "string" ? body.device_id.trim() : "";
  const deviceName =
    typeof body.device_name === "string" ? body.device_name.trim() : null;
  if (!deviceId) {
    return err("BAD_REQUEST", "Thiếu device_id của thiết bị.");
  }

  const db = supabaseAdmin();

  try {
    // Đếm thiết bị active của user + kiểm tra device này đã đăng ký chưa.
    const { data: devices, error: devErr } = await db
      .from("device_activations")
      .select("device_id")
      .eq("user_id", user.userId)
      .eq("status", "active");
    if (devErr) {
      return err("INTERNAL", "Không kiểm tra được danh sách thiết bị.");
    }

    const activeList = devices || [];
    const alreadyRegistered = activeList.some((d) => d.device_id === deviceId);
    if (!alreadyRegistered && activeList.length >= MAX_DEVICES) {
      return err(
        "DEVICE_LIMIT",
        "Anh/chị đã vượt số máy cho phép. Vui lòng vào web gỡ bớt một máy rồi kích hoạt lại."
      );
    }

    // Upsert thiết bị (last_seen_at = now, status='active').
    const now = new Date().toISOString();
    const { error: upErr } = await db.from("device_activations").upsert(
      {
        user_id: user.userId,
        device_id: deviceId,
        device_name: deviceName,
        last_seen_at: now,
        status: "active",
      },
      { onConflict: "user_id,device_id" }
    );
    if (upErr) {
      return err("INTERNAL", "Không đăng ký được thiết bị.");
    }

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
    return err("INTERNAL", "Có lỗi xảy ra khi kích hoạt thiết bị.");
  }
}
