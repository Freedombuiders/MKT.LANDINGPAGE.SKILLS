// app/api/checkout/[orderId]/status/route.ts — App Router status endpoint
//
// GET /api/checkout/{orderId}/status → { status: 'pending' | 'paid' | 'expired' }
// Polled by client (CheckoutStatusPoll component) every 4s.

import { NextResponse } from 'next/server';
import { getLeadByOrderId } from '@/lib/leads-store';

export async function GET(_req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const lead = await getLeadByOrderId(orderId);

  if (!lead) {
    return NextResponse.json({ status: 'expired' });
  }

  return NextResponse.json({ status: lead.status });
}
