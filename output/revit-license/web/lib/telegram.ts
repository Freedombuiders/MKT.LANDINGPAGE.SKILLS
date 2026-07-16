/**
 * Thông báo Telegram cho chủ shop khi có đơn thanh toán thành công.
 * No-op nếu thiếu env (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID) — không bao giờ throw.
 */

/** Định dạng số tiền VND charm pricing, ví dụ 2000000 -> "2.000.000đ". */
function formatVnd(amount: number): string {
  const n = Math.round(Number(amount) || 0);
  return n.toLocaleString("vi-VN").replace(/,/g, ".") + "đ";
}

/** Timestamp giờ VN: dd/mm/yyyy HH:mm. */
function vnTimestamp(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
}

/**
 * Gửi 1 tin nhắn tới Telegram. Tự bỏ qua nếu thiếu env, không bao giờ throw
 * (luôn nuốt lỗi để không chặn 200 trả về Sepay).
 */
export async function sendTelegramNotification(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
  } catch {
    // Nuốt lỗi: thông báo Telegram không được phép chặn webhook.
  }
}

/**
 * Tạo nội dung thông báo thanh toán (tiếng Việt) cho chủ shop.
 */
export function formatPaymentMessage(args: {
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
  amount: number;
  planName: string;
}): string {
  const { fullName, phone, email, amount, planName } = args;
  const lines = [
    "Có đơn thanh toán mới",
    "",
    `Khách hàng: ${fullName?.trim() || "(chưa có tên)"}`,
  ];
  if (phone?.trim()) lines.push(`SĐT: ${phone.trim()}`);
  if (email?.trim()) lines.push(`Email: ${email.trim()}`);
  lines.push(`Gói: ${planName}`);
  lines.push(`Số tiền: ${formatVnd(amount)}`);
  lines.push(`Thời gian: ${vnTimestamp()}`);
  return lines.join("\n");
}
