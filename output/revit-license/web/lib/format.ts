/**
 * Tiện ích định dạng dùng chung cho web (dashboard, buy, admin).
 * Identifier tiếng Anh; chuỗi hiển thị tiếng Việt.
 */

/** Định dạng tiền VND kiểu '2.000.000đ'. */
export function formatVnd(n: number): string {
  const v = Number.isFinite(n) ? Math.round(n) : 0;
  return v.toLocaleString("vi-VN") + "đ";
}

/**
 * Định dạng ngày kiểu Việt Nam dd/MM/yyyy.
 * Nhận Date | string ISO | number (epoch ms). Trả '—' nếu không hợp lệ.
 */
export function formatDate(d: Date | string | number | null | undefined): string {
  if (d === null || d === undefined || d === "") return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Định dạng ngày giờ dd/MM/yyyy HH:mm (giờ máy). */
export function formatDateTime(d: Date | string | number | null | undefined): string {
  if (d === null || d === undefined || d === "") return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

/** Bản đồ mã bộ môn → tên tiếng Việt. */
export const DISCIPLINE_LABELS: Record<string, string> = {
  ARC: "Kiến trúc",
  STR: "Kết cấu",
  MEP: "Điện nước",
};

/** Tên bộ môn theo mã (fallback giữ nguyên mã nếu không có). */
export function disciplineLabel(code: string | null | undefined): string {
  if (!code) return "—";
  return DISCIPLINE_LABELS[code] ?? code;
}

/** Nhãn tiếng Việt cho trạng thái subscription. */
export function subStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "active":
      return "Đang hiệu lực";
    case "expired":
      return "Hết hạn";
    case "canceled":
      return "Đã huỷ";
    default:
      return status || "—";
  }
}
