import { NextResponse } from "next/server";

import { getLeadByOrderId } from "@/lib/leads-store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  if (!/^DH\d{6,10}$/.test(orderId)) {
    return NextResponse.json({ status: "expired" }, { headers: { "cache-control": "no-store" } });
  }

  const lead = await getLeadByOrderId(orderId);
  return NextResponse.json(
    { status: lead?.status ?? "expired" },
    { headers: { "cache-control": "no-store" } },
  );
}
