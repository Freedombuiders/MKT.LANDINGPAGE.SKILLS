"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/lib/supabase";
import { formatVnd, formatDate } from "@/lib/format";

type Kpis = {
  revenue: number;
  customers: number;
  paidCustomers: number;
  activeSubs: number;
  trialUsers: number;
  ordersPaid: number;
};
type Overview = {
  email: string;
  kpis: Kpis;
  salesByDay: { day: string; revenue: number; orders: number }[];
  recent: { order_id: string; email: string; planName: string; amount: number; paid_at: string | null }[];
};
type Customer = {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  created_at: string;
  active: { product_code: string; source: string; current_period_end: string }[];
};

type Status = "loading" | "login" | "forbidden" | "ready";

async function token(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
async function saFetch(path: string, init?: RequestInit) {
  const t = await token();
  return fetch(path, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      "Content-Type": "application/json",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
  });
}

const DISC: Record<string, string> = { ARC: "Kiến trúc", STR: "Kết cấu", MEP: "Điện nước" };

export default function SuperAdminPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [data, setData] = useState<Overview | null>(null);
  const [forbidMsg, setForbidMsg] = useState("");

  const loadOverview = useCallback(async () => {
    const res = await saFetch("/api/superadmin/overview");
    if (res.status === 401) {
      setStatus("login");
      return;
    }
    if (res.status === 403) {
      const j = await res.json().catch(() => ({}));
      setForbidMsg(j.message || "Anh/chị không có quyền super admin.");
      setStatus("forbidden");
      return;
    }
    const j = await res.json();
    setData(j);
    setStatus("ready");
  }, []);

  useEffect(() => {
    (async () => {
      const t = await token();
      if (!t) {
        setStatus("login");
        return;
      }
      await loadOverview();
    })();
  }, [loadOverview]);

  if (status === "loading")
    return <Centered><p className="text-muted">Đang tải…</p></Centered>;

  if (status === "login") return <LoginCard onDone={loadOverview} />;

  if (status === "forbidden")
    return (
      <Centered>
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-navy-900">Không có quyền truy cập</h1>
          <p className="mt-2 text-sm text-muted">{forbidMsg}</p>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              setStatus("login");
            }}
            className="mt-6 cursor-pointer rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-800"
          >
            Đăng nhập tài khoản khác
          </button>
        </div>
      </Centered>
    );

  return <Dashboard data={data!} onRefresh={loadOverview} />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-screen place-items-center bg-surface p-4">{children}</div>;
}

function LoginCard({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setErr("Email hoặc mật khẩu không đúng.");
      return;
    }
    onDone();
  }

  return (
    <Centered>
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-navy-900 px-3 py-1 text-xs font-bold text-white">SUPER ADMIN</span>
          <h1 className="mt-3 text-xl font-bold text-navy-900">Bảng điều khiển quản trị</h1>
          <p className="mt-1 text-sm text-muted">Chỉ tài khoản super admin mới truy cập được.</p>
        </div>
        <label className="block text-sm font-medium text-navy-800" htmlFor="sa-email">Email</label>
        <input id="sa-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
        <label className="mt-4 block text-sm font-medium text-navy-800" htmlFor="sa-pass">Mật khẩu</label>
        <input id="sa-pass" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
        <button type="submit" disabled={busy}
          className="mt-6 w-full cursor-pointer rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">
          {busy ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>
      </form>
    </Centered>
  );
}

function Dashboard({ data, onRefresh }: { data: Overview; onRefresh: () => void }) {
  const k = data.kpis;
  const [grantEmail, setGrantEmail] = useState("");
  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-navy-900 px-2 py-1 text-xs font-bold text-white">SUPER ADMIN</span>
            <h1 className="text-lg font-bold text-navy-900">Bảng điều khiển</h1>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted sm:inline">{data.email}</span>
            <button onClick={() => supabase.auth.signOut().then(() => location.reload())}
              className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-navy-800 transition-colors hover:bg-slate-50">
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        {/* KPI */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Kpi label="Doanh thu (đã thanh toán)" value={formatVnd(k.revenue)} accent />
          <Kpi label="Số khách hàng" value={k.customers.toLocaleString("vi-VN")} sub={`${k.paidCustomers} đã thanh toán`} />
          <Kpi label="Đơn đã thanh toán" value={k.ordersPaid.toLocaleString("vi-VN")} />
          <Kpi label="License đang hiệu lực" value={k.activeSubs.toLocaleString("vi-VN")} sub="dòng subscription active" />
          <Kpi label="Đang dùng thử" value={k.trialUsers.toLocaleString("vi-VN")} sub="tài khoản có trial" />
          <Kpi label="Tỷ lệ trả phí" value={`${k.customers ? Math.round((k.paidCustomers / k.customers) * 100) : 0}%`} sub="khách trả phí / tổng" />
        </section>

        {/* Chart */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-navy-900">Doanh thu 30 ngày gần nhất</h2>
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.salesByDay} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0369a1" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0369a1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#64748b" }} interval={4} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={42} />
                <Tooltip formatter={(v: number) => [formatVnd(v), "Doanh thu"]} labelFormatter={(l) => `Ngày ${l}`} />
                <Area type="monotone" dataKey="revenue" stroke="#0369a1" strokeWidth={2} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Recent orders */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-navy-900">Đơn thanh toán gần đây</h2>
            {data.recent.length === 0 ? (
              <p className="mt-4 text-sm text-muted">Chưa có đơn nào được thanh toán.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                      <th className="py-2 pr-2">Mã đơn</th><th className="py-2 pr-2">Khách</th>
                      <th className="py-2 pr-2">Gói</th><th className="py-2 text-right">Số tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.map((o) => (
                      <tr key={o.order_id} className="border-b border-slate-100">
                        <td className="py-2 pr-2 font-mono text-xs">{o.order_id}</td>
                        <td className="py-2 pr-2 text-xs">{o.email || "—"}</td>
                        <td className="py-2 pr-2 text-xs">{o.planName}</td>
                        <td className="py-2 text-right font-semibold text-navy-900">{formatVnd(o.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Grant license */}
          <GrantLicense email={grantEmail} setEmail={setGrantEmail} onGranted={onRefresh} />
        </div>

        {/* Customers */}
        <CustomersTable onPickEmail={(email) => {
          setGrantEmail(email);
          document.getElementById("grant-email")?.scrollIntoView({ behavior: "smooth", block: "center" });
        }} />
      </main>
    </div>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${accent ? "border-brand-500 bg-navy-900 text-white" : "border-slate-200 bg-white"}`}>
      <p className={`text-sm ${accent ? "text-brand-100" : "text-muted"}`}>{label}</p>
      <p className={`mt-2 text-2xl font-extrabold ${accent ? "text-white" : "text-navy-900"}`}>{value}</p>
      {sub && <p className={`mt-1 text-xs ${accent ? "text-slate-300" : "text-slate-400"}`}>{sub}</p>}
    </div>
  );
}

function GrantLicense({ email, setEmail, onGranted }: { email: string; setEmail: (v: string) => void; onGranted: () => void }) {
  const [scope, setScope] = useState<"ARC" | "STR" | "MEP" | "combo">("combo");
  const [amount, setAmount] = useState(12);
  const [unit, setUnit] = useState<"month" | "day">("month");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await saFetch("/api/superadmin/grant-license", {
      method: "POST",
      body: JSON.stringify({ email, scope, unit, amount }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !j.ok) {
      setMsg({ kind: "err", text: j.message || "Cấp license thất bại." });
      return;
    }
    const ends = (j.granted || []).map((g: { product_code: string; current_period_end: string }) => `${g.product_code} → ${formatDate(g.current_period_end)}`).join(", ");
    setMsg({ kind: "ok", text: `Đã cấp cho ${j.email}: ${ends}` });
    onGranted();
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-bold text-navy-900">Cấp phát license thủ công</h2>
      <p className="mt-1 text-sm text-muted">Cộng dồn vào hạn hiện tại — không mất ngày còn lại của khách.</p>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="grant-email" className="block text-sm font-medium text-navy-800">Email khách hàng</label>
          <input id="grant-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="khach@email.com"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
        </div>
        <div>
          <label className="block text-sm font-medium text-navy-800">Bộ môn</label>
          <div className="mt-1 grid grid-cols-4 gap-2">
            {(["ARC", "STR", "MEP", "combo"] as const).map((s) => (
              <button type="button" key={s} onClick={() => setScope(s)}
                className={`cursor-pointer rounded-lg border px-2 py-2 text-xs font-semibold transition-colors ${scope === s ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-300 text-navy-800 hover:bg-slate-50"}`}>
                {s === "combo" ? "Combo 3" : s}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="grant-amount" className="block text-sm font-medium text-navy-800">Thời hạn</label>
            <input id="grant-amount" type="number" min={1} max={120} required value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
          </div>
          <div>
            <label htmlFor="grant-unit" className="block text-sm font-medium text-navy-800">Đơn vị</label>
            <select id="grant-unit" value={unit} onChange={(e) => setUnit(e.target.value as "month" | "day")}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
              <option value="month">Tháng</option>
              <option value="day">Ngày</option>
            </select>
          </div>
        </div>
        {msg && (
          <p className={`text-sm ${msg.kind === "ok" ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>
        )}
        <button type="submit" disabled={busy}
          className="w-full cursor-pointer rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">
          {busy ? "Đang cấp…" : "Cấp / gia hạn license"}
        </button>
      </form>
    </section>
  );
}

function CustomersTable({ onPickEmail }: { onPickEmail: (email: string) => void }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Customer[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (query: string) => {
    setBusy(true);
    const res = await saFetch(`/api/superadmin/customers?q=${encodeURIComponent(query)}`);
    const j = await res.json().catch(() => ({ customers: [] }));
    setRows(j.customers || []);
    setBusy(false);
  }, []);

  useEffect(() => { load(""); }, [load]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-navy-900">Khách hàng</h2>
        <div className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") load(q); }}
            placeholder="Tìm email / tên / SĐT"
            className="w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
          <button onClick={() => load(q)}
            className="cursor-pointer rounded-lg bg-navy-900 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-800">
            Tìm
          </button>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
              <th className="py-2 pr-3">Email</th><th className="py-2 pr-3">Họ tên</th>
              <th className="py-2 pr-3">SĐT</th><th className="py-2 pr-3">Bộ môn active</th>
              <th className="py-2 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {busy && <tr><td colSpan={5} className="py-6 text-center text-muted">Đang tải…</td></tr>}
            {!busy && rows.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted">Không có khách hàng.</td></tr>}
            {!busy && rows.map((c) => (
              <tr key={c.id} className="border-b border-slate-100">
                <td className="py-2 pr-3 text-xs">{c.email}</td>
                <td className="py-2 pr-3 text-xs">{c.full_name || "—"}</td>
                <td className="py-2 pr-3 text-xs">{c.phone || "—"}</td>
                <td className="py-2 pr-3">
                  {c.active.length === 0 ? <span className="text-xs text-slate-400">—</span> : (
                    <div className="flex flex-wrap gap-1">
                      {c.active.map((a) => (
                        <span key={a.product_code} title={`Hết hạn ${formatDate(a.current_period_end)}`}
                          className="rounded bg-green-50 px-1.5 py-0.5 text-[11px] font-semibold text-green-700">
                          {DISC[a.product_code] || a.product_code}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="py-2 text-right">
                  <button onClick={() => onPickEmail(c.email)}
                    className="cursor-pointer rounded-md border border-brand-300 px-2 py-1 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50">
                    Cấp license
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
