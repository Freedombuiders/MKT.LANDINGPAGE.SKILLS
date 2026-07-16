import { supabaseAdmin } from "@/lib/supabase-admin";
import { getBearer } from "@/lib/auth-user";
import { ok, err } from "@/lib/http";
import { sendExpiryReminderEmail } from "@/lib/mailer";

export const runtime = "nodejs";

const CRON_SECRET = process.env.CRON_SECRET || "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "";
const DAYS = [7, 3, 1];

/** yyyy-mm-dd của (hôm nay + n ngày). */
function dateInDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function planNameFor(productCode: string): string {
  return productCode ? `Gói ${productCode}` : "Giấy phép Revit Add-in";
}

async function run(req: Request) {
  // Verify CRON_SECRET (Bearer).
  const token = getBearer(req);
  if (!CRON_SECRET || token !== CRON_SECRET) {
    return err("UNAUTHENTICATED", "Sai CRON_SECRET.");
  }

  const db = supabaseAdmin();
  const todayDate = new Date().toISOString().slice(0, 10);

  // Dedupe: các email type='expiry' đã gửi hôm nay (theo to_email).
  const sentTodaySet = new Set<string>();
  try {
    const { data: todaysLogs } = await db
      .from("email_logs")
      .select("to_email, sent_at, type")
      .eq("type", "expiry")
      .gte("sent_at", `${todayDate}T00:00:00.000Z`);
    for (const l of todaysLogs || []) {
      if (l.to_email) sentTodaySet.add((l.to_email as string).toLowerCase());
    }
  } catch {
    // nếu không đọc được log, vẫn tiếp tục (dedupe best-effort)
  }

  let sent = 0;

  for (const d of DAYS) {
    const targetDate = dateInDays(d);
    const startIso = `${targetDate}T00:00:00.000Z`;
    const endIso = `${targetDate}T23:59:59.999Z`;

    const { data: subs } = await db
      .from("subscriptions")
      .select("user_id, product_code, current_period_end")
      .eq("status", "active")
      .gte("current_period_end", startIso)
      .lte("current_period_end", endIso);

    for (const s of subs || []) {
      const userId = s.user_id as string;
      const productCode = (s.product_code as string) || "";

      // Lấy email + tên.
      let email: string | null = null;
      let fullName: string | undefined;
      try {
        const { data } = await db.auth.admin.getUserById(userId);
        email = data?.user?.email ?? null;
      } catch {
        email = null;
      }
      if (!email) continue;

      if (sentTodaySet.has(email.toLowerCase())) continue;

      try {
        const { data: prof } = await db
          .from("profiles")
          .select("full_name")
          .eq("id", userId)
          .maybeSingle();
        fullName = (prof?.full_name as string) || undefined;
      } catch {
        fullName = undefined;
      }

      const expiresAt = new Date(s.current_period_end as string)
        .toISOString()
        .slice(0, 10);
      const renewUrl = `${APP_URL}/renew?product=${encodeURIComponent(productCode)}`;

      await sendExpiryReminderEmail({
        to: email,
        fullName,
        planName: planNameFor(productCode),
        expiresAt,
        renewUrl,
        daysLeft: d,
      });

      sentTodaySet.add(email.toLowerCase());
      sent++;
    }
  }

  return ok({ sent });
}

export async function POST(req: Request) {
  return run(req);
}

export async function GET(req: Request) {
  return run(req);
}
