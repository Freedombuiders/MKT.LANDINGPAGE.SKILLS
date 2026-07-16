"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * Trang đặt lại mật khẩu.
 * - Nếu mở từ link recovery trong email: Supabase tự xử lý hash URL → có session recovery.
 *   Khi đó hiển thị form đặt mật khẩu mới (updateUser).
 * - Nếu mở trực tiếp không có session: hiển thị form gửi lại link qua email (resetPasswordForEmail).
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"checking" | "request" | "update">("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    // Khi tới từ link recovery, Supabase phát event PASSWORD_RECOVERY và tạo session.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setMode("update");
      }
    });

    // Kiểm tra session hiện có (trường hợp hash đã được xử lý trước khi listener gắn).
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setMode((m) => (m === "update" ? m : data.session ? "update" : "request"));
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    setLoading(false);
    if (error) {
      setError("Không gửi được email. Anh/chị kiểm tra lại địa chỉ email.");
      return;
    }
    setInfo("Đã gửi liên kết đặt lại mật khẩu. Anh/chị vui lòng kiểm tra hộp thư.");
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (password.length < 6) {
      setError("Mật khẩu cần tối thiểu 6 ký tự.");
      return;
    }
    if (password !== confirm) {
      setError("Mật khẩu nhập lại không khớp.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError("Không đổi được mật khẩu. Liên kết có thể đã hết hạn, anh/chị thử gửi lại.");
      return;
    }
    setInfo("Đổi mật khẩu thành công! Đang chuyển đến trang đăng nhập...");
    setTimeout(() => router.replace("/login"), 1600);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link href="/" className="flex items-center gap-2 font-bold text-ink">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            R
          </span>
          <span>Revit License</span>
        </Link>

        <h1 className="mt-6 text-2xl font-bold">Đặt lại mật khẩu</h1>

        {error && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {info && (
          <div className="mt-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {info}
          </div>
        )}

        {mode === "checking" && (
          <p className="mt-6 text-sm text-muted">Đang kiểm tra liên kết...</p>
        )}

        {mode === "request" && (
          <form onSubmit={handleRequest} className="mt-6 space-y-4">
            <p className="text-sm text-muted">
              Nhập email tài khoản, hệ thống sẽ gửi liên kết đặt lại mật khẩu.
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                placeholder="email@congty.vn"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {loading ? "Đang gửi..." : "Gửi liên kết đặt lại"}
            </button>
          </form>
        )}

        {mode === "update" && (
          <form onSubmit={handleUpdate} className="mt-6 space-y-4">
            <p className="text-sm text-muted">Nhập mật khẩu mới cho tài khoản của anh/chị.</p>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="password">
                Mật khẩu mới
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                placeholder="Tối thiểu 6 ký tự"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="confirm">
                Nhập lại mật khẩu
              </label>
              <input
                id="confirm"
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {loading ? "Đang lưu..." : "Đổi mật khẩu"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-muted">
          <Link href="/login" className="font-semibold text-brand-600 hover:underline">
            Quay lại đăng nhập
          </Link>
        </p>
      </div>
    </main>
  );
}
