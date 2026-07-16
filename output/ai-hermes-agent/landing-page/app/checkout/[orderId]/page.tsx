// app/checkout/[orderId]/page.tsx — Pattern B (recommended)
//
// Server component fetch lead by orderId, embed VietQR, kèm client polling component.
// QR + bank info text + status polling — mobile-first responsive.

import { notFound } from 'next/navigation';
import { getLeadByOrderId } from '@/lib/leads-store';
import { CheckoutStatusPoll } from './CheckoutStatusPoll';

export default async function CheckoutPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const lead = await getLeadByOrderId(orderId);
  if (!lead) notFound();

  const bank = process.env.SEPAY_BANK_NAME!;
  const accountNumber = process.env.SEPAY_BANK_ACCOUNT_NUMBER!;
  const qrUrl = buildSepayQrUrl({
    accountNumber,
    bank,
    amount: lead.amount,
    content: lead.orderId,
  });

  const amountStr = lead.amount.toLocaleString('vi-VN') + 'đ';

  return (
    <main className="mx-auto min-h-screen max-w-md p-4 sm:p-6">
      <div className="rounded-2xl bg-white p-6 shadow-xl">
        <h1 className="mb-2 text-center text-2xl font-bold text-gray-900">
          Quét QR để thanh toán
        </h1>
        <p className="mb-6 text-center text-sm text-gray-600">
          Mở app ngân hàng → Quét mã QR → Xác nhận
        </p>

        {/* QR */}
        <div className="mb-6 flex justify-center">
          <img
            src={qrUrl}
            alt="VietQR thanh toán"
            width={280}
            height={280}
            className="h-72 w-72 rounded-lg border border-gray-200 shadow-md"
          />
        </div>

        {/* Amount */}
        <div className="mb-4 rounded-lg bg-blue-50 p-4 text-center">
          <div className="text-sm text-blue-700">Số tiền cần chuyển</div>
          <div className="text-3xl font-bold text-blue-900">{amountStr}</div>
        </div>

        {/* Bank details fallback (cho khách không scan được QR) */}
        <div className="mb-6 space-y-2 rounded-lg bg-gray-50 p-4 text-sm">
          <Row label="Ngân hàng" value={bank} />
          <Row label="Số tài khoản" value={accountNumber} copyable />
          <Row label="Số tiền" value={amountStr} copyable />
          <Row label="Nội dung CK" value={lead.orderId} copyable highlight />
        </div>

        <p className="mb-4 text-center text-xs text-gray-500">
          ⚠️ <b>Bắt buộc</b> dán đúng nội dung <code>{lead.orderId}</code> để hệ thống tự xác nhận
        </p>

        {/* Client polling */}
        <CheckoutStatusPoll orderId={lead.orderId} />

        {/* Order summary */}
        <div className="mt-6 border-t border-gray-200 pt-4">
          <div className="text-sm text-gray-600">Đơn hàng:</div>
          <div className="font-medium text-gray-900">{lead.productName}</div>
          <div className="mt-1 text-xs text-gray-500">Mã đơn: {lead.orderId}</div>
        </div>
      </div>
    </main>
  );
}

function Row({
  label, value, copyable, highlight,
}: {
  label: string; value: string; copyable?: boolean; highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-600">{label}:</span>
      <span className={highlight ? 'font-mono font-bold text-blue-700' : 'font-medium text-gray-900'}>
        {value}
      </span>
    </div>
  );
}

function buildSepayQrUrl(opts: {
  accountNumber: string; bank: string; amount: number; content: string;
}): string {
  const params = new URLSearchParams({
    acc: opts.accountNumber,
    bank: opts.bank,
    amount: String(opts.amount),
    des: opts.content,
    template: 'compact',
  });
  return `https://qr.sepay.vn/img?${params.toString()}`;
}
