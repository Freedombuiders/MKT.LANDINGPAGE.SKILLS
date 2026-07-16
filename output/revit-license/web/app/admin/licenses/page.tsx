"use client";

import { useState } from "react";
import AdminGate, { useAdmin } from "@/components/AdminGate";
import { disciplineLabel, formatDate, formatDateTime } from "@/lib/format";

type UserRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  company: string | null;
  email: string | null;
  created_at: string | null;
};
type Sub = {
  id: string;
  user_id: string;
  product_code: string;
  source: string;
  status: string;
  current_period_end: string | null;
  max_devices: number;
};
type Device = {
  id: string;
  user_id: string;
  device_id: string;
  device_name: string | null;
  last_seen_at: string | null;
  status: string;
};

function LicensesInner() {
  const { adminFetch } = useAdmin();
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await adminFetch("/api/admin/licenses?q=" + encodeURIComponent(q));
      const j = await res.json();
      if (!j.ok) {
        setError(j.message || "Không tìm được.");
      } else {
        setUsers(j.users || []);
        setSubs(j.subscriptions || []);
        setDevices(j.devices || []);
      }
    } catch {
      setError("Lỗi mạng.");
    } finally {
      setLoading(false);
    }
  }

  async function doAction(
    label: string,
    body: Record<string, unknown>,
    key: string
  ) {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const res = await adminFetch("/api/admin/licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!j.ok) {
        setError(j.message || "Thao tác thất bại.");
      } else {
        setNotice(label + " thành công.");
        await search();
      }
    } catch {
      setError("Lỗi mạng.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Quản lý giấy phép</h1>
      <p className="mt-1 text-sm text-muted">
        Tìm người dùng theo email / số điện thoại / tên, xem gói và thiết bị, gia hạn hoặc thu hồi.
      </p>

      <form onSubmit={search} className="mt-5 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="email, SĐT hoặc tên..."
          className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white hover:bg-brand-700"
        >
          Tìm
        </button>
      </form>

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

      {loading && <p className="mt-6 text-muted">Đang tải...</p>}

      {!loading &&
        users.map((u) => {
          const uSubs = subs.filter((s) => s.user_id === u.id);
          const uDevs = devices.filter((d) => d.user_id === u.id && d.status !== "revoked");
          return (
            <div
              key={u.id}
              className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{u.full_name || "(chưa có tên)"}</p>
                  <p className="text-sm text-muted">
                    {u.email || "—"} · {u.phone || "—"}
                    {u.company ? " · " + u.company : ""}
                  </p>
                </div>
                <span className="text-xs text-muted">
                  Tạo: {formatDate(u.created_at)}
                </span>
              </div>

              {/* Subscriptions */}
              <h3 className="mt-4 text-sm font-semibold">Gói bản quyền</h3>
              {uSubs.length === 0 ? (
                <p className="mt-1 text-sm text-muted">Chưa có gói.</p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-muted">
                      <tr>
                        <th className="py-2 font-medium">Bộ môn</th>
                        <th className="py-2 font-medium">Nguồn</th>
                        <th className="py-2 font-medium">Trạng thái</th>
                        <th className="py-2 font-medium">Hết hạn</th>
                        <th className="py-2 text-right font-medium">Gia hạn</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {uSubs.map((s) => (
                        <tr key={s.id}>
                          <td className="py-2">{disciplineLabel(s.product_code)}</td>
                          <td className="py-2 text-muted">
                            {s.source === "trial" ? "Dùng thử" : "Đã mua"}
                          </td>
                          <td className="py-2 text-muted">{s.status}</td>
                          <td className="py-2">{formatDate(s.current_period_end)}</td>
                          <td className="py-2 text-right">
                            <div className="inline-flex gap-1">
                              <button
                                onClick={() =>
                                  doAction(
                                    "Gia hạn 30 ngày",
                                    { action: "renew", subscription_id: s.id, days: 30 },
                                    "renew30-" + s.id
                                  )
                                }
                                disabled={busy === "renew30-" + s.id}
                                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-60"
                              >
                                +30 ngày
                              </button>
                              <button
                                onClick={() =>
                                  doAction(
                                    "Gia hạn 365 ngày",
                                    { action: "renew", subscription_id: s.id, days: 365 },
                                    "renew365-" + s.id
                                  )
                                }
                                disabled={busy === "renew365-" + s.id}
                                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-60"
                              >
                                +1 năm
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Devices */}
              <h3 className="mt-5 text-sm font-semibold">Thiết bị</h3>
              {uDevs.length === 0 ? (
                <p className="mt-1 text-sm text-muted">Không có thiết bị hoạt động.</p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-muted">
                      <tr>
                        <th className="py-2 font-medium">Tên máy</th>
                        <th className="py-2 font-medium">Hoạt động gần nhất</th>
                        <th className="py-2 text-right font-medium">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {uDevs.map((d) => (
                        <tr key={d.id}>
                          <td className="py-2">
                            <div className="font-medium">{d.device_name || "Máy không tên"}</div>
                            <div className="text-xs text-muted">{d.device_id}</div>
                          </td>
                          <td className="py-2 text-muted">{formatDateTime(d.last_seen_at)}</td>
                          <td className="py-2 text-right">
                            <div className="inline-flex gap-1">
                              <button
                                onClick={() =>
                                  doAction(
                                    "Gỡ thiết bị",
                                    {
                                      action: "revoke_device",
                                      device_id: d.device_id,
                                      user_id: d.user_id,
                                    },
                                    "rev-" + d.id
                                  )
                                }
                                disabled={busy === "rev-" + d.id}
                                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-60"
                              >
                                Gỡ máy
                              </button>
                              <button
                                onClick={() =>
                                  doAction(
                                    "Thu hồi (refund)",
                                    {
                                      action: "revoke_refund",
                                      device_id: d.device_id,
                                      reason: "refund",
                                    },
                                    "refund-" + d.id
                                  )
                                }
                                disabled={busy === "refund-" + d.id}
                                className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                              >
                                Thu hồi
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}

      {!loading && users.length === 0 && (
        <p className="mt-6 text-sm text-muted">Nhập từ khoá rồi bấm Tìm để xem kết quả.</p>
      )}
    </div>
  );
}

export default function AdminLicensesPage() {
  return (
    <AdminGate>
      <LicensesInner />
    </AdminGate>
  );
}
