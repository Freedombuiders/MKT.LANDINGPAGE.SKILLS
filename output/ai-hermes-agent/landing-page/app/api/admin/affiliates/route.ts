// app/api/admin/affiliates/route.ts
//
// Quản trị affiliate — auth bằng header `x-admin-pass` (dùng chung ADMIN_PASSWORD).
//   GET   → { affiliates: [...+stats], commissions: [...], tierRates }
//   POST  → tạo đối tác mới  { name, email, phone?, tier, commissionRate?, note? }
//   PATCH → sửa đối tác  { kind:"affiliate", id, ... }
//           hoặc đổi trạng thái hoa hồng  { kind:"commission", id, status, payoutNote? }

import { checkAdminPass } from "@/lib/admin-auth";
import {
  createAffiliate,
  listAffiliatesWithStats,
  listCommissions,
  updateAffiliate,
  updateCommissionStatus,
  TIER_RATES,
  type AffiliateStatus,
  type AffiliateTier,
  type CommissionStatus,
} from "@/lib/affiliate";

export const dynamic = "force-dynamic";

function unauthorized() {
  return Response.json({ error: "invalid_password" }, { status: 401 });
}

function serverError(scope: string, err: unknown) {
  console.error(`[/api/admin/affiliates ${scope}]`, err);
  return Response.json({ error: "internal_error" }, { status: 500 });
}

// ---------------------------------------------------------------------------
// GET — list đối tác (kèm stats) + toàn bộ hoa hồng
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  if (!checkAdminPass(request.headers.get("x-admin-pass"))) return unauthorized();
  try {
    const [affiliates, commissions] = await Promise.all([
      listAffiliatesWithStats(),
      listCommissions(),
    ]);
    return Response.json({ affiliates, commissions, tierRates: TIER_RATES });
  } catch (err) {
    return serverError("GET", err);
  }
}

// ---------------------------------------------------------------------------
// POST — tạo đối tác
// ---------------------------------------------------------------------------

type CreateBody = {
  name?: string;
  email?: string;
  phone?: string;
  tier?: AffiliateTier;
  commissionRate?: number;
  note?: string;
};

export async function POST(request: Request) {
  if (!checkAdminPass(request.headers.get("x-admin-pass"))) return unauthorized();

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  const email = body.email?.trim() ?? "";
  const tier: AffiliateTier = body.tier === "elite" ? "elite" : "pro";
  if (!name || !email) {
    return Response.json({ error: "missing_required_fields" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "invalid_email" }, { status: 400 });
  }

  try {
    const result = await createAffiliate({
      name,
      email,
      phone: body.phone,
      tier,
      commissionRate:
        typeof body.commissionRate === "number" ? body.commissionRate : undefined,
      note: body.note,
    });
    if (!result.ok) {
      const status = result.error === "email_exists" ? 409 : 500;
      return Response.json({ error: result.error }, { status });
    }
    return Response.json({ ok: true, affiliate: result.affiliate });
  } catch (err) {
    return serverError("POST", err);
  }
}

// ---------------------------------------------------------------------------
// PATCH — sửa đối tác / đổi trạng thái hoa hồng
// ---------------------------------------------------------------------------

type PatchBody = {
  kind?: "affiliate" | "commission";
  id?: string;
  // affiliate
  name?: string;
  phone?: string;
  tier?: AffiliateTier;
  commissionRate?: number;
  status?: AffiliateStatus | CommissionStatus;
  note?: string;
  // commission
  payoutNote?: string;
};

export async function PATCH(request: Request) {
  if (!checkAdminPass(request.headers.get("x-admin-pass"))) return unauthorized();

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.id) {
    return Response.json({ error: "missing_id" }, { status: 400 });
  }

  try {
    if (body.kind === "commission") {
      const status = body.status as CommissionStatus;
      const allowed: CommissionStatus[] = ["pending", "approved", "paid", "rejected"];
      if (!allowed.includes(status)) {
        return Response.json({ error: "invalid_status" }, { status: 400 });
      }
      const commission = await updateCommissionStatus(body.id, status, body.payoutNote);
      if (!commission) return Response.json({ error: "not_found" }, { status: 404 });
      return Response.json({ ok: true, commission });
    }

    // mặc định: kind === "affiliate"
    const affiliate = await updateAffiliate(body.id, {
      name: body.name,
      phone: body.phone,
      tier: body.tier,
      commissionRate: body.commissionRate,
      status: body.status as AffiliateStatus | undefined,
      note: body.note,
    });
    if (!affiliate) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json({ ok: true, affiliate });
  } catch (err) {
    return serverError("PATCH", err);
  }
}
