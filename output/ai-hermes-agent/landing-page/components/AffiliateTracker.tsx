// components/AffiliateTracker.tsx
//
// Client component mount 1 lần ở layout. Bắt ?aff= (hoặc ?ref=) trên URL:
//   1. ghi cookie `aff_ref` 30 ngày — last-touch, mã mới ghi đè mã cũ
//   2. bắn beacon đếm click sang /api/affiliate/click
//
// /api/register đọc cookie `aff_ref` phía server → không cần đụng form đăng ký.
// Render null — không có UI.

"use client";

import { useEffect } from "react";

const COOKIE_NAME = "aff_ref";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 ngày

/** HOA + chỉ giữ chữ-số — khớp normalizeAffCode() ở lib/affiliate.ts. */
function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32);
}

export default function AffiliateTracker() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get("aff") ?? params.get("ref");
      if (!raw) return;

      const code = normalizeCode(raw);
      if (!code) return;

      // Last-touch: luôn ghi đè cookie bằng mã aff mới nhất.
      document.cookie =
        `${COOKIE_NAME}=${code}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;

      // Đếm click — fire-and-forget, không chặn render.
      const payload = JSON.stringify({
        code,
        path: window.location.pathname,
        referrer: document.referrer || "",
      });
      const url = "/api/affiliate/click";
      if (typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
      } else {
        void fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // Tracking không bao giờ được làm vỡ trang — nuốt mọi lỗi.
    }
  }, []);

  return null;
}
