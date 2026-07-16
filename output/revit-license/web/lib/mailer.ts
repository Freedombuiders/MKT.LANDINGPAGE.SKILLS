import { promises as fs } from "fs";
import path from "path";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Email engine provider-agnostic.
 * - Ưu tiên Resend (RESEND_API_KEY) qua HTTP API.
 * - Fallback SMTP (nodemailer) nếu không có Resend key.
 *
 * Mọi helper send* KHÔNG được throw ra ngoài — luôn catch + log thất bại,
 * vì chúng được gọi từ webhook thanh toán / cron (không được làm sập route).
 */

type TemplateName = "purchase-confirm" | "expiry-reminder" | "campaign-base";
type EmailType = "purchase" | "expiry" | "campaign";

const MAIL_FROM = process.env.MAIL_FROM || "Revit License <no-reply@example.com>";

/**
 * Gửi 1 email. Tự chọn provider theo env.
 * Trả {ok, error?} — không throw.
 */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    if (process.env.RESEND_API_KEY) {
      return await sendViaResend({ to, subject, html });
    }
    if (process.env.SMTP_HOST) {
      return await sendViaSmtp({ to, subject, html });
    }
    return { ok: false, error: "Chưa cấu hình RESEND_API_KEY hoặc SMTP_HOST." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function sendViaResend({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: MAIL_FROM, to, subject, html }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `Resend ${res.status}: ${text}` };
  }
  return { ok: true };
}

async function sendViaSmtp({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  // Import động để không bắt buộc nodemailer khi dùng Resend.
  const nodemailer = (await import("nodemailer")).default;
  const port = Number(process.env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  await transport.sendMail({ from: MAIL_FROM, to, subject, html });
  return { ok: true };
}

/**
 * Đọc template HTML từ templates/email/<name>.html và thay token {{key}}.
 * Token không có trong vars sẽ được thay bằng chuỗi rỗng để tránh lộ {{...}}.
 */
export async function renderTemplate(
  name: TemplateName,
  vars: Record<string, string>
): Promise<string> {
  const filePath = path.join(process.cwd(), "templates", "email", `${name}.html`);
  const raw = await fs.readFile(filePath, "utf8");
  return raw.replace(/{{\s*([\w.]+)\s*}}/g, (_m, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

/**
 * Ghi log mỗi lần gửi vào email_logs.
 * Không throw — log lỗi ra console nếu insert fail.
 */
export async function logEmail(
  type: EmailType,
  to_email: string,
  status: "sent" | "failed",
  error?: string,
  campaign_id?: string | number | null
): Promise<void> {
  try {
    await supabaseAdmin()
      .from("email_logs")
      .insert({
        type,
        to_email,
        status,
        error: error ?? null,
        campaign_id: campaign_id ?? null,
        sent_at: new Date().toISOString(),
      });
  } catch (e) {
    console.error("logEmail failed:", e instanceof Error ? e.message : e);
  }
}

/**
 * Email xác nhận mua thành công — gọi từ webhook thanh toán (module 03).
 * CHỮ KÝ NÀY CỐ ĐỊNH để payment agent khớp.
 */
export async function sendPurchaseConfirmEmail({
  to,
  fullName,
  planName,
  expiresAt,
}: {
  to: string;
  fullName?: string;
  planName: string;
  expiresAt: string;
}): Promise<void> {
  try {
    const html = await renderTemplate("purchase-confirm", {
      fullName: fullName || "anh/chị",
      planName,
      expiresAt,
    });
    const r = await sendEmail({
      to,
      subject: "Xác nhận kích hoạt giấy phép Revit Add-in",
      html,
    });
    await logEmail("purchase", to, r.ok ? "sent" : "failed", r.error);
  } catch (e) {
    await logEmail(
      "purchase",
      to,
      "failed",
      e instanceof Error ? e.message : String(e)
    );
  }
}

/**
 * Email nhắc license sắp hết hạn — gọi từ cron expiry-mailer (module 09).
 * Transactional: không có link unsubscribe.
 */
export async function sendExpiryReminderEmail({
  to,
  fullName,
  planName,
  expiresAt,
  renewUrl,
  daysLeft,
}: {
  to: string;
  fullName?: string;
  planName: string;
  expiresAt: string;
  renewUrl: string;
  daysLeft: number | string;
}): Promise<void> {
  try {
    const html = await renderTemplate("expiry-reminder", {
      fullName: fullName || "anh/chị",
      planName,
      expiresAt,
      renewUrl,
      daysLeft: String(daysLeft),
    });
    const r = await sendEmail({
      to,
      subject: `Giấy phép ${planName} sắp hết hạn trong ${daysLeft} ngày`,
      html,
    });
    await logEmail("expiry", to, r.ok ? "sent" : "failed", r.error);
  } catch (e) {
    await logEmail(
      "expiry",
      to,
      "failed",
      e instanceof Error ? e.message : String(e)
    );
  }
}
