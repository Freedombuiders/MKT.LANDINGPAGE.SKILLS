import { supabaseAdmin } from "@/lib/supabase-admin";

export type Period = "month" | "year";

/**
 * Cộng thêm 1 chu kỳ (1 tháng hoặc 1 năm) vào một mốc thời gian.
 * Tính bằng Date của JS (giữ đúng ngày trong tháng, tự xử lý năm nhuận).
 */
export function addPeriod(date: Date, period: Period): Date {
  const d = new Date(date.getTime());
  if (period === "year") {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d;
}

/**
 * Gia hạn (cộng dồn) subscription cho 1 bộ môn của 1 user.
 *
 * Quy tắc cộng dồn:
 *   base = max(now, current_period_end hiện tại nếu sub còn)
 *   current_period_end = base + (1 năm nếu period='year' | 1 tháng nếu 'month')
 *
 * Nhờ vậy: mua khi trial/sub còn hạn → KHÔNG mất số ngày còn lại.
 * Idempotency: hàm này chỉ được gọi khi order chuyển pending→paid (webhook chặn
 * webhook trùng trước khi gọi tới đây) nên không cộng đôi.
 */
export async function renewSubscription(
  userId: string,
  productCode: string,
  period: Period
): Promise<void> {
  const db = supabaseAdmin();
  const now = new Date();

  // Đọc sub hiện tại (nếu có) để lấy mốc current_period_end.
  const { data: existing } = await db
    .from("subscriptions")
    .select("current_period_end")
    .eq("user_id", userId)
    .eq("product_code", productCode)
    .maybeSingle();

  let base = now;
  if (existing?.current_period_end) {
    const cur = new Date(existing.current_period_end);
    if (cur.getTime() > now.getTime()) base = cur;
  }

  const periodEnd = addPeriod(base, period);
  const nowIso = now.toISOString();

  const { error } = await db.from("subscriptions").upsert(
    {
      user_id: userId,
      product_code: productCode,
      source: "paid",
      status: "active",
      current_period_end: periodEnd.toISOString(),
      updated_at: nowIso,
    },
    { onConflict: "user_id,product_code" }
  );
  if (error) {
    throw new Error(
      `Không gia hạn được subscription (${productCode}): ${error.message}`
    );
  }
}
