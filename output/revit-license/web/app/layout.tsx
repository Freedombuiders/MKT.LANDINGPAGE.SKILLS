import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Revit Add-in License — ARC · STR · MEP",
  description:
    "Hệ thống bản quyền add-in Revit 3 bộ môn: Kiến trúc, Kết cấu, Điện nước. Dùng thử 30 ngày miễn phí.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
