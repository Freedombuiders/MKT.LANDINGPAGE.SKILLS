// lib/supabase-admin.ts
//
// Admin Supabase client với service_role JWT.
// Bypass Row-Level Security (RLS) → backend đọc/ghi tất cả bảng.
// CHỈ dùng server-side. KHÔNG import file này từ client component / page.tsx
// (sẽ leak service_role qua bundle → ai cũng có god-mode access DB).
//
// Env vars (đặt trong .env.local + Vercel project env):
//   SUPABASE_URL                  = https://xxxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY     = eyJhbGciOiJIUzI1NiI... (JWT, role: service_role)

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars. ' +
        'Check .env.local (local) hoặc Vercel project Environment Variables (prod).',
    );
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
  });
  return cached;
}
