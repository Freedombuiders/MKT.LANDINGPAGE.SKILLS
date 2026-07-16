import crypto from "crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const UNSUB_SECRET =
  process.env.CRON_SECRET || "revit-license-unsubscribe-fallback-secret";

/** HMAC-SHA256(email) → token hex, dùng để verify link unsubscribe. */
function signEmail(email: string): string {
  return crypto
    .createHmac("sha256", UNSUB_SECRET)
    .update(email.toLowerCase().trim())
    .digest("hex");
}

function htmlPage(title: string, message: string, status = 200): NextResponse {
  const body = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
</head>
<body style="margin:0; font-family:Arial, Helvetica, sans-serif; background:#f4f5f7; color:#1f2937;">
  <div style="max-width:520px; margin:60px auto; background:#fff; border-radius:12px; padding:40px 32px; text-align:center; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <h1 style="font-size:22px; color:#0f172a; margin:0 0 16px;">${title}</h1>
    <p style="font-size:15px; line-height:1.6; color:#374151; margin:0;">${message}</p>
  </div>
</body>
</html>`;
  return new NextResponse(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/**
 * GET /api/unsubscribe?email=<email>&token=<hmac>
 * Public. Verify token (HMAC của email) rồi INSERT email_unsubscribes.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const email = (url.searchParams.get("email") || "").toLowerCase().trim();

  if (!token || !email) {
    return htmlPage(
      "Liên kết không hợp lệ",
      "Đường dẫn huỷ đăng ký thiếu thông tin. Anh/chị vui lòng bấm lại link trong email.",
      400
    );
  }

  const expected = signEmail(email);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  const valid = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!valid) {
    return htmlPage(
      "Liên kết không hợp lệ",
      "Mã xác thực không đúng. Anh/chị vui lòng bấm lại link trong email gốc.",
      400
    );
  }

  try {
    await supabaseAdmin()
      .from("email_unsubscribes")
      .upsert({ email, at: new Date().toISOString() }, { onConflict: "email" });
  } catch {
    return htmlPage(
      "Có lỗi xảy ra",
      "Hệ thống tạm thời không xử lý được yêu cầu. Anh/chị vui lòng thử lại sau.",
      500
    );
  }

  return htmlPage(
    "Đã huỷ đăng ký thành công",
    `Email <strong>${email}</strong> sẽ không nhận email khuyến mãi nữa. Các email liên quan đến giao dịch và giấy phép vẫn được gửi bình thường.`
  );
}
