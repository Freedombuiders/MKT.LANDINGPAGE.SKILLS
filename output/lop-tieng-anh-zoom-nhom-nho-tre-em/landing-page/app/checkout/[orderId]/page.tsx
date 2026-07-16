import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, Building2, CircleDollarSign, FileText, ShieldCheck } from "lucide-react";

import { CheckoutStatusPoll } from "./checkout-status-poll";
import { CopyButton } from "@/components/copy-button";
import { getLeadByOrderId } from "@/lib/leads-store";
import { generateVietQRUrl } from "@/lib/sepay";

export const dynamic = "force-dynamic";

function formatVND(amount: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(amount)}đ`;
}

function DetailRow({
  icon: Icon,
  label,
  value,
  copyable = false,
  highlight = false,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
  copyable?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-wash text-sky-deep">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
          <p className={`mt-0.5 break-all font-semibold ${highlight ? "font-mono text-sky-deep" : "text-slate-950"}`}>{value}</p>
        </div>
      </div>
      {copyable ? <CopyButton label={label} value={value} /> : null}
    </div>
  );
}

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  if (!/^DH\d{6,10}$/.test(orderId)) notFound();

  const lead = await getLeadByOrderId(orderId);
  if (!lead) notFound();

  const bank = process.env.SEPAY_BANK_NAME?.trim();
  const accountNumber = process.env.SEPAY_BANK_ACCOUNT_NUMBER?.trim();
  const accountName = process.env.SEPAY_ACCOUNT_NAME?.trim();
  if (!bank || !accountNumber || !accountName) notFound();

  const paymentContent = `SEVQR TKPCOD ${lead.orderId}`;
  const amountLabel = formatVND(lead.amount);
  const qrUrl = generateVietQRUrl({
    accountNumber,
    bank,
    amount: lead.amount,
    content: paymentContent,
    template: "compact",
  });

  return (
    <main className="min-h-screen bg-sky-wash px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <Link href="/#dang-ky" className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 font-bold text-sky-ink transition-colors hover:bg-white">
          <ArrowLeft aria-hidden="true" className="size-5" />
          Quay lại trang khóa học
        </Link>

        <div className="soft-shadow overflow-hidden rounded-[2rem] border border-sky-100 bg-white">
          <div className="bg-sky-deep px-6 py-6 text-center text-white sm:px-10">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-sky-50">
              <BadgeCheck aria-hidden="true" className="size-4" />
              Thanh toán bảo mật qua VietQR
            </div>
            <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Quét QR để hoàn tất đăng ký</h1>
            <p className="mt-2 text-sm text-sky-100">Mở ứng dụng ngân hàng, quét mã và giữ nguyên nội dung chuyển khoản.</p>
          </div>

          <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[0.9fr_1.1fr] lg:p-10">
            <section aria-label="Mã QR thanh toán" className="flex flex-col items-center">
              {lead.amount === 3_000 ? (
                <p className="mb-4 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-orange-dark">Chế độ test 3.000đ</p>
              ) : null}
              <div className="rounded-3xl border border-sky-100 bg-white p-3 shadow-lg shadow-sky-950/10">
                <Image
                  src={qrUrl}
                  alt={`VietQR thanh toán đơn ${lead.orderId}`}
                  width={320}
                  height={420}
                  priority
                  unoptimized
                  className="h-auto w-full max-w-80 rounded-2xl"
                />
              </div>
              <div className="mt-5 w-full max-w-80 rounded-2xl bg-orange-50 p-4 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-orange-dark">Số tiền cần chuyển</p>
                <p className="mt-1 text-4xl font-semibold tracking-tight text-slate-950">{amountLabel}</p>
              </div>
            </section>

            <section aria-label="Thông tin chuyển khoản">
              <h2 className="text-2xl font-semibold text-slate-950">Thông tin chuyển khoản</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Nếu không quét được QR, anh/chị có thể chuyển khoản thủ công theo thông tin dưới đây.</p>

              <div className="mt-5 rounded-2xl border border-slate-200 px-4 sm:px-5">
                <DetailRow icon={Building2} label="Ngân hàng" value={bank} />
                <DetailRow icon={ShieldCheck} label="Chủ tài khoản" value={accountName} />
                <DetailRow icon={FileText} label="Số tài khoản" value={accountNumber} copyable />
                <DetailRow icon={CircleDollarSign} label="Số tiền" value={amountLabel} copyable />
                <DetailRow icon={FileText} label="Nội dung chuyển khoản" value={paymentContent} copyable highlight />
              </div>

              <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-900">
                Nội dung chuyển khoản bắt buộc bắt đầu bằng <span className="font-mono">SEVQR TKPCOD</span> để SePay tự đối soát.
              </p>

              <div className="mt-5">
                <CheckoutStatusPoll orderId={lead.orderId} />
              </div>

              <div className="mt-5 border-t border-slate-200 pt-5 text-sm text-slate-600">
                <p className="font-semibold text-slate-950">{lead.productName}</p>
                <p className="mt-1">Mã đơn: <span className="font-mono font-bold text-sky-deep">{lead.orderId}</span></p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
