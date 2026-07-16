"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Charm pricing VND — đồng bộ với giá hiển thị trên trang
const PRODUCT_NAME = "AI Hermes Agent";
const AMOUNT = 499000;

// Checkout route nhận SĐT dạng 10 số bắt đầu 0 — chuẩn hoá +84 -> 0 trước khi gửi
function normalizePhone(raw: string): string {
  const p = raw.trim().replace(/\s+/g, "");
  if (p.startsWith("+84")) return "0" + p.slice(3);
  return p;
}

const PHONE_RE = /^(0|\+84)[0-9]{9}$/;

type Status = "idle" | "loading" | "error";

export default function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Anh/chị vui lòng nhập họ tên.");
      return;
    }
    if (!PHONE_RE.test(phone.trim())) {
      setError("Số điện thoại chưa đúng định dạng (VD: 0901234567).");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError("Email chưa hợp lệ.");
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: normalizePhone(phone),
          email: email.trim(),
          productName: PRODUCT_NAME,
          amount: AMOUNT,
        }),
      });
      if (!res.ok) throw new Error("request failed");
      const data = await res.json();
      // Pattern B — chuyển sang trang checkout hiển thị VietQR + tự xác nhận
      router.push(`/checkout/${data.orderId}`);
    } catch {
      setStatus("error");
      setError("Có lỗi xảy ra, anh/chị thử lại sau ít phút nhé.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-ink mb-1">
          Họ và tên
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nguyễn Văn A"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-ink mb-1">
          Số điện thoại
        </label>
        <input
          id="phone"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="0901234567"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-ink mb-1">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@cuaban.com"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full cursor-pointer rounded-xl bg-cta px-6 py-4 text-lg font-semibold text-white shadow-lg shadow-cta/30 transition-colors duration-200 hover:bg-cta-dark disabled:opacity-60"
      >
        {status === "loading" ? "Đang gửi..." : "Đăng ký giữ chỗ — 499.000đ"}
      </button>
      <p className="text-center text-xs text-muted">
        Bảo mật thông tin · Hoàn tiền trong 7 ngày nếu không hài lòng
      </p>
    </form>
  );
}
