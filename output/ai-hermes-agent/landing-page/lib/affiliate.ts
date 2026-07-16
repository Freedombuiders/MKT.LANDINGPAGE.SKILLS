// lib/affiliate.ts
//
// Hệ thống affiliate 1 tầng — store Supabase + tính hoa hồng.
// Dùng service_role client (bypass RLS) — chỉ chạy server-side.
//
// 3 bảng: affiliates / affiliate_clicks / affiliate_commissions (xem migration).
// Vòng đời hoa hồng: pending → approved → paid  (hoặc → rejected).

import { getSupabaseAdmin } from "./supabase-admin";

// =============================================================================
// Config — chỉnh tier rate ở đây nếu cần
// =============================================================================

export type AffiliateTier = "pro" | "elite";

/** % hoa hồng mặc định theo tier. Mỗi đối tác có thể được chỉnh rate riêng. */
export const TIER_RATES: Record<AffiliateTier, number> = {
  pro: 30,
  elite: 40,
};

export const TIER_LABELS: Record<AffiliateTier, string> = {
  pro: "Pro",
  elite: "Elite",
};

// Alphabet sinh aff_code — bỏ ký tự dễ nhầm (0/O, 1/I/L).
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

// =============================================================================
// Types
// =============================================================================

export type AffiliateStatus = "active" | "paused";
export type CommissionStatus = "pending" | "approved" | "paid" | "rejected";

export type Affiliate = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  affCode: string;
  tier: AffiliateTier;
  commissionRate: number;
  status: AffiliateStatus;
  note: string | null;
  createdAt: string;
};

export type Commission = {
  id: string;
  affiliateId: string;
  affCode: string;
  orderId: string;
  customerName: string | null;
  ticket: string | null;
  orderAmount: number;
  commissionRate: number;
  commissionAmount: number;
  status: CommissionStatus;
  createdAt: string;
  approvedAt: string | null;
  paidAt: string | null;
  payoutNote: string | null;
};

export type AffiliateStats = {
  clicks: number;
  orders: number;
  revenue: number;          // tổng giá trị đơn giới thiệu
  commissionPending: number;
  commissionApproved: number;
  commissionPaid: number;
  commissionTotal: number;  // pending + approved + paid (KHÔNG gồm rejected)
};

type AffiliateRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  aff_code: string;
  tier: AffiliateTier;
  commission_rate: number;
  status: AffiliateStatus;
  note: string | null;
  created_at: string;
};

type CommissionRow = {
  id: string;
  affiliate_id: string;
  aff_code: string;
  order_id: string;
  customer_name: string | null;
  ticket: string | null;
  order_amount: number;
  commission_rate: number;
  commission_amount: number;
  status: CommissionStatus;
  created_at: string;
  approved_at: string | null;
  paid_at: string | null;
  payout_note: string | null;
};

function rowToAffiliate(r: AffiliateRow): Affiliate {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    affCode: r.aff_code,
    tier: r.tier,
    commissionRate: Number(r.commission_rate),
    status: r.status,
    note: r.note,
    createdAt: r.created_at,
  };
}

function rowToCommission(r: CommissionRow): Commission {
  return {
    id: r.id,
    affiliateId: r.affiliate_id,
    affCode: r.aff_code,
    orderId: r.order_id,
    customerName: r.customer_name,
    ticket: r.ticket,
    orderAmount: Number(r.order_amount),
    commissionRate: Number(r.commission_rate),
    commissionAmount: Number(r.commission_amount),
    status: r.status,
    createdAt: r.created_at,
    approvedAt: r.approved_at,
    paidAt: r.paid_at,
    payoutNote: r.payout_note,
  };
}

// =============================================================================
// Helpers
// =============================================================================

/** Bỏ dấu tiếng Việt + chỉ giữ A-Z. "Nguyễn Linh" → "NGUYENLINH". */
function asciiUpper(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // bỏ dấu thanh tổ hợp
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

function randomCodePart(len: number): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

/** Sinh aff_code: 3 chữ đầu từ tên (đã bỏ dấu) + 4 ký tự ngẫu nhiên. */
export function genAffCode(name: string): string {
  const prefix = (asciiUpper(name).slice(0, 3) || "AFF").padEnd(3, "X");
  return prefix + randomCodePart(4);
}

/** Chuẩn hoá aff_code từ link/cookie: HOA, bỏ khoảng trắng, chỉ giữ chữ-số. */
export function normalizeAffCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32);
}

// =============================================================================
// Affiliates — CRUD
// =============================================================================

export type CreateAffiliateInput = {
  name: string;
  email: string;
  phone?: string;
  tier: AffiliateTier;
  commissionRate?: number;   // mặc định = TIER_RATES[tier]
  note?: string;
};

export type CreateAffiliateResult =
  | { ok: true; affiliate: Affiliate }
  | { ok: false; error: "email_exists" | "internal_error" };

/** Tạo đối tác mới. Tự sinh aff_code, retry khi trùng. */
export async function createAffiliate(
  input: CreateAffiliateInput,
): Promise<CreateAffiliateResult> {
  const supabase = getSupabaseAdmin();
  const email = input.email.trim().toLowerCase();

  // Email phải duy nhất — check trước cho thông báo rõ ràng.
  // email đã lowercase, aff_code/email lưu chuẩn hoá → dùng eq (khớp chính xác).
  const { data: existing } = await supabase
    .from("affiliates")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) return { ok: false, error: "email_exists" };

  const rate = input.commissionRate ?? TIER_RATES[input.tier];

  for (let attempt = 0; attempt < 6; attempt++) {
    const affCode = genAffCode(input.name);
    const { data, error } = await supabase
      .from("affiliates")
      .insert({
        name: input.name.trim(),
        email,
        phone: input.phone?.trim() || null,
        aff_code: affCode,
        tier: input.tier,
        commission_rate: rate,
        status: "active",
        note: input.note?.trim() || null,
      })
      .select()
      .maybeSingle();

    if (!error && data) return { ok: true, affiliate: rowToAffiliate(data as AffiliateRow) };
    if (error?.code === "23505") {
      // Trùng — nếu là email (race hiếm) thì báo, còn lại coi là trùng aff_code → retry.
      if (error.message?.toLowerCase().includes("email")) {
        return { ok: false, error: "email_exists" };
      }
      continue;
    }
    console.error("createAffiliate failed:", error?.message);
    return { ok: false, error: "internal_error" };
  }
  console.error("createAffiliate: aff_code collision retries exhausted");
  return { ok: false, error: "internal_error" };
}

export type UpdateAffiliateInput = {
  name?: string;
  phone?: string;
  tier?: AffiliateTier;
  commissionRate?: number;
  status?: AffiliateStatus;
  note?: string;
};

/** Cập nhật đối tác. Đổi tier KHÔNG tự đổi rate — admin chỉnh rate riêng nếu muốn. */
export async function updateAffiliate(
  id: string,
  patch: UpdateAffiliateInput,
): Promise<Affiliate | null> {
  const supabase = getSupabaseAdmin();
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name.trim();
  if (patch.phone !== undefined) row.phone = patch.phone.trim() || null;
  if (patch.tier !== undefined) row.tier = patch.tier;
  if (patch.commissionRate !== undefined) row.commission_rate = patch.commissionRate;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.note !== undefined) row.note = patch.note.trim() || null;
  if (Object.keys(row).length === 0) return getAffiliateById(id);

  const { data, error } = await supabase
    .from("affiliates")
    .update(row)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) {
    console.error(`updateAffiliate(${id}) failed:`, error.message);
    return null;
  }
  return data ? rowToAffiliate(data as AffiliateRow) : null;
}

export async function getAffiliateById(id: string): Promise<Affiliate | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("affiliates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return null;
  return data ? rowToAffiliate(data as AffiliateRow) : null;
}

/**
 * Xác thực đăng nhập portal: cặp aff_code + email phải khớp cùng 1 đối tác active.
 * aff_code công khai trên link → email đóng vai "lớp khoá" cơ bản.
 */
export async function verifyAffiliateLogin(
  affCode: string,
  email: string,
): Promise<Affiliate | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("affiliates")
    .select("*")
    .eq("aff_code", normalizeAffCode(affCode))
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  if (error || !data) return null;
  const aff = rowToAffiliate(data as AffiliateRow);
  return aff.status === "active" ? aff : null;
}

// =============================================================================
// Clicks
// =============================================================================

/** Ghi 1 click link aff. Fire-and-forget — lỗi chỉ log, không throw. */
export async function recordClick(input: {
  affCode: string;
  path?: string;
  referrer?: string;
}): Promise<void> {
  const code = normalizeAffCode(input.affCode);
  if (!code) return;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("affiliate_clicks").insert({
    aff_code: code,
    path: input.path?.slice(0, 300) || null,
    referrer: input.referrer?.slice(0, 500) || null,
  });
  if (error) console.error("recordClick failed:", error.message);
}

// =============================================================================
// Commissions
// =============================================================================

/**
 * Tạo bản ghi hoa hồng cho 1 đơn ĐÃ thanh toán.
 * Gọi từ /api/sepay-webhook sau markOrderPaid().
 *
 * Idempotent: order_id UNIQUE → webhook retry insert lần 2 dính 23505 → bỏ qua.
 * Không tìm thấy aff_code / đối tác paused → bỏ qua êm (đơn không có affiliate).
 */
export async function recordCommissionForOrder(orderId: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  // `product_name` là cột snapshot tên sản phẩm/gói trong bảng leads do
  // /biz-setup-sepay-payment tạo (KHÔNG phải `ticket`). Đọc đúng cột này.
  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("order_id, name, product_name, amount, aff_code")
    .eq("order_id", orderId)
    .maybeSingle();
  if (leadErr || !lead) return;

  const affCode = lead.aff_code ? normalizeAffCode(lead.aff_code as string) : "";
  if (!affCode) return; // đơn không qua link aff

  const { data: aff } = await supabase
    .from("affiliates")
    .select("id, aff_code, commission_rate, status")
    .eq("aff_code", affCode)
    .maybeSingle();
  if (!aff || aff.status !== "active") return; // mã sai, hoặc đối tác đã tạm dừng

  const orderAmount = Number(lead.amount) || 0;
  const rate = Number(aff.commission_rate) || 0;
  const commissionAmount = Math.round((orderAmount * rate) / 100);

  const { error } = await supabase.from("affiliate_commissions").insert({
    affiliate_id: aff.id,
    aff_code: aff.aff_code,
    order_id: orderId,
    customer_name: lead.name,
    ticket: lead.product_name, // snapshot tên sản phẩm/gói (cột `ticket` của affiliate_commissions)
    order_amount: orderAmount,
    commission_rate: rate,
    commission_amount: commissionAmount,
    status: "pending",
  });
  // 23505 = order_id đã có hoa hồng → idempotent, im lặng bỏ qua.
  if (error && error.code !== "23505") {
    console.error(`recordCommissionForOrder(${orderId}) failed:`, error.message);
  }
}

export type CommissionFilter = {
  affiliateId?: string;
  status?: CommissionStatus | "all";
};

export async function listCommissions(
  filter: CommissionFilter = {},
): Promise<Commission[]> {
  const supabase = getSupabaseAdmin();
  let q = supabase.from("affiliate_commissions").select("*").order("created_at", {
    ascending: false,
  });
  if (filter.affiliateId) q = q.eq("affiliate_id", filter.affiliateId);
  if (filter.status && filter.status !== "all") q = q.eq("status", filter.status);

  const { data, error } = await q;
  if (error) throw new Error(`listCommissions failed: ${error.message}`);
  return ((data ?? []) as CommissionRow[]).map(rowToCommission);
}

/**
 * Đổi trạng thái hoa hồng. Tự set approved_at / paid_at theo trạng thái mới.
 * payoutNote chỉ áp dụng khi chuyển sang 'paid'.
 */
export async function updateCommissionStatus(
  id: string,
  status: CommissionStatus,
  payoutNote?: string,
): Promise<Commission | null> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const row: Record<string, unknown> = { status };
  if (status === "approved") row.approved_at = now;
  if (status === "paid") {
    row.paid_at = now;
    if (payoutNote !== undefined) row.payout_note = payoutNote.trim() || null;
  }
  if (status === "pending" || status === "rejected") {
    row.approved_at = null;
    row.paid_at = null;
  }

  const { data, error } = await supabase
    .from("affiliate_commissions")
    .update(row)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) {
    console.error(`updateCommissionStatus(${id}) failed:`, error.message);
    return null;
  }
  return data ? rowToCommission(data as CommissionRow) : null;
}

// =============================================================================
// Aggregation — admin list + portal data
// =============================================================================

function emptyStats(): AffiliateStats {
  return {
    clicks: 0,
    orders: 0,
    revenue: 0,
    commissionPending: 0,
    commissionApproved: 0,
    commissionPaid: 0,
    commissionTotal: 0,
  };
}

function applyCommission(stats: AffiliateStats, c: Commission): void {
  if (c.status === "rejected") return;
  stats.orders += 1;
  stats.revenue += c.orderAmount;
  if (c.status === "pending") stats.commissionPending += c.commissionAmount;
  if (c.status === "approved") stats.commissionApproved += c.commissionAmount;
  if (c.status === "paid") stats.commissionPaid += c.commissionAmount;
  stats.commissionTotal += c.commissionAmount;
}

export type AffiliateWithStats = Affiliate & { stats: AffiliateStats };

/** Danh sách đối tác kèm thống kê — dùng cho trang /admin/affiliates. */
export async function listAffiliatesWithStats(): Promise<AffiliateWithStats[]> {
  const supabase = getSupabaseAdmin();

  const [affRes, comRes, clickRes] = await Promise.all([
    supabase.from("affiliates").select("*").order("created_at", { ascending: false }),
    supabase.from("affiliate_commissions").select("*"),
    supabase.from("affiliate_clicks").select("aff_code"),
  ]);
  if (affRes.error) throw new Error(`listAffiliates failed: ${affRes.error.message}`);

  const commissions = ((comRes.data ?? []) as CommissionRow[]).map(rowToCommission);
  const clicks = (clickRes.data ?? []) as Array<{ aff_code: string }>;

  const clicksByCode = new Map<string, number>();
  for (const c of clicks) {
    const code = c.aff_code;
    clicksByCode.set(code, (clicksByCode.get(code) ?? 0) + 1);
  }

  return ((affRes.data ?? []) as AffiliateRow[]).map(rowToAffiliate).map((aff) => {
    const stats = emptyStats();
    stats.clicks = clicksByCode.get(aff.affCode) ?? 0;
    for (const c of commissions) {
      if (c.affiliateId === aff.id) applyCommission(stats, c);
    }
    return { ...aff, stats };
  });
}

export type AffiliatePortalData = {
  affiliate: Affiliate;
  stats: AffiliateStats;
  commissions: Commission[];
};

/** Dữ liệu dashboard cho 1 đối tác — dùng cho portal /affiliate. */
export async function getAffiliatePortalData(
  affiliate: Affiliate,
): Promise<AffiliatePortalData> {
  const supabase = getSupabaseAdmin();

  const [comRes, clickRes] = await Promise.all([
    supabase
      .from("affiliate_commissions")
      .select("*")
      .eq("affiliate_id", affiliate.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("affiliate_clicks")
      .select("id", { count: "exact", head: true })
      .eq("aff_code", affiliate.affCode),
  ]);

  const commissions = ((comRes.data ?? []) as CommissionRow[]).map(rowToCommission);
  const stats = emptyStats();
  stats.clicks = clickRes.count ?? 0;
  for (const c of commissions) applyCommission(stats, c);

  return { affiliate, stats, commissions };
}
