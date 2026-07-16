import type { SupabaseClient } from "@supabase/supabase-js";

const ALL_DISCIPLINES = ["ARC", "STR", "MEP"];

/**
 * Lấy danh sách bộ môn (product_code) đang active của user qua RPC get_active_disciplines.
 * Fallback: query subscriptions trực tiếp nếu RPC chưa tồn tại.
 */
export async function getActiveDisciplines(
  db: SupabaseClient,
  userId: string
): Promise<string[]> {
  const { data, error } = await db.rpc("get_active_disciplines", { uid: userId });
  if (!error && Array.isArray(data)) {
    return (data as string[]).filter(Boolean);
  }
  // Fallback nếu RPC chưa được tạo (module 01 chưa migrate hàm).
  const { data: subs } = await db
    .from("subscriptions")
    .select("product_code")
    .eq("user_id", userId)
    .eq("status", "active")
    .gt("current_period_end", new Date().toISOString());
  return (subs || []).map((s: { product_code: string }) => s.product_code);
}

/**
 * plan = 'combo' nếu đủ cả 3 bộ môn; ngược lại nối các product_code (vd 'ARC+STR').
 */
export function derivePlan(disciplines: string[]): string {
  const set = new Set(disciplines);
  if (ALL_DISCIPLINES.every((d) => set.has(d))) return "combo";
  return disciplines.slice().sort().join("+");
}
