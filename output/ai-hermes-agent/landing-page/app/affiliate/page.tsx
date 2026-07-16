// app/affiliate/page.tsx
//
// Portal đối tác — đối tác đăng nhập bằng mã aff + email để tự xem:
// link giới thiệu, lượt click, đơn giới thiệu, hoa hồng theo trạng thái.
// Không có session — refresh trang là đăng nhập lại (đơn giản, đủ dùng).

"use client";

import {
  useEffect,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";

// =============================================================================
// Types — khớp response /api/affiliate
// =============================================================================

type Tier = "pro" | "elite";
type CommissionStatus = "pending" | "approved" | "paid" | "rejected";

type Affiliate = {
  id: string;
  name: string;
  email: string;
  affCode: string;
  tier: Tier;
  commissionRate: number;
  status: string;
  createdAt: string;
};

type AffiliateStats = {
  clicks: number;
  orders: number;
  revenue: number;
  commissionPending: number;
  commissionApproved: number;
  commissionPaid: number;
  commissionTotal: number;
};

type Commission = {
  id: string;
  orderId: string;
  customerName: string | null;
  ticket: string | null;
  orderAmount: number;
  commissionRate: number;
  commissionAmount: number;
  status: CommissionStatus;
  createdAt: string;
  paidAt: string | null;
};

type PortalData = {
  affiliate: Affiliate;
  stats: AffiliateStats;
  commissions: Commission[];
};

// =============================================================================
// Helpers
// =============================================================================

function formatVnd(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN");
}

const TIER_LABEL: Record<Tier, string> = { pro: "Pro", elite: "Elite" };

const COMMISSION_LABEL: Record<CommissionStatus, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  paid: "Đã trả",
  rejected: "Từ chối",
};

const COMMISSION_COLOR: Record<CommissionStatus, string> = {
  pending: "#b45309",
  approved: "#1d4ed8",
  paid: "#15803d",
  rejected: "#b91c1c",
};

// =============================================================================
// Root
// =============================================================================

export default function AffiliatePortalPage() {
  const [data, setData] = useState<PortalData | null>(null);

  if (!data) return <LoginView onSuccess={setData} />;
  return <Dashboard data={data} onLogout={() => setData(null)} />;
}

// =============================================================================
// Login
// =============================================================================

function LoginView({ onSuccess }: { onSuccess: (d: PortalData) => void }) {
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // Tiện cho đối tác: nếu mở /affiliate?aff=CODE thì điền sẵn ô mã.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const c = p.get("aff") ?? p.get("code");
    if (c) setCode(c.toUpperCase());
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!code.trim() || !email.trim()) {
      setErr("Anh/chị nhập mã đối tác và email.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/affiliate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), email: email.trim() }),
      });
      if (res.ok) {
        onSuccess((await res.json()) as PortalData);
        return;
      }
      setErr(
        res.status === 401
          ? "Mã đối tác hoặc email không khớp. Anh/chị kiểm tra lại."
          : "Có lỗi xảy ra. Anh/chị thử lại sau.",
      );
    } catch {
      setErr("Không kết nối được. Anh/chị thử lại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={S.loginWrap}>
      <form onSubmit={submit} style={S.loginCard}>
        <h1 style={S.loginTitle}>Cổng đối tác Affiliate</h1>
        <p style={S.loginSub}>
          Anh/chị đăng nhập bằng mã đối tác và email đã đăng ký để xem doanh thu
          và hoa hồng của mình.
        </p>
        <label style={S.field}>
          <span style={S.fieldLabel}>Mã đối tác</span>
          <input
            style={S.input}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="VD: LINH7K2"
            autoFocus
          />
        </label>
        <label style={S.field}>
          <span style={S.fieldLabel}>Email</span>
          <input
            style={S.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@vidu.com"
          />
        </label>
        {err && <div style={S.errText}>{err}</div>}
        <button type="submit" style={S.primaryBtn} disabled={busy}>
          {busy ? "Đang kiểm tra…" : "Đăng nhập"}
        </button>
        <p style={S.loginHelp}>
          Chưa có mã đối tác? Anh/chị liên hệ ban quản trị để được cấp.
        </p>
      </form>
    </div>
  );
}

// =============================================================================
// Dashboard
// =============================================================================

function Dashboard({ data, onLogout }: { data: PortalData; onLogout: () => void }) {
  const { affiliate, stats, commissions } = data;
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const refLink = origin ? `${origin}/?aff=${affiliate.affCode}` : "";

  const copy = () => {
    if (!refLink) return;
    void navigator.clipboard.writeText(refLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div style={S.page}>
      <header style={S.dashHeader}>
        <div>
          <h1 style={S.h1}>Chào anh/chị {affiliate.name} 👋</h1>
          <p style={S.headerSub}>
            Nhóm {TIER_LABEL[affiliate.tier]} · hoa hồng {affiliate.commissionRate}%
            mỗi đơn giới thiệu thành công
          </p>
        </div>
        <button style={S.ghostBtn} onClick={onLogout}>
          Đăng xuất
        </button>
      </header>

      {/* Link giới thiệu */}
      <section style={S.linkCard}>
        <div style={S.linkLabel}>Link giới thiệu của anh/chị</div>
        <div style={S.linkRow}>
          <code style={S.linkValue}>{refLink || `…/?aff=${affiliate.affCode}`}</code>
          <button style={S.primaryBtn} onClick={copy} disabled={!refLink}>
            {copied ? "✓ Đã sao chép" : "Sao chép"}
          </button>
        </div>
        <p style={S.linkHint}>
          Chia sẻ link này. Khách bấm vào link rồi đăng ký + thanh toán trong vòng
          30 ngày sẽ được tính cho anh/chị.
        </p>
      </section>

      {/* KPI */}
      <div style={S.kpiRow}>
        <Kpi label="Lượt click" value={String(stats.clicks)} />
        <Kpi label="Đơn giới thiệu" value={String(stats.orders)} />
        <Kpi label="Doanh thu giới thiệu" value={formatVnd(stats.revenue)} />
        <Kpi label="Tổng hoa hồng" value={formatVnd(stats.commissionTotal)} accent />
        <Kpi label="Đã nhận" value={formatVnd(stats.commissionPaid)} />
        <Kpi
          label="Đang chờ"
          value={formatVnd(stats.commissionPending + stats.commissionApproved)}
        />
      </div>

      {/* Bảng hoa hồng */}
      <section style={S.section}>
        <h2 style={S.h2}>Lịch sử đơn &amp; hoa hồng</h2>
        {commissions.length === 0 ? (
          <p style={S.muted}>
            Chưa có đơn giới thiệu nào. Hãy chia sẻ link để bắt đầu nhận hoa hồng.
          </p>
        ) : (
          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead>
                <tr>
                  {["Ngày", "Mã đơn", "Khách", "Sản phẩm", "Giá đơn", "%",
                    "Hoa hồng", "Trạng thái"].map((h) => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {commissions.map((c) => (
                  <tr key={c.id} style={S.tr}>
                    <td style={S.td}>{formatDate(c.createdAt)}</td>
                    <td style={S.td}><code style={S.code}>{c.orderId}</code></td>
                    <td style={S.td}>{c.customerName ?? "—"}</td>
                    <td style={S.td}>{c.ticket ?? "—"}</td>
                    <td style={S.td}>{formatVnd(c.orderAmount)}</td>
                    <td style={S.td}>{c.commissionRate}%</td>
                    <td style={S.td}>
                      <span style={S.strong}>{formatVnd(c.commissionAmount)}</span>
                    </td>
                    <td style={S.td}>
                      <span style={{ ...S.badge, color: COMMISSION_COLOR[c.status] }}>
                        {COMMISSION_LABEL[c.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={S.legend}>
          <strong>Trạng thái hoa hồng:</strong>{" "}
          <em>Chờ duyệt</em> — đơn đã thanh toán, ban quản trị đang đối soát ·{" "}
          <em>Đã duyệt</em> — đã xác nhận, chờ tới kỳ chi trả ·{" "}
          <em>Đã trả</em> — anh/chị đã nhận tiền ·{" "}
          <em>Từ chối</em> — đơn không hợp lệ (hoàn tiền/huỷ).
        </div>
      </section>
    </div>
  );
}

// =============================================================================
// Small components
// =============================================================================

function Kpi({ label, value, accent }: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div style={{ ...S.kpi, ...(accent ? S.kpiAccent : {}) }}>
      <div style={S.kpiLabel}>{label}</div>
      <div style={S.kpiValue}>{value}</div>
    </div>
  );
}

// =============================================================================
// Styles
// =============================================================================

const S: Record<string, CSSProperties> = {
  loginWrap: {
    minHeight: "100vh", display: "flex", alignItems: "center",
    justifyContent: "center", background: "#0f172a", padding: 20,
  },
  loginCard: {
    background: "#fff", borderRadius: 18, padding: "32px clamp(20px, 5vw, 36px)",
    width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 12,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    color: "#0f172a",
  },
  loginTitle: { margin: 0, fontSize: 22, fontWeight: 800 },
  loginSub: { margin: "0 0 6px", fontSize: 14, color: "#64748b", lineHeight: 1.5 },
  loginHelp: { margin: "8px 0 0", fontSize: 12, color: "#94a3b8", textAlign: "center" },

  page: {
    minHeight: "100vh", background: "#f1f5f9", color: "#0f172a",
    padding: "24px clamp(12px, 4vw, 40px)", maxWidth: 1060, margin: "0 auto",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  },
  dashHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
    flexWrap: "wrap", gap: 12, marginBottom: 18,
  },
  h1: { margin: 0, fontSize: 22, fontWeight: 800 },
  headerSub: { margin: "4px 0 0", fontSize: 14, color: "#64748b" },

  linkCard: {
    background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 14,
    padding: 18, marginBottom: 20,
  },
  linkLabel: { fontSize: 13, fontWeight: 700, color: "#4338ca", marginBottom: 8 },
  linkRow: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
  linkValue: {
    flex: "1 1 240px", background: "#fff", border: "1px solid #c7d2fe",
    borderRadius: 8, padding: "10px 12px", fontSize: 13, wordBreak: "break-all",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  linkHint: { margin: "10px 0 0", fontSize: 12, color: "#6366f1" },

  kpiRow: {
    display: "grid", gap: 12, marginBottom: 22,
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  },
  kpi: {
    background: "#fff", borderRadius: 14, padding: 16, border: "1px solid #e2e8f0",
  },
  kpiAccent: { background: "#ecfdf5", border: "1px solid #a7f3d0" },
  kpiLabel: { fontSize: 12, color: "#64748b", fontWeight: 600 },
  kpiValue: { fontSize: 20, fontWeight: 800, marginTop: 6 },

  section: {
    background: "#fff", borderRadius: 16, padding: "18px clamp(12px, 3vw, 24px)",
    border: "1px solid #e2e8f0", marginBottom: 20,
  },
  h2: { margin: "0 0 14px", fontSize: 18, fontWeight: 800 },

  tableWrap: { overflowX: "auto", WebkitOverflowScrolling: "touch" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 640 },
  th: {
    textAlign: "left", padding: "8px 10px", color: "#64748b", fontWeight: 700,
    borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap",
  },
  tr: { borderBottom: "1px solid #f1f5f9" },
  td: { padding: "10px", verticalAlign: "top" },
  strong: { fontWeight: 700 },
  code: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    background: "#f1f5f9", padding: "2px 6px", borderRadius: 5, fontSize: 12,
  },
  badge: { fontSize: 12, fontWeight: 700 },

  legend: {
    marginTop: 14, fontSize: 12, color: "#64748b", lineHeight: 1.7,
    background: "#f8fafc", borderRadius: 10, padding: "10px 14px",
  },

  field: { display: "flex", flexDirection: "column", gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: 600, color: "#475569" },
  input: {
    border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 12px",
    fontSize: 14, width: "100%", boxSizing: "border-box", background: "#fff",
    color: "#0f172a",
  },

  primaryBtn: {
    background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8,
    padding: "10px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer",
  },
  ghostBtn: {
    background: "#fff", color: "#475569", border: "1px solid #cbd5e1",
    borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600,
    cursor: "pointer",
  },

  muted: { color: "#94a3b8", fontSize: 14, padding: "8px 0" },
  errText: { color: "#b91c1c", fontSize: 13, fontWeight: 600 },
};
