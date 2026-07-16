"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Headphones, Loader2, Mail, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";

type SubmitStatus = "idle" | "loading" | "error";

export function LeadForm({ paymentAmount }: { paymentAmount: number }) {
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [message, setMessage] = useState("");
  const router = useRouter();
  const amountLabel = new Intl.NumberFormat("vi-VN").format(paymentAmount);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          phone: formData.get("phone"),
          email: formData.get("email"),
        }),
      });
      const result = (await response.json()) as { error?: string; orderId?: string };

      if (!response.ok || !result.orderId) {
        throw new Error(result.error || "Chưa thể tạo đơn thanh toán lúc này.");
      }

      router.push(`/checkout/${result.orderId}`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Có lỗi xảy ra. Anh/chị vui lòng thử lại.");
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-busy={status === "loading"} className="mt-7 space-y-4">
      <div>
        <label htmlFor="name" className="mb-1.5 block text-sm font-semibold text-slate-800">
          Họ tên phụ huynh
        </label>
        <div className="relative">
          <UserRound aria-hidden="true" className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-sky-deep" />
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            minLength={2}
            placeholder="Nguyễn Văn Anh"
            className="min-h-12 w-full rounded-xl border border-slate-300 bg-white py-3 pl-12 pr-4 text-slate-950 placeholder:text-slate-400 focus:border-sky-brand focus:outline-none focus:ring-4 focus:ring-sky-100"
          />
        </div>
      </div>

      <div>
        <label htmlFor="phone" className="mb-1.5 block text-sm font-semibold text-slate-800">
          Số điện thoại
        </label>
        <div className="relative">
          <Headphones aria-hidden="true" className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-sky-deep" />
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            pattern={"^(0|\\+84)[0-9]{9}$"}
            title="Nhập số điện thoại dạng 0xxxxxxxxx hoặc +84xxxxxxxxx"
            placeholder="0912345678"
            className="min-h-12 w-full rounded-xl border border-slate-300 bg-white py-3 pl-12 pr-4 text-slate-950 placeholder:text-slate-400 focus:border-sky-brand focus:outline-none focus:ring-4 focus:ring-sky-100"
          />
        </div>
      </div>

      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-slate-800">
          Email
        </label>
        <div className="relative">
          <Mail aria-hidden="true" className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-sky-deep" />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="anhchi@email.com"
            className="min-h-12 w-full rounded-xl border border-slate-300 bg-white py-3 pl-12 pr-4 text-slate-950 placeholder:text-slate-400 focus:border-sky-brand focus:outline-none focus:ring-4 focus:ring-sky-100"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={status === "loading"}
        className="inline-flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-orange-cta px-5 py-3.5 text-base font-bold text-white shadow-[0_12px_28px_rgba(249,115,22,0.28)] transition-colors duration-200 hover:bg-orange-dark disabled:cursor-not-allowed disabled:opacity-65"
      >
        {status === "loading" ? (
          <>
            <Loader2 aria-hidden="true" className="size-5 animate-spin" />
            Đang tạo đơn...
          </>
        ) : (
          <>
            Đăng ký & thanh toán {amountLabel}đ
            <ArrowRight aria-hidden="true" className="size-5" />
          </>
        )}
      </button>

      {message ? (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {message}
        </p>
      ) : null}

      <p className="text-center text-xs leading-5 text-slate-500">
        Bấm đăng ký để chuyển sang VietQR. Hệ thống tự xác nhận khi tiền vào.
      </p>
    </form>
  );
}
