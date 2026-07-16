import type { Metadata, Viewport } from "next";
import "./globals.css";
import AffiliateTracker from "@/components/AffiliateTracker";

export const metadata: Metadata = {
  title: "AI Hermes Agent — Khoá học xây AI Agent tự động hoá",
  description:
    "Khoá học AI Hermes Agent: học cách xây dựng AI Agent tự động hoá công việc và kinh doanh, từ con số 0 đến hệ thống chạy 24/7.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="antialiased">
        {children}
        <AffiliateTracker />
      </body>
    </html>
  );
}
