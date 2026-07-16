// app/checkout/[orderId]/CheckoutStatusPoll.tsx — Client component
//
// Poll mỗi 4s status của order qua /api/checkout/[orderId]/status.
// Khi paid → redirect tới /thanks?orderId=X.
// Sử dụng kèm với checkout-page-app-router.tsx (Pattern B).

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const POLL_INTERVAL_MS = 4000;

type Status = 'pending' | 'paid' | 'expired' | 'unknown';

export function CheckoutStatusPoll({ orderId }: { orderId: string }) {
  const [status, setStatus] = useState<Status>('pending');
  const router = useRouter();

  useEffect(() => {
    if (status === 'paid') {
      const t = setTimeout(() => router.push(`/thanks?orderId=${orderId}`), 1500);
      return () => clearTimeout(t);
    }
    if (status === 'expired' || status === 'unknown') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/checkout/${orderId}/status`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === 'paid' || data.status === 'expired') {
          setStatus(data.status);
        }
      } catch {
        // network error — silent retry on next tick
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [orderId, status, router]);

  if (status === 'paid') {
    return (
      <div className="rounded-lg bg-green-50 p-4 text-center">
        <div className="mb-2 text-3xl">✓</div>
        <div className="font-bold text-green-900">Thanh toán thành công!</div>
        <div className="text-sm text-green-700">Đang chuyển trang...</div>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="rounded-lg bg-yellow-50 p-4 text-center text-sm text-yellow-900">
        ⚠️ Đơn hàng đã hết hạn. Vui lòng tạo đơn mới.
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-3 rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
      <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-blue-500" aria-hidden />
      Đang chờ thanh toán... (tự động xác nhận khi tiền vào)
    </div>
  );
}
