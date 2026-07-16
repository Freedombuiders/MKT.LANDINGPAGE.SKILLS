import "server-only";

import { getSupabaseAdmin } from "./supabase-admin";

const DAY_MS = 86_400_000;
const PENDING_TTL_DAYS = 7;
const PAID_TTL_DAYS = 90;
const DEDUP_TTL_DAYS = 7;

export type LeadStatus = "pending" | "paid" | "expired";

export type PaymentRecord = {
  sepayId: number;
  referenceCode: string;
  gateway: string;
  amount: number;
  transactionDate: string;
  matchMethod: "content-orderid" | "content-phone" | "amount-timestamp-window";
};

export type Lead = {
  orderId: string;
  name: string;
  phone: string;
  email: string;
  productName: string;
  amount: number;
  status: LeadStatus;
  createdAt: string;
  paidAt?: string;
  payment?: PaymentRecord;
};

export type LeadInput = Pick<Lead, "name" | "phone" | "email" | "productName" | "amount">;

type LeadRow = {
  order_id: string;
  name: string;
  phone: string;
  email: string;
  product_name: string;
  amount: number | string;
  status: LeadStatus;
  created_at: string;
  paid_at: string | null;
  payment_record: PaymentRecord | null;
  expire_at: string;
};

function expiresIn(days: number): string {
  return new Date(Date.now() + days * DAY_MS).toISOString();
}

function rowToLead(row: LeadRow): Lead {
  return {
    orderId: row.order_id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    productName: row.product_name,
    amount: Number(row.amount),
    status: row.status,
    createdAt: row.created_at,
    paidAt: row.paid_at ?? undefined,
    payment: row.payment_record ?? undefined,
  };
}

export async function createLead(input: LeadInput): Promise<{ orderId: string; lead: Lead }> {
  const supabase = getSupabaseAdmin();
  const { data: orderId, error: idError } = await supabase.rpc("next_order_id");

  if (idError || typeof orderId !== "string") {
    throw new Error(`Không thể tạo mã đơn: ${idError?.message ?? "Dữ liệu không hợp lệ"}`);
  }

  const row: LeadRow = {
    order_id: orderId,
    name: input.name,
    phone: input.phone,
    email: input.email,
    product_name: input.productName,
    amount: input.amount,
    status: "pending",
    created_at: new Date().toISOString(),
    paid_at: null,
    payment_record: null,
    expire_at: expiresIn(PENDING_TTL_DAYS),
  };

  const { error: leadError } = await supabase.from("leads").insert(row);
  if (leadError) throw new Error(`Không thể lưu đơn: ${leadError.message}`);

  const { error: phoneError } = await supabase
    .from("phone_index")
    .upsert({ phone: input.phone, order_id: orderId }, { onConflict: "phone" });

  if (phoneError) console.error("[checkout] phone_index upsert failed", phoneError);

  return { orderId, lead: rowToLead(row) };
}

export async function getLeadByOrderId(orderId: string): Promise<Lead | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("leads")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();

  if (error) {
    console.error(`[leads] getLeadByOrderId(${orderId}) failed`, error);
    return null;
  }

  return data ? rowToLead(data as LeadRow) : null;
}

export async function getLeadByPhone(phone: string): Promise<Lead | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("phone_index")
    .select("order_id")
    .eq("phone", phone)
    .maybeSingle();

  if (error || !data) return null;
  return getLeadByOrderId(data.order_id);
}

export async function findPendingLeadByAmountAndTime(
  amount: number,
  windowStart: Date,
  windowEnd: Date,
): Promise<Lead[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("leads")
    .select("*")
    .eq("amount", amount)
    .eq("status", "pending")
    .gte("created_at", windowStart.toISOString())
    .lte("created_at", windowEnd.toISOString());

  if (error) {
    console.error("[leads] amount/time lookup failed", error);
    return [];
  }

  return (data as LeadRow[]).map(rowToLead);
}

export async function markLeadPaid(orderId: string, payment: PaymentRecord): Promise<Lead | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("leads")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      payment_record: payment,
      expire_at: expiresIn(PAID_TTL_DAYS),
    })
    .eq("order_id", orderId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (error) {
    console.error(`[leads] markLeadPaid(${orderId}) failed`, error);
    return null;
  }

  return data ? rowToLead(data as LeadRow) : null;
}

export async function isTransactionProcessed(sepayId: string): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin()
    .from("webhook_dedup")
    .select("sepay_id")
    .eq("sepay_id", sepayId)
    .maybeSingle();

  if (error) throw new Error(`Không thể kiểm tra webhook dedup: ${error.message}`);
  return data !== null;
}

export async function claimTransaction(sepayId: string): Promise<boolean> {
  const { error } = await getSupabaseAdmin().from("webhook_dedup").insert({
    sepay_id: sepayId,
    expire_at: expiresIn(DEDUP_TTL_DAYS),
  });

  if (!error) return true;
  if (error.code === "23505") return false;
  throw new Error(`Không thể lưu webhook dedup: ${error.message}`);
}

export async function markTransactionProcessed(sepayId: string): Promise<void> {
  await claimTransaction(sepayId);
}

export type LeadFilter = {
  status?: LeadStatus | "all";
  search?: string;
  fromDate?: string;
  toDate?: string;
};

export async function listLeads(filter: LeadFilter = {}) {
  const { data, error } = await getSupabaseAdmin()
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Không thể đọc danh sách khách: ${error.message}`);

  const all = (data as LeadRow[]).map(rowToLead);
  const stats = all.reduce(
    (result, lead) => {
      if (lead.status === "paid") {
        result.totalPaid += 1;
        result.revenue += lead.payment?.amount ?? lead.amount;
      } else if (lead.status === "pending") {
        result.totalPending += 1;
      }
      return result;
    },
    { totalAll: all.length, totalPaid: 0, totalPending: 0, revenue: 0 },
  );

  let leads = all;
  if (filter.status && filter.status !== "all") {
    leads = leads.filter((lead) => lead.status === filter.status);
  }
  if (filter.search) {
    const search = filter.search.trim().toLowerCase();
    leads = leads.filter((lead) =>
      [lead.name, lead.phone, lead.email, lead.orderId].some((value) =>
        value.toLowerCase().includes(search),
      ),
    );
  }
  if (filter.fromDate) {
    const from = Date.parse(filter.fromDate);
    if (Number.isFinite(from)) leads = leads.filter((lead) => Date.parse(lead.createdAt) >= from);
  }
  if (filter.toDate) {
    const to = Date.parse(filter.toDate);
    if (Number.isFinite(to)) leads = leads.filter((lead) => Date.parse(lead.createdAt) <= to);
  }

  return { leads, stats };
}
