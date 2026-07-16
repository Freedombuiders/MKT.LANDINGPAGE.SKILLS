// lib/leads-supabase.ts
//
// Supabase (Postgres) lead store cho Sepay payment flow.
// Mirror API surface với lib/leads-kv.ts — provider-agnostic via lib/leads-store.ts.
//
// Schema (xem templates/supabase-migration.sql):
//   leads(order_id PK, name, phone, email, product_name, amount, status, created_at,
//         paid_at?, payment_record?, expire_at)
//   phone_index(phone PK, order_id FK)
//   order_counter(id=1, current_value) — singleton row + next_order_id() function
//   webhook_dedup(sepay_id PK, processed_at, expire_at)
//
// TTL cleanup qua pg_cron job daily 03:00 UTC (10:00 VN).
// RLS enabled — chỉ service_role bypass.

import { getSupabaseAdmin } from './supabase-admin';

const TTL_PENDING_DAYS = 7;
const TTL_PAID_DAYS = 90;
const TTL_DEDUP_DAYS = 7;

export type LeadStatus = 'pending' | 'paid' | 'expired';

export type Lead = {
  orderId: string;          // "DH000123"
  name: string;
  phone: string;            // VN format "0901234567"
  email: string;
  productName: string;
  amount: number;
  status: LeadStatus;
  createdAt: string;        // ISO 8601
  paidAt?: string;
  payment?: PaymentRecord;
};

export type LeadInput = Omit<Lead, 'orderId' | 'status' | 'createdAt' | 'paidAt' | 'payment'> & {
  affCode?: string;          // mã affiliate (nếu khách qua link aff) — biz-affiliate-system
};

export type PaymentRecord = {
  sepayId: number;          // Sepay transaction ID — INTEGER
  referenceCode: string;
  gateway: string;
  amount: number;
  transactionDate: string;
  matchMethod: 'content-orderid' | 'content-phone' | 'amount-timestamp-window';
};

// =============================================================================
// Row ↔ Lead mapping (snake_case DB ↔ camelCase TS)
// =============================================================================

type LeadRow = {
  order_id: string;
  name: string;
  phone: string;
  email: string;
  product_name: string;
  amount: number;
  status: LeadStatus;
  created_at: string;
  paid_at: string | null;
  payment_record: PaymentRecord | null;
  expire_at: string;
  aff_code: string | null;   // biz-affiliate-system
};

function rowToLead(r: LeadRow): Lead {
  return {
    orderId: r.order_id,
    name: r.name,
    phone: r.phone,
    email: r.email,
    productName: r.product_name,
    amount: Number(r.amount),
    status: r.status,
    createdAt: r.created_at,
    paidAt: r.paid_at ?? undefined,
    payment: r.payment_record ?? undefined,
  };
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86400 * 1000).toISOString();
}

// =============================================================================
// CRUD
// =============================================================================

export async function createLead(input: LeadInput): Promise<{ orderId: string; lead: Lead }> {
  const supabase = getSupabaseAdmin();

  // Atomic order ID via Postgres function (avoid race condition when 2 requests
  // hit cùng instant). next_order_id() defined in supabase-migration.sql.
  const { data: idData, error: idErr } = await supabase.rpc('next_order_id');
  if (idErr || !idData) throw new Error(`next_order_id failed: ${idErr?.message}`);
  const orderId: string = idData;

  const expireAt = daysFromNow(TTL_PENDING_DAYS);
  const row: LeadRow = {
    order_id: orderId,
    name: input.name,
    phone: input.phone,
    email: input.email,
    product_name: input.productName,
    amount: input.amount,
    status: 'pending',
    created_at: new Date().toISOString(),
    paid_at: null,
    payment_record: null,
    expire_at: expireAt,
    aff_code: input.affCode ?? null,   // biz-affiliate-system
  };

  const { error: insertErr } = await supabase.from('leads').insert(row);
  if (insertErr) throw new Error(`leads insert failed: ${insertErr.message}`);

  // Secondary index — phone lookup. Upsert vì phone có thể tạo lead lần 2 (override).
  const { error: phoneErr } = await supabase
    .from('phone_index')
    .upsert({ phone: input.phone, order_id: orderId }, { onConflict: 'phone' });
  if (phoneErr) console.warn(`phone_index upsert failed: ${phoneErr.message}`);

  return { orderId, lead: rowToLead(row) };
}

export async function getLeadByOrderId(orderId: string): Promise<Lead | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle();

  if (error) {
    console.error(`getLeadByOrderId(${orderId}) failed:`, error);
    return null;
  }
  return data ? rowToLead(data as LeadRow) : null;
}

export async function getLeadByPhone(phone: string): Promise<Lead | null> {
  const supabase = getSupabaseAdmin();

  // Join phone_index → leads
  const { data, error } = await supabase
    .from('phone_index')
    .select('order_id')
    .eq('phone', phone)
    .maybeSingle();

  if (error || !data) return null;
  return getLeadByOrderId(data.order_id);
}

/**
 * Strategy 3 fallback: tìm pending leads có cùng amount trong window [start, end].
 * Window thường ±30 phút quanh `transactionDate` của Sepay payload.
 *
 * Return chỉ pending leads. Nếu length === 1 → safe match.
 * Nếu length > 1 → ambiguous, webhook handler skip để tránh nhầm khách.
 */
export async function findPendingLeadByAmountAndTime(
  amount: number,
  windowStart: Date,
  windowEnd: Date,
): Promise<Lead[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('amount', amount)
    .eq('status', 'pending')
    .gte('created_at', windowStart.toISOString())
    .lte('created_at', windowEnd.toISOString());

  if (error) {
    console.error('findPendingLeadByAmountAndTime failed:', error);
    return [];
  }
  return (data as LeadRow[]).map(rowToLead);
}

/**
 * Mark lead = paid + persist payment record. Extend expire_at lên 90 ngày.
 */
export async function markLeadPaid(orderId: string, payment: PaymentRecord): Promise<Lead | null> {
  const supabase = getSupabaseAdmin();
  const paidAt = new Date().toISOString();
  const expireAt = daysFromNow(TTL_PAID_DAYS);

  const { data, error } = await supabase
    .from('leads')
    .update({
      status: 'paid',
      paid_at: paidAt,
      payment_record: payment,
      expire_at: expireAt,
    })
    .eq('order_id', orderId)
    .select()
    .maybeSingle();

  if (error) {
    console.error(`markLeadPaid(${orderId}) failed:`, error);
    return null;
  }
  return data ? rowToLead(data as LeadRow) : null;
}

// =============================================================================
// Webhook dedup
// =============================================================================

export async function isTransactionProcessed(sepayId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('webhook_dedup')
    .select('sepay_id')
    .eq('sepay_id', sepayId)
    .maybeSingle();

  if (error) {
    console.error('isTransactionProcessed failed:', error);
    return false;
  }
  return data !== null;
}

export async function markTransactionProcessed(sepayId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const expireAt = daysFromNow(TTL_DEDUP_DAYS);
  const { error } = await supabase
    .from('webhook_dedup')
    .insert({ sepay_id: sepayId, expire_at: expireAt });
  // Conflict on PK (duplicate insert race) → ignore — đã processed = OK
  if (error && !error.message.includes('duplicate')) {
    console.error('markTransactionProcessed failed:', error);
  }
}

// =============================================================================
// Admin queries (dùng bởi biz-admin-leads-dashboard)
// =============================================================================

export type LeadFilter = {
  status?: LeadStatus | 'all';
  search?: string;
  fromDate?: string;
  toDate?: string;
};

export async function listLeads(filter: LeadFilter = {}): Promise<{
  leads: Lead[];
  stats: { totalAll: number; totalPaid: number; totalPending: number; revenue: number };
}> {
  const supabase = getSupabaseAdmin();

  // Full scan for stats — Postgres handles 10K rows trivially
  const { data: allRows, error: allErr } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false });

  if (allErr) throw new Error(`listLeads failed: ${allErr.message}`);
  const all = (allRows as LeadRow[]).map(rowToLead);

  const stats = {
    totalAll: all.length,
    totalPaid: 0,
    totalPending: 0,
    revenue: 0,
  };
  for (const l of all) {
    if (l.status === 'paid') {
      stats.totalPaid++;
      stats.revenue += l.payment?.amount ?? l.amount ?? 0;
    } else if (l.status === 'pending') {
      stats.totalPending++;
    }
  }

  // Filter in-process (consistent with KV version)
  let filtered = all;
  if (filter.status && filter.status !== 'all') {
    filtered = filtered.filter(l => l.status === filter.status);
  }
  if (filter.search) {
    const s = filter.search.toLowerCase().trim();
    filtered = filtered.filter(l =>
      l.name.toLowerCase().includes(s) ||
      l.phone.includes(s) ||
      l.email.toLowerCase().includes(s) ||
      l.orderId.toLowerCase().includes(s),
    );
  }
  if (filter.fromDate) {
    const from = new Date(filter.fromDate).getTime();
    if (Number.isFinite(from)) filtered = filtered.filter(l => new Date(l.createdAt).getTime() >= from);
  }
  if (filter.toDate) {
    const to = new Date(filter.toDate).getTime();
    if (Number.isFinite(to)) filtered = filtered.filter(l => new Date(l.createdAt).getTime() <= to);
  }

  return { leads: filtered, stats };
}
