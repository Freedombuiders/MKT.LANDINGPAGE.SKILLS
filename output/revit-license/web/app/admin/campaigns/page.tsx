"use client";

import { useCallback, useEffect, useState } from "react";
import AdminGate, { useAdmin } from "@/components/AdminGate";
import { formatDateTime } from "@/lib/format";

type Campaign = {
  id: string;
  name: string;
  subject: string;
  body_kind: string;
  audience: string;
  status: string;
  created_at: string | null;
  sent_at: string | null;
};
type LogRow = {
  id: number;
  campaign_id: string | null;
  type: string | null;
  to_email: string;
  status: string;
  error: string | null;
  sent_at: string | null;
};

const AUDIENCES = [
  { value: "all", label: "Tất cả người dùng" },
  { value: "trial", label: "Đang dùng thử" },
  { value: "paid", label: "Đã mua" },
  { value: "expired", label: "Đã hết hạn" },
  { value: "expiring_7d", label: "Sắp hết hạn (7 ngày)" },
];

/** Bọc nội dung thành khung email để xem trước (text → auto wrap, html → giữ nguyên). */
function buildPreview(bodyKind: string, body: string): string {
  if (bodyKind === "html") {
    if (/<html[\s>]/i.test(body)) return body;
    return `<!doctype html><html><body style="font-family:system-ui,Arial,sans-serif;color:#0f172a;line-height:1.6;padding:16px">${body}</body></html>`;
  }
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");
  return `<!doctype html><html><body style="font-family:system-ui,Arial,sans-serif;color:#0f172a;line-height:1.6;padding:16px">${escaped}</body></html>`;
}

function CampaignsInner() {
  const { adminFetch } = useAdmin();

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyKind, setBodyKind] = useState<"text" | "html">("text");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("all");

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch("/api/admin/campaigns");
      const j = await res.json();
      if (!j.ok) setError(j.message || "Không tải được chiến dịch.");
      else {
        setCampaigns(j.campaigns || []);
        setLogs(j.logs || []);
      }
    } catch {
      setError("Lỗi mạng.");
    } finally {
      setLoading(false);
    }
  }, [adminFetch]);

  useEffect(() => {
    load();
  }, [load]);

  async function createDraft(): Promise<string | null> {
    const res = await adminFetch("/api/admin/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        subject,
        body_html: body,
        body_kind: bodyKind,
        audience,
      }),
    });
    const j = await res.json();
    if (!j.ok) {
      setError(j.message || "Không tạo được chiến dịch.");
      return null;
    }
    return j.campaign?.id ?? null;
  }

  async function handleSaveDraft(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSaving(true);
    const id = await createDraft();
    setSaving(false);
    if (id) {
      setNotice("Đã lưu bản nháp chiến dịch.");
      setName("");
      setSubject("");
      setBody("");
      await load();
    }
  }

  async function handleSend(campaignId: string) {
    setError(null);
    setNotice(null);
    setSendingId(campaignId);
    try {
      // Route gửi do module email cung cấp.
      const res = await adminFetch("/api/send-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id: campaignId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.ok === false) {
        setError(j.message || "Gửi chiến dịch thất bại.");
      } else {
        setNotice("Đã kích hoạt gửi chiến dịch.");
        await load();
      }
    } catch {
      setError("Lỗi mạng khi gửi.");
    } finally {
      setSendingId(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Chiến dịch email</h1>
      <p className="mt-1 text-sm text-muted">
        Soạn chiến dịch, xem trước email thật, lưu nháp rồi gửi hàng loạt.
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {notice}
        </div>
      )}

      {/* Compose */}
      <form
        onSubmit={handleSaveDraft}
        className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Tên chiến dịch</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              placeholder="Khuyến mãi combo cuối năm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Đối tượng nhận</label>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              {AUDIENCES.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium">Tiêu đề email</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            placeholder="Ưu đãi gói combo năm — tiết kiệm 1.000.000đ"
          />
        </div>

        <div className="mt-4 flex items-center gap-4">
          <span className="text-sm font-medium">Định dạng nội dung:</span>
          <label className="flex items-center gap-1 text-sm">
            <input
              type="radio"
              checked={bodyKind === "text"}
              onChange={() => setBodyKind("text")}
            />
            Văn bản thường
          </label>
          <label className="flex items-center gap-1 text-sm">
            <input
              type="radio"
              checked={bodyKind === "html"}
              onChange={() => setBodyKind("html")}
            />
            HTML
          </label>
        </div>

        <div className="mt-3">
          <label className="mb-1 block text-sm font-medium">
            Nội dung (dùng {"{{name}}"} để chèn tên người nhận)
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            rows={8}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            placeholder={"Xin chào {{name}},\n\nNhân dịp..."}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            disabled={!body.trim()}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
          >
            Xem trước
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? "Đang lưu..." : "Lưu nháp"}
          </button>
        </div>
      </form>

      {/* Campaign list */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Danh sách chiến dịch</h2>
        {loading ? (
          <p className="mt-3 text-muted">Đang tải...</p>
        ) : campaigns.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Chưa có chiến dịch nào.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Tên</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Đối tượng</th>
                  <th className="px-4 py-3 font-medium">Trạng thái</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Tạo lúc</th>
                  <th className="px-4 py-3 text-right font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted">{c.subject}</div>
                    </td>
                    <td className="hidden px-4 py-3 text-muted md:table-cell">{c.audience}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          "rounded-full px-2 py-0.5 text-xs font-medium " +
                          (c.status === "sent"
                            ? "bg-green-50 text-green-700"
                            : c.status === "sending"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-slate-100 text-slate-600")
                        }
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-muted md:table-cell">
                      {formatDateTime(c.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.status === "draft" ? (
                        <button
                          onClick={() => handleSend(c.id)}
                          disabled={sendingId === c.id}
                          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                        >
                          {sendingId === c.id ? "Đang gửi..." : "Gửi"}
                        </button>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Log history */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Nhật ký gửi</h2>
        {logs.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Chưa có nhật ký.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Loại</th>
                  <th className="px-4 py-3 font-medium">Trạng thái</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3">{l.to_email}</td>
                    <td className="px-4 py-3 text-muted">{l.type || "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          "rounded-full px-2 py-0.5 text-xs font-medium " +
                          (l.status === "sent"
                            ? "bg-green-50 text-green-700"
                            : "bg-red-50 text-red-700")
                        }
                      >
                        {l.status === "sent" ? "Thành công" : "Thất bại"}
                      </span>
                      {l.error && <div className="mt-1 text-xs text-red-600">{l.error}</div>}
                    </td>
                    <td className="hidden px-4 py-3 text-muted md:table-cell">
                      {formatDateTime(l.sent_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Preview modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex h-[80vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div>
                <p className="font-semibold">Xem trước email</p>
                <p className="text-xs text-muted">{subject || "(chưa có tiêu đề)"}</p>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>
            <iframe
              title="Xem trước email"
              className="flex-1 rounded-b-2xl"
              srcDoc={buildPreview(bodyKind, body)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminCampaignsPage() {
  return (
    <AdminGate>
      <CampaignsInner />
    </AdminGate>
  );
}
