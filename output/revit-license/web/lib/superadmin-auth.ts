import { getAuthedUser } from "@/lib/auth-user";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type SuperAdminResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; status: 401 | 403; message: string };

/**
 * Yêu cầu người gọi là SUPER ADMIN:
 *  1. Có Supabase access_token hợp lệ (đã đăng nhập).
 *  2. Email nằm trong allowlist `admin_users` với `is_super = true`.
 * Trả về kết quả phân biệt 401 (chưa đăng nhập) vs 403 (không đủ quyền).
 */
export async function requireSuperAdmin(req: Request): Promise<SuperAdminResult> {
  const user = await getAuthedUser(req);
  if (!user) return { ok: false, status: 401, message: "Anh/chị chưa đăng nhập." };
  if (!user.email)
    return { ok: false, status: 403, message: "Tài khoản không có email hợp lệ." };

  const { data, error } = await supabaseAdmin()
    .from("admin_users")
    .select("email, is_super")
    .eq("email", user.email.toLowerCase())
    .eq("is_super", true)
    .maybeSingle();

  if (error || !data)
    return { ok: false, status: 403, message: "Anh/chị không có quyền super admin." };

  return { ok: true, userId: user.userId, email: user.email };
}

/** Tìm user Supabase theo email (duyệt qua admin listUsers, cap vài trang). */
export async function findUserByEmail(
  email: string
): Promise<{ id: string; email: string; full_name?: string } | null> {
  const db = supabaseAdmin();
  const target = email.toLowerCase().trim();
  const perPage = 1000;
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users?.length) break;
    const found = data.users.find((u) => (u.email || "").toLowerCase() === target);
    if (found) {
      const meta = (found.user_metadata || {}) as Record<string, unknown>;
      return {
        id: found.id,
        email: found.email || target,
        full_name: (meta.full_name as string) || (meta.name as string) || undefined,
      };
    }
    if (data.users.length < perPage) break;
  }
  return null;
}
