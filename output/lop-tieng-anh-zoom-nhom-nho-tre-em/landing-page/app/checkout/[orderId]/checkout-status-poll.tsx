"use client";

import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type PaymentStatus = "pending" | "paid" | "expired";

const POLL_INTERVAL_MS = 4_000;

export function CheckoutStatusPoll({ orderId }: { orderId: string }) {
  const [status, setStatus] = useState<PaymentStatus>("pending");

  useEffect(() => {
    if (status !== "pending") return;

    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();

    async function checkStatus() {
      try {
        const response = await fetch(`/api/checkout/${orderId}/status`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.ok) {
          const data = (await response.json()) as { status?: PaymentStatus };
          if (active && (data.status === "paid" || data.status === "expired")) {
            setStatus(data.status);
            return;
          }
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }

      if (active) timer = setTimeout(checkStatus, POLL_INTERVAL_MS);
    }

    void checkStatus();

    return () => {
      active = false;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [orderId, status]);

  if (status === "paid") {
    return (
      <div role="status" aria-live="polite" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center text-emerald-900">
        <CheckCircle2 aria-hidden="true" className="mx-auto size-9 text-emerald-600" />
        <p className="mt-2 text-lg font-bold">Thanh toán thành công</p>
        <p className="mt-1 text-sm">Đơn hàng đã được xác nhận. Đội ngũ sẽ liên hệ với anh/chị.</p>
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center text-amber-900">
        <TriangleAlert aria-hidden="true" className="mx-auto size-8" />
        <p className="mt-2 font-bold">Đơn hàng đã hết hạn</p>
        <Link href="/#dang-ky" className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-amber-900 px-4 py-2 font-bold text-white">Tạo đơn mới</Link>
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite" className="flex items-center justify-center gap-3 rounded-2xl border border-sky-100 bg-sky-wash p-4 text-sm font-semibold text-sky-ink">
      <Loader2 aria-hidden="true" className="size-5 animate-spin text-sky-brand" />
      Đang chờ thanh toán — tự động kiểm tra mỗi 4 giây
    </div>
  );
}
