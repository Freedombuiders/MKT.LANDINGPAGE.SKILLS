"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Thanh điều hướng phía trên cho khu vực người dùng đã đăng nhập.
 */
export default function Nav() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Đóng menu mobile khi chuyển trang.
  useEffect(() => {
    const onResize = () => setOpen(false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const links = [
    { href: "/", label: "Trang chủ" },
    { href: "/dashboard", label: "Bảng điều khiển" },
    { href: "/buy", label: "Mua gói" },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold text-ink">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            R
          </span>
          <span>Revit License</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-slate-100 hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="ml-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-ink hover:bg-slate-50"
          >
            Đăng xuất
          </button>
        </nav>

        <button
          className="rounded-lg border border-slate-200 p-2 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Mở menu"
        >
          <span className="block h-0.5 w-5 bg-ink" />
          <span className="mt-1 block h-0.5 w-5 bg-ink" />
          <span className="mt-1 block h-0.5 w-5 bg-ink" />
        </button>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-slate-200 px-4 py-2 md:hidden">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-slate-100 hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="rounded-lg px-3 py-2 text-left text-sm font-medium text-ink hover:bg-slate-50"
          >
            Đăng xuất
          </button>
        </nav>
      )}
    </header>
  );
}
