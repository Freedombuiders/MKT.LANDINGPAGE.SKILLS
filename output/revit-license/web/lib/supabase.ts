import { createClient } from "@supabase/supabase-js";

/**
 * Supabase browser client (anon key). An toàn để lộ ra client — RLS bảo vệ dữ liệu.
 * Dùng trong client component để đọc sub/thiết bị của chính user (RLS owner-only).
 */
// Fallback placeholder để build/prerender không crash khi env chưa set.
// Trên Vercel, env thật được inline lúc build (NEXT_PUBLIC_*) nên giá trị này được thay.
const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "public-anon-key-placeholder";

export const supabase = createClient(url, anonKey);
