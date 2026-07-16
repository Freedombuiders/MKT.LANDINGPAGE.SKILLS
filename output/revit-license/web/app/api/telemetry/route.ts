import { supabaseAdmin } from "@/lib/supabase-admin";
import { getAuthedUser } from "@/lib/auth-user";
import { ok, err, unauthenticated, readJson } from "@/lib/http";

export const runtime = "nodejs";

const MAX_EVENTS = 200;
const MAX_STACK = 8 * 1024; // 8KB
const ALLOWED_STATUS = new Set(["success", "error", "denied"]);

type UsageEventInput = {
  user_id?: string; // bị bỏ qua — server ép theo token
  device_id?: string;
  session_id?: string;
  command_id?: string;
  product_code?: string;
  status?: string;
  duration_ms?: number;
  revit_version?: string;
  app_version?: string;
  error_code?: string;
  error_message?: string;
  stack_trace?: string;
  started_at?: string;
};

type Body = { events?: UsageEventInput[] };

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * POST /api/telemetry
 * Batch ingest usage events từ add-in (fire-and-forget).
 * - Verify user JWT → ép user_id (bỏ giá trị client gửi, chống giả mạo).
 * - Giới hạn ≤200 event/req. Bắt buộc command_id. Cắt stack_trace ≤8KB.
 * - Coerce status về tập cho phép. Bulk insert.
 */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return unauthenticated();

  const body = (await readJson<Body>(req)) || {};
  const events = body.events;
  if (!Array.isArray(events)) {
    return err("BAD_REQUEST", "Thiếu mảng 'events'.");
  }
  if (events.length === 0) {
    return ok({ accepted: 0 });
  }
  if (events.length > MAX_EVENTS) {
    return err(
      "BAD_REQUEST",
      `Quá nhiều event trong 1 lần gửi (tối đa ${MAX_EVENTS}).`
    );
  }

  const nowIso = new Date().toISOString();
  const rows: Record<string, unknown>[] = [];

  for (const e of events) {
    if (!e || typeof e !== "object") continue;

    const command_id = str(e.command_id);
    if (!command_id) {
      return err("BAD_REQUEST", "Mỗi event phải có command_id.");
    }

    const rawStatus = str(e.status) || "success";
    const status = ALLOWED_STATUS.has(rawStatus) ? rawStatus : "success";

    let stack = str(e.stack_trace);
    if (stack && stack.length > MAX_STACK) {
      stack = stack.slice(0, MAX_STACK);
    }

    rows.push({
      user_id: user.userId, // ép theo token, bỏ e.user_id
      device_id: str(e.device_id),
      session_id: str(e.session_id),
      command_id,
      product_code: str(e.product_code),
      status,
      duration_ms: num(e.duration_ms),
      revit_version: str(e.revit_version),
      app_version: str(e.app_version),
      error_code: str(e.error_code),
      error_message: str(e.error_message),
      stack_trace: stack,
      started_at: str(e.started_at) || nowIso,
    });
  }

  if (rows.length === 0) {
    return ok({ accepted: 0 });
  }

  try {
    const { error } = await supabaseAdmin().from("usage_events").insert(rows);
    if (error) {
      return err("INTERNAL", "Không ghi được telemetry.");
    }
    return ok({ accepted: rows.length });
  } catch {
    return err("INTERNAL", "Có lỗi khi ghi telemetry.");
  }
}
