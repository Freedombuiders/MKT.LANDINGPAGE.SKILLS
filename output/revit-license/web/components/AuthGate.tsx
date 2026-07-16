"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/**
 * Bọc các trang cần đăng nhập. Nếu chưa có session Supabase → chuyển về /login.
 * Trong lúc kiểm tra phiên hiển thị trạng thái "đang tải".
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "authed" | "guest">("loading");

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setStatus(data.session ? "authed" : "guest");
    });

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event, session: Session | null) => {
        if (!active) return;
        setStatus(session ? "authed" : "guest");
      }
    );

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (status === "guest") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-muted">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          <span>Đang tải...</span>
        </div>
      </div>
    );
  }

  if (status === "guest") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted">
        Đang chuyển đến trang đăng nhập...
      </div>
    );
  }

  return <>{children}</>;
}
