// app/admin/affiliates/page.tsx
//
// Trang quản trị affiliate — đứng độc lập, dùng chung ADMIN_PASSWORD với /admin.
// 2 phần: Đối tác (thêm/sửa) + Hoa hồng (duyệt → đánh dấu đã trả → từ chối).
// Inline styles để file tự chứa, không phụ thuộc Tailwind/CSS ngoài.

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";

// =============================================================================
// Types — khớp response /api/admin/affiliates
// =============================================================================

type Tier = "pro" | "elite";
type AffStatus = "active" | "paused";
type CommissionStatus = "pending" | "approved" | "paid" | "rejected";

type AffiliateStats = {
  clicks: number;
  orders: number;
  revenue: number;
  commissionPending: number;
  commissionApproved: number;
  commissionPaid: number;
  commissionTotal: number;
};

type Affiliate = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  affCode: string;
  tier: Tier;
  commissionRate: number;
  status: AffStatus;
  note: string | null;
  createdAt: string;
  stats: AffiliateStats;
};

type Commission = {
  id: string;
  affiliateId: string;
  affCode: string;
  orderId: string;
  customerName: string | null;
  ticket: string | null;
  orderAmount: number;
  commissionRate: number;
  commissionAmount: number;
  status: CommissionStatus;
  createdAt: string;
  approvedAt: string | null;
  paidAt: string | null;
  payoutNote: string | null;
};

type ApiData = {
  affiliates: Affiliate[];
  commissions: Commission[];
  tierRates: Record<Tier, number>;
};

// =============================================================================
// Helpers
// =============================================================================

function formatVnd(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("vi-VN") + " " + d.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
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
// Root — password gate
// =============================================================================

export default function AdminAffiliatesPage() {
  const [pass, setPass] = useState("");
  const [authed, setAuthed] = useState(false);
  const [input, setInput] = useState("");
  const [err, setErr] = useState("");
  const [checking, setChecking] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setChecking(true);
    setErr("");
    const res = await fetch("/api/admin/affiliates", {
      headers: { "x-admin-pass": input },
    });
    setChecking(false);
    if (res.ok) {
      setPass(input);
      setAuthed(true);
    } else {
      setErr("Mã không đúng. Anh/chị thử lại.");
    }
  };

  if (!authed) {
    return (
      <div style={S.gate}>
        <form onSubmit={submit} style={S.gateCard}>
          <h1 style={S.gateTitle}>Quản trị Affiliate</h1>
          <p style={S.gateSub}>Anh/chị nhập mã quản trị để tiếp tục.</p>
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Mã quản trị"
            style={S.input}
            autoFocus
          />
          {err && <div style={S.errText}>{err}</div>}
          <button type="submit" style={S.primaryBtn} disabled={checking}>
            {checking ? "Đang kiểm tra…" : "Đăng nhập"}
          </button>
        </form>
      </div>
    );
  }

  return <AdminAffiliatesInner pass={pass} />;
}

// =============================================================================
// Authed view
// =============================================================================

function AdminAffiliatesInner({ pass }: { pass: string }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Affiliate | null>(null);
  const [commissionFilter, setCommissionFilter] = useState<CommissionStatus | "all">(
    "all",
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadErr("");
    try {
      const res = await fetch("/api/admin/affiliates", {
        headers: { "x-admin-pass": pass },
      });
      if (!res.ok) throw new Error("load_failed");
      setData((await res.json()) as ApiData);
    } catch {
      setLoadErr("Không tải được dữ liệu. Anh/chị thử tải lại trang.");
    } finally {
      setLoading(false);
    }
  }, [pass]);

  useEffect(() => {
    void load();
  }, [load]);

  const tierRates: Record<Tier, number> = data?.tierRates ?? { pro: 30, elite: 40 };

  const totals = useMemo(() => {
    const affs = data?.affiliates ?? [];
    return {
      affiliates: affs.length,
      active: affs.filter((a) => a.status === "active").length,
      commissionTotal: affs.reduce((s, a) => s + a.stats.commissionTotal, 0),
      commissionUnpaid: affs.reduce(
        (s, a) => s + a.stats.commissionPending + a.stats.commissionApproved,
        0,
      ),
    };
  }, [data]);

  const filteredCommissions = useMemo(() => {
    const all = data?.commissions ?? [];
    return commissionFilter === "all"
      ? all
      : all.filter((c) => c.status === commissionFilter);
  }, [data, commissionFilter]);

  const affNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of data?.affiliates ?? []) m.set(a.id, a.name);
    return m;
  }, [data]);

  const patchCommission = async (
    id: string,
    status: CommissionStatus,
    payoutNote?: string,
  ) => {
    await fetch("/api/admin/affiliates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-pass": pass },
      body: JSON.stringify({ kind: "commission", id, status, payoutNote }),
    });
    await load();
  };

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div>
          <h1 style={S.h1}>Quản trị Affiliate</h1>
          <p style={S.headerSub}>
            Quản lý đối tác, theo dõi doanh thu và chi trả hoa hồng.
          </p>
        </div>
        <a href="/admin" style={S.ghostLink}>
          ← Về trang quản trị chính
        </a>
      </header>

      {loadErr && <div style={S.errBanner}>{loadErr}</div>}

      {/* KPI */}
      <div style={S.kpiRow}>
        <Kpi label="Đối tác" value={String(totals.affiliates)}
          hint={`${totals.active} đang hoạt động`} />
        <Kpi label="Tổng hoa hồng ghi nhận" value={formatVnd(totals.commissionTotal)}
          hint="gồm chờ duyệt + đã duyệt + đã trả" />
        <Kpi label="Hoa hồng chưa chi trả" value={formatVnd(totals.commissionUnpaid)}
          hint="cần xử lý chi trả" accent />
      </div>

      {/* ========================= ĐỐI TÁC ========================= */}
      <section style={S.section}>
        <div style={S.sectionHead}>
          <h2 style={S.h2}>Đối tác</h2>
          <button
            style={S.primaryBtn}
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
          >
            + Thêm đối tác
          </button>
        </div>

        {showForm && (
          <AffiliateForm
            pass={pass}
            tierRates={tierRates}
            editing={editing}
            onClose={() => setShowForm(false)}
            onSaved={async () => {
              setShowForm(false);
              await load();
            }}
          />
        )}

        {loading ? (
          <p style={S.muted}>Đang tải…</p>
        ) : (data?.affiliates.length ?? 0) === 0 ? (
          <p style={S.muted}>Chưa có đối tác nào. Bấm “+ Thêm đối tác” để bắt đầu.</p>
        ) : (
          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead>
                <tr>
                  {["Tên", "Mã aff / Link", "Tier", "Hoa hồng %", "Click", "Đơn",
                    "Doanh thu", "Hoa hồng", "Trạng thái", ""].map((h) => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data!.affiliates.map((a) => (
                  <tr key={a.id} style={S.tr}>
                    <td style={S.td}>
                      <div style={S.strong}>{a.name}</div>
                      <div style={S.subtle}>{a.email}</div>
                    </td>
                    <td style={S.td}>
                      <code style={S.code}>{a.affCode}</code>
                      <CopyLink affCode={a.affCode} />
                    </td>
                    <td style={S.td}>{TIER_LABEL[a.tier]}</td>
                    <td style={S.td}>{a.commissionRate}%</td>
                    <td style={S.td}>{a.stats.clicks}</td>
                    <td style={S.td}>{a.stats.orders}</td>
                    <td style={S.td}>{formatVnd(a.stats.revenue)}</td>
                    <td style={S.td}>
                      <div style={S.strong}>{formatVnd(a.stats.commissionTotal)}</div>
                      <div style={S.subtle}>
                        đã trả {formatVnd(a.stats.commissionPaid)}
                      </div>
                    </td>
                    <td style={S.td}>
                      <span
                        style={{
                          ...S.badge,
                          color: a.status === "active" ? "#15803d" : "#b45309",
                          background: a.status === "active" ? "#dcfce7" : "#fef3c7",
                        }}
                      >
                        {a.status === "active" ? "Hoạt động" : "Tạm dừng"}
                      </span>
                    </td>
                    <td style={S.td}>
                      <button
                        style={S.linkBtn}
                        onClick={() => {
                          setEditing(a);
                          setShowForm(true);
                        }}
                      >
                        Sửa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ========================= HOA HỒNG ========================= */}
      <section style={S.section}>
        <div style={S.sectionHead}>
          <h2 style={S.h2}>Hoa hồng</h2>
          <div style={S.filterRow}>
            {(["all", "pending", "approved", "paid", "rejected"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setCommissionFilter(f)}
                style={{
                  ...S.pill,
                  ...(commissionFilter === f ? S.pillActive : {}),
                }}
              >
                {f === "all" ? "Tất cả" : COMMISSION_LABEL[f]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p style={S.muted}>Đang tải…</p>
        ) : filteredCommissions.length === 0 ? (
          <p style={S.muted}>
            Chưa có hoa hồng nào{commissionFilter !== "all" ? " ở trạng thái này" : ""}.
            Hoa hồng được tạo tự động khi đơn giới thiệu được thanh toán.
          </p>
        ) : (
          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead>
                <tr>
                  {["Ngày", "Đối tác", "Đơn", "Khách", "Giá đơn", "%", "Hoa hồng",
                    "Trạng thái", "Thao tác"].map((h) => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredCommissions.map((c) => (
                  <tr key={c.id} style={S.tr}>
                    <td style={S.td}>{formatDate(c.createdAt)}</td>
                    <td style={S.td}>
                      <div style={S.strong}>{affNameById.get(c.affiliateId) ?? "—"}</div>
                      <div style={S.subtle}>{c.affCode}</div>
                    </td>
                    <td style={S.td}><code style={S.code}>{c.orderId}</code></td>
                    <td style={S.td}>
                      <div>{c.customerName ?? "—"}</div>
                      <div style={S.subtle}>{c.ticket ?? ""}</div>
                    </td>
                    <td style={S.td}>{formatVnd(c.orderAmount)}</td>
                    <td style={S.td}>{c.commissionRate}%</td>
                    <td style={S.td}>
                      <span style={S.strong}>{formatVnd(c.commissionAmount)}</span>
                    </td>
                    <td style={S.td}>
                      <span style={{ ...S.badge, color: COMMISSION_COLOR[c.status],
                        background: "#f1f5f9" }}>
                        {COMMISSION_LABEL[c.status]}
                      </span>
                      {c.payoutNote && <div style={S.subtle}>{c.payoutNote}</div>}
                    </td>
                    <td style={S.td}>
                      <div style={S.actionCol}>
                        {c.status === "pending" && (
                          <button style={S.smallBtn}
                            onClick={() => patchCommission(c.id, "approved")}>
                            Duyệt
                          </button>
                        )}
                        {(c.status === "pending" || c.status === "approved") && (
                          <button
                            style={{ ...S.smallBtn, ...S.smallBtnGreen }}
                            onClick={() => {
                              const note = window.prompt(
                                "Ghi chú chi trả (vd: CK Vietcombank 01/06) — bỏ trống nếu không cần:",
                                "",
                              );
                              if (note === null) return;
                              void patchCommission(c.id, "paid", note);
                            }}
                          >
                            Đánh dấu đã trả
                          </button>
                        )}
                        {c.status !== "rejected" && c.status !== "paid" && (
                          <button
                            style={{ ...S.smallBtn, ...S.smallBtnRed }}
                            onClick={() => {
                              if (window.confirm("Từ chối khoản hoa hồng này?")) {
                                void patchCommission(c.id, "rejected");
                              }
                            }}
                          >
                            Từ chối
                          </button>
                        )}
                        {(c.status === "paid" || c.status === "rejected") && (
                          <button style={S.smallBtn}
                            onClick={() => patchCommission(c.id, "pending")}>
                            Mở lại
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// =============================================================================
// Affiliate create/edit form
// =============================================================================

function AffiliateForm({
  pass,
  tierRates,
  editing,
  onClose,
  onSaved,
}: {
  pass: string;
  tierRates: Record<Tier, number>;
  editing: Affiliate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [email, setEmail] = useState(editing?.email ?? "");
  const [phone, setPhone] = useState(editing?.phone ?? "");
  const [tier, setTier] = useState<Tier>(editing?.tier ?? "pro");
  const [rate, setRate] = useState<string>(
    editing ? String(editing.commissionRate) : String(tierRates.pro),
  );
  const [status, setStatus] = useState<AffStatus>(editing?.status ?? "active");
  const [note, setNote] = useState(editing?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Đổi tier khi TẠO mới → gợi ý rate mặc định của tier.
  const onTierChange = (t: Tier) => {
    setTier(t);
    if (!editing) setRate(String(tierRates[t]));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!name.trim() || !email.trim()) {
      setErr("Anh/chị nhập tên và email.");
      return;
    }
    const rateNum = Number(rate);
    if (!Number.isFinite(rateNum) || rateNum < 0 || rateNum > 100) {
      setErr("Hoa hồng % phải từ 0 đến 100.");
      return;
    }
    setBusy(true);
    try {
      let res: Response;
      if (editing) {
        res = await fetch("/api/admin/affiliates", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-admin-pass": pass },
          body: JSON.stringify({
            kind: "affiliate",
            id: editing.id,
            name,
            phone,
            tier,
            commissionRate: rateNum,
            status,
            note,
          }),
        });
      } else {
        res = await fetch("/api/admin/affiliates", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-admin-pass": pass },
          body: JSON.stringify({
            name,
            email,
            phone,
            tier,
            commissionRate: rateNum,
            note,
          }),
        });
      }
      if (res.ok) {
        onSaved();
        return;
      }
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(
        j.error === "email_exists"
          ? "Email này đã được dùng cho một đối tác khác."
          : j.error === "invalid_email"
            ? "Email không hợp lệ."
            : "Lưu thất bại. Anh/chị thử lại.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} style={S.formCard}>
      <h3 style={S.h3}>{editing ? "Sửa đối tác" : "Thêm đối tác mới"}</h3>
      <div style={S.formGrid}>
        <Field label="Họ tên *">
          <input style={S.input} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email *">
          <input
            style={{ ...S.input, ...(editing ? S.inputDisabled : {}) }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!!editing}
            placeholder="email@vidu.com"
          />
        </Field>
        <Field label="Số điện thoại">
          <input style={S.input} value={phone}
            onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Nhóm (tier)">
          <select style={S.input} value={tier}
            onChange={(e) => onTierChange(e.target.value as Tier)}>
            <option value="pro">Pro — {tierRates.pro}%</option>
            <option value="elite">Elite — {tierRates.elite}%</option>
          </select>
        </Field>
        <Field label="Hoa hồng % (chỉnh riêng được)">
          <input style={S.input} type="number" min={0} max={100} step={1}
            value={rate} onChange={(e) => setRate(e.target.value)} />
        </Field>
        {editing && (
          <Field label="Trạng thái">
            <select style={S.input} value={status}
              onChange={(e) => setStatus(e.target.value as AffStatus)}>
              <option value="active">Hoạt động</option>
              <option value="paused">Tạm dừng</option>
            </select>
          </Field>
        )}
      </div>
      <Field label="Ghi chú">
        <input style={S.input} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {editing && (
        <p style={S.subtle}>
          Email là định danh đăng nhập portal — không đổi được sau khi tạo.
        </p>
      )}
      {err && <div style={S.errText}>{err}</div>}
      <div style={S.formActions}>
        <button type="button" style={S.ghostBtn} onClick={onClose} disabled={busy}>
          Huỷ
        </button>
        <button type="submit" style={S.primaryBtn} disabled={busy}>
          {busy ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Tạo đối tác"}
        </button>
      </div>
    </form>
  );
}

// =============================================================================
// Small components
// =============================================================================

function Kpi({ label, value, hint, accent }: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div style={{ ...S.kpi, ...(accent ? S.kpiAccent : {}) }}>
      <div style={S.kpiLabel}>{label}</div>
      <div style={S.kpiValue}>{value}</div>
      {hint && <div style={S.kpiHint}>{hint}</div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={S.field}>
      <span style={S.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

function CopyLink({ affCode }: { affCode: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    void navigator.clipboard.writeText(`${origin}/?aff=${affCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button style={S.linkBtn} onClick={copy} title="Sao chép link giới thiệu">
      {copied ? "✓ Đã chép link" : "Chép link"}
    </button>
  );
}

// =============================================================================
// Styles
// =============================================================================

const S: Record<string, CSSProperties> = {
  gate: {
    minHeight: "100vh", display: "flex", alignItems: "center",
    justifyContent: "center", background: "#0f172a", padding: 20,
  },
  gateCard: {
    background: "#fff", borderRadius: 16, padding: 32, width: "100%",
    maxWidth: 380, display: "flex", flexDirection: "column", gap: 12,
  },
  gateTitle: { margin: 0, fontSize: 20, fontWeight: 800, color: "#0f172a" },
  gateSub: { margin: 0, fontSize: 14, color: "#64748b" },

  page: {
    minHeight: "100vh", background: "#f1f5f9", color: "#0f172a",
    padding: "24px clamp(12px, 4vw, 40px)", maxWidth: 1180, margin: "0 auto",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
    flexWrap: "wrap", gap: 12, marginBottom: 20,
  },
  h1: { margin: 0, fontSize: 24, fontWeight: 800 },
  headerSub: { margin: "4px 0 0", fontSize: 14, color: "#64748b" },
  ghostLink: { fontSize: 13, color: "#4f46e5", textDecoration: "none" },

  kpiRow: {
    display: "grid", gap: 14, marginBottom: 24,
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  },
  kpi: {
    background: "#fff", borderRadius: 14, padding: 18,
    border: "1px solid #e2e8f0",
  },
  kpiAccent: { background: "#eef2ff", border: "1px solid #c7d2fe" },
  kpiLabel: { fontSize: 13, color: "#64748b", fontWeight: 600 },
  kpiValue: { fontSize: 24, fontWeight: 800, margin: "6px 0 2px" },
  kpiHint: { fontSize: 12, color: "#94a3b8" },

  section: {
    background: "#fff", borderRadius: 16, padding: "18px clamp(12px, 3vw, 24px)",
    border: "1px solid #e2e8f0", marginBottom: 22,
  },
  sectionHead: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    flexWrap: "wrap", gap: 12, marginBottom: 14,
  },
  h2: { margin: 0, fontSize: 18, fontWeight: 800 },
  h3: { margin: "0 0 12px", fontSize: 16, fontWeight: 700 },

  tableWrap: { overflowX: "auto", WebkitOverflowScrolling: "touch" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 720 },
  th: {
    textAlign: "left", padding: "8px 10px", color: "#64748b",
    fontWeight: 700, borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap",
  },
  tr: { borderBottom: "1px solid #f1f5f9" },
  td: { padding: "10px", verticalAlign: "top" },
  strong: { fontWeight: 700 },
  subtle: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  code: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    background: "#f1f5f9", padding: "2px 6px", borderRadius: 5, fontSize: 12,
  },

  badge: {
    display: "inline-block", padding: "2px 8px", borderRadius: 999,
    fontSize: 11, fontWeight: 700,
  },

  filterRow: { display: "flex", gap: 6, flexWrap: "wrap" },
  pill: {
    border: "1px solid #e2e8f0", background: "#fff", color: "#475569",
    borderRadius: 999, padding: "5px 12px", fontSize: 12, cursor: "pointer",
  },
  pillActive: { background: "#4f46e5", color: "#fff", borderColor: "#4f46e5" },

  actionCol: { display: "flex", flexDirection: "column", gap: 4 },

  formCard: {
    background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12,
    padding: 18, marginBottom: 16,
  },
  formGrid: {
    display: "grid", gap: 12,
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  },
  field: { display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontWeight: 600, color: "#475569" },
  formActions: { display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 },

  input: {
    border: "1px solid #cbd5e1", borderRadius: 8, padding: "9px 11px",
    fontSize: 14, width: "100%", boxSizing: "border-box", background: "#fff",
    color: "#0f172a",
  },
  inputDisabled: { background: "#f1f5f9", color: "#94a3b8" },

  primaryBtn: {
    background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8,
    padding: "9px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer",
  },
  ghostBtn: {
    background: "#fff", color: "#475569", border: "1px solid #cbd5e1",
    borderRadius: 8, padding: "9px 16px", fontSize: 14, fontWeight: 600,
    cursor: "pointer",
  },
  linkBtn: {
    background: "none", border: "none", color: "#4f46e5", cursor: "pointer",
    fontSize: 12, fontWeight: 600, padding: "2px 4px", marginLeft: 4,
  },
  smallBtn: {
    background: "#fff", border: "1px solid #cbd5e1", borderRadius: 6,
    padding: "4px 9px", fontSize: 12, fontWeight: 600, cursor: "pointer",
    color: "#1d4ed8", whiteSpace: "nowrap",
  },
  smallBtnGreen: { color: "#15803d", borderColor: "#86efac" },
  smallBtnRed: { color: "#b91c1c", borderColor: "#fecaca" },

  muted: { color: "#94a3b8", fontSize: 14, padding: "10px 0" },
  errText: { color: "#b91c1c", fontSize: 13, fontWeight: 600 },
  errBanner: {
    background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca",
    borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 16,
  },
};
