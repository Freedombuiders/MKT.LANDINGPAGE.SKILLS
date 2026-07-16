import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ok, err, readJson } from "@/lib/http";
import { renderTemplate, sendEmail, logEmail } from "@/lib/mailer";

export const runtime = "nodejs";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123456";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "";
const UNSUB_SECRET =
  process.env.CRON_SECRET || "revit-license-unsubscribe-fallback-secret";
const BATCH_SIZE = 20;

type Body = { campaign_id?: string | number };

type Audience = "all" | "trial" | "paid" | "expired" | "expiring_7d";

/** HMAC-SHA256(email) — khớp với route unsubscribe. */
function unsubscribeToken(email: string): string {
  return crypto
    .createHmac("sha256", UNSUB_SECRET)
    .update(email.toLowerCase().trim())
    .digest("hex");
}

function unsubscribeUrl(email: string): string {
  const e = encodeURIComponent(email.toLowerCase().trim());
  const t = unsubscribeToken(email);
  return `${APP_URL}/api/unsubscribe?email=${e}&token=${t}`;
}

type Recipient = { email: string; name: string };

/**
 * Lấy danh sách user_id thoả segment từ subscriptions.
 * null = không lọc theo subscriptions (audience 'all').
 */
async function userIdsForAudience(
  db: ReturnType<typeof supabaseAdmin>,
  audience: Audience
): Promise<string[] | null> {
  if (audience === "all") return null;

  const todayIso = new Date().toISOString().slice(0, 10);
  let q = db.from("subscriptions").select("user_id, status, source, current_period_end");

  if (audience === "trial") q = q.eq("source", "trial");
  else if (audience === "paid") q = q.eq("source", "paid").eq("status", "active");
  else if (audience === "expired") q = q.eq("status", "expired");
  else if (audience === "expiring_7d") {
    const in7 = new Date();
    in7.setDate(in7.getDate() + 7);
    q = q
      .eq("status", "active")
      .gte("current_period_end", todayIso)
      .lte("current_period_end", in7.toISOString());
  }

  const { data } = await q;
  const ids = new Set<string>();
  for (const r of data || []) {
    if (r.user_id) ids.add(r.user_id as string);
  }
  return [...ids];
}

/**
 * POST /api/send-campaign
 * Admin-gated (header x-admin-pass). Body { campaign_id }.
 * Build audience từ subscriptions+profiles, loại unsubscribes, gửi theo batch,
 * log từng recipient, cập nhật campaign status='sent'.
 */
export async function POST(req: Request) {
  const pass = req.headers.get("x-admin-pass");
  if (pass !== ADMIN_PASSWORD) {
    return err("UNAUTHENTICATED", "Sai mã quản trị.");
  }

  const body = (await readJson<Body>(req)) || {};
  const campaignId = body.campaign_id;
  if (campaignId === undefined || campaignId === null || campaignId === "") {
    return err("BAD_REQUEST", "Thiếu campaign_id.");
  }

  const db = supabaseAdmin();

  // Load campaign.
  const { data: campaign, error: cErr } = await db
    .from("email_campaigns")
    .select("id, subject, body_html, audience, status")
    .eq("id", campaignId)
    .maybeSingle();
  if (cErr || !campaign) {
    return err("NOT_FOUND", "Không tìm thấy chiến dịch.");
  }

  const audience = (campaign.audience || "all") as Audience;

  // Lấy email + tên từ profiles (join với auth users qua admin để có email).
  const ids = await userIdsForAudience(db, audience);

  // profiles: id, full_name. Email lấy từ auth.users qua admin.listUsers — nhưng
  // với segment cụ thể ta đã có user_id; lấy email qua getUserById theo từng id
  // tốn request → thay vào đó đọc cột email nếu profiles có; fallback admin API.
  const recipients: Recipient[] = [];
  const seen = new Set<string>();

  // Lấy profiles (full_name) cho các id (hoặc tất cả nếu 'all').
  let profQ = db.from("profiles").select("id, full_name");
  if (ids !== null) {
    if (ids.length === 0) {
      // Không có ai trong segment.
      await db
        .from("email_campaigns")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", campaign.id);
      return ok({ sent: 0, failed: 0 });
    }
    profQ = profQ.in("id", ids);
  }
  const { data: profiles } = await profQ;
  const nameById = new Map<string, string>();
  const profileIds: string[] = [];
  for (const p of profiles || []) {
    profileIds.push(p.id as string);
    nameById.set(p.id as string, (p.full_name as string) || "anh/chị");
  }

  // Email cho từng id qua admin auth API.
  for (const id of profileIds) {
    try {
      const { data } = await db.auth.admin.getUserById(id);
      const email = data?.user?.email;
      if (email && !seen.has(email.toLowerCase())) {
        seen.add(email.toLowerCase());
        recipients.push({ email, name: nameById.get(id) || "anh/chị" });
      }
    } catch {
      // bỏ qua user không lấy được email
    }
  }

  // Loại unsubscribes.
  const { data: unsubs } = await db.from("email_unsubscribes").select("email");
  const blocked = new Set(
    (unsubs || []).map((u) => (u.email as string).toLowerCase())
  );
  const finalList = recipients.filter((r) => !blocked.has(r.email.toLowerCase()));

  // Gửi theo batch (sequential).
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < finalList.length; i += BATCH_SIZE) {
    const batch = finalList.slice(i, i + BATCH_SIZE);
    for (const r of batch) {
      let html: string;
      try {
        html = await renderTemplate("campaign-base", {
          name: r.name,
          body: campaign.body_html || "",
          unsubscribe_url: unsubscribeUrl(r.email),
        });
      } catch (e) {
        failed++;
        await logEmail(
          "campaign",
          r.email,
          "failed",
          e instanceof Error ? e.message : String(e),
          campaign.id
        );
        continue;
      }
      const res = await sendEmail({
        to: r.email,
        subject: campaign.subject || "Thông tin từ Revit Add-in License",
        html,
      });
      if (res.ok) sent++;
      else failed++;
      await logEmail(
        "campaign",
        r.email,
        res.ok ? "sent" : "failed",
        res.error,
        campaign.id
      );
    }
  }

  await db
    .from("email_campaigns")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", campaign.id);

  return ok({ sent, failed });
}
