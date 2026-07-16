import { NextResponse } from "next/server";

import {
  claimTransaction,
  findPendingLeadByAmountAndTime,
  getLeadByOrderId,
  getLeadByPhone,
  markLeadPaid,
  type Lead,
  type PaymentRecord,
} from "@/lib/leads-store";
import {
  parseOrderIdFromContent,
  parsePhoneFromContent,
  verifySepayAuth,
  type SepayWebhookPayload,
} from "@/lib/sepay";

type MatchResult = {
  lead: Lead | null;
  method: PaymentRecord["matchMethod"] | "none";
};

function isSepayPayload(value: unknown): value is SepayWebhookPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<SepayWebhookPayload>;
  return (
    Number.isInteger(payload.id) &&
    typeof payload.content === "string" &&
    (payload.transferType === "in" || payload.transferType === "out") &&
    typeof payload.transferAmount === "number" &&
    Number.isFinite(payload.transferAmount) &&
    typeof payload.gateway === "string" &&
    typeof payload.transactionDate === "string" &&
    typeof payload.referenceCode === "string"
  );
}

async function findOrder(payload: SepayWebhookPayload): Promise<MatchResult> {
  const orderId = parseOrderIdFromContent(payload.content);
  if (orderId) {
    const lead = await getLeadByOrderId(orderId);
    if (lead) return { lead, method: "content-orderid" };
  }

  const phone = parsePhoneFromContent(payload.content);
  if (phone) {
    const lead = await getLeadByPhone(phone);
    if (lead) return { lead, method: "content-phone" };
  }

  const transactionTime = new Date(payload.transactionDate.replace(" ", "T") + "+07:00");
  if (Number.isNaN(transactionTime.getTime())) return { lead: null, method: "none" };

  const candidates = await findPendingLeadByAmountAndTime(
    payload.transferAmount,
    new Date(transactionTime.getTime() - 30 * 60 * 1000),
    new Date(transactionTime.getTime() + 30 * 60 * 1000),
  );

  return candidates.length === 1
    ? { lead: candidates[0], method: "amount-timestamp-window" }
    : { lead: null, method: "none" };
}

export async function POST(request: Request) {
  const webhookKey = process.env.SEPAY_WEBHOOK_API_KEY ?? "";
  if (!verifySepayAuth(request.headers.get("authorization"), webhookKey)) {
    console.warn("[sepay-webhook] Invalid authorization");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const rawPayload: unknown = await request.json();
    if (!isSepayPayload(rawPayload)) {
      console.warn("[sepay-webhook] Invalid payload");
      return NextResponse.json({ success: true, status: "invalid_payload" });
    }

    const payload = rawPayload;
    if (payload.transferType !== "in") {
      return NextResponse.json({ success: true, status: "outgoing_skipped" });
    }

    const claimed = await claimTransaction(String(payload.id));
    if (!claimed) {
      return NextResponse.json({ success: true, status: "already_processed" });
    }

    const match = await findOrder(payload);
    if (!match.lead || match.method === "none") {
      console.warn("[sepay-webhook] No matching order", {
        transactionId: payload.id,
        amount: payload.transferAmount,
      });
      return NextResponse.json({ success: true, status: "no_match" });
    }

    if (payload.transferAmount < match.lead.amount) {
      console.warn("[sepay-webhook] Underpayment", {
        orderId: match.lead.orderId,
        expected: match.lead.amount,
        received: payload.transferAmount,
      });
      return NextResponse.json({ success: true, status: "underpayment" });
    }

    const paidLead = await markLeadPaid(match.lead.orderId, {
      sepayId: payload.id,
      referenceCode: payload.referenceCode,
      gateway: payload.gateway,
      amount: payload.transferAmount,
      transactionDate: payload.transactionDate,
      matchMethod: match.method,
    });

    if (!paidLead) throw new Error(`Không thể cập nhật đơn ${match.lead.orderId}`);

    return NextResponse.json({
      success: true,
      orderId: paidLead.orderId,
      matchMethod: match.method,
    });
  } catch (error) {
    console.error("[sepay-webhook] Unhandled error", error);
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
