"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type AdminCtx = {
  adminFetch: (path: string, init?: RequestInit) => Promise<Response>;
  logout: () => void;
};

const Ctx = createContext<AdminCtx | null>(null);

/** Hook lấy adminFetch trong các trang admin con. */
export function useAdmin(): AdminCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAdmin phải dùng bên trong <AdminGate>.");
  return c;
}

const STORAGE_KEY = "revit_admin_pass";

const ADMIN_LINKS = [
  { href: "/admin", label: "Tổng quan" },
  { href: "/admin/tools", label: "Công cụ" },
  { href: "/admin/errors", label: "Lỗi" },
  { href: "/admin/licenses", label: "Giấy phép" },
  { href: "/admin/campaigns", label: "Chiến dịch" },
];

/**
 * Cổng mật khẩu cho khu vực admin.
 * Lưu mật khẩu trong state + sessionStorage; mọi request gắn header x-admin-pass.
 */
export default function AdminGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [pass, setPass] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const saved =
      typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEY) : null;
    if (saved) setPass(saved);
    setReady(true);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setChecking(true);
    // Kiểm tra mật khẩu bằng 1 lần gọi overview.
    try {
      const res = await fetch("/api/admin/overview", {
        headers: { "x-admin-pass": input },
      });
      if (res.status === 401) {
        setError("Mã đăng nhập không đúng.");
        setChecking(false);
        return;
      }
      sessionStorage.setItem(STORAGE_KEY, input);
      setPass(input);
    } catch {
      setError("Không kết nối được máy chủ. Thử lại sau.");
    } finally {
      setChecking(false);
    }
  }

  const ctx = useMemo<AdminCtx>(
    () => ({
      adminFetch: (path: string, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        if (pass) headers.set("x-admin-pass", pass);
        return fetch(path, { ...init, headers });
      },
      logout: () => {
        sessionStorage.removeItem(STORAGE_KEY);
        setPass(null);
        setInput("");
      },
    }),
    [pass]
  );

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        Đang tải...
      </div>
    );
  }

  if (!pass) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
        >
          <h1 className="text-xl font-bold">Khu vực quản trị</h1>
          <p className="mt-1 text-sm text-muted">Nhập mã đăng nhập để tiếp tục.</p>
          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
            className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            placeholder="Mã đăng nhập"
          />
          <button
            type="submit"
            disabled={checking}
            className="mt-4 w-full rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {checking ? "Đang kiểm tra..." : "Vào quản trị"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <Ctx.Provider value={ctx}>
      <div className="min-h-screen bg-slate-50">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 font-bold">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
                R
              </span>
              <span>Quản trị</span>
            </div>
            <nav className="flex flex-wrap items-center gap-1">
              {ADMIN_LINKS.map((l) => {
                const active =
                  l.href === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={
                      "rounded-lg px-3 py-1.5 text-sm font-medium " +
                      (active
                        ? "bg-brand-50 text-brand-700"
                        : "text-muted hover:bg-slate-100 hover:text-ink")
                    }
                  >
                    {l.label}
                  </Link>
                );
              })}
              <button
                onClick={ctx.logout}
                className="ml-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
              >
                Thoát
              </button>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </div>
    </Ctx.Provider>
  );
}
