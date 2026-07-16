import { supabaseAdmin } from "./supabase-admin";

export type AuthedUser = { userId: string; email: string | null };

/**
 * Lấy Bearer token từ Authorization header.
 */
export function getBearer(req: Request): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/**
 * Verify user JWT (Supabase access_token) → trả userId + email.
 * Dùng admin client để getUser(token) (xác thực chữ ký phía Supabase).
 * Trả null nếu token thiếu/không hợp lệ → route tự trả 401 UNAUTHENTICATED.
 */
export async function getAuthedUser(req: Request): Promise<AuthedUser | null> {
  const token = getBearer(req);
  if (!token) return null;
  const { data, error } = await supabaseAdmin().auth.getUser(token);
  if (error || !data?.user) return null;
  return { userId: data.user.id, email: data.user.email ?? null };
}
