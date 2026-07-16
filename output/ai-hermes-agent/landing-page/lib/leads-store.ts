// lib/leads-store.ts
//
// Provider abstraction — re-export từ Supabase impl.
// API routes (/api/checkout, /api/sepay-webhook, /api/admin/leads) import từ
// file này, không biết underlying là KV hay Postgres. Đổi provider sau = sửa
// 1 dòng dưới đây.

export * from './leads-supabase';
