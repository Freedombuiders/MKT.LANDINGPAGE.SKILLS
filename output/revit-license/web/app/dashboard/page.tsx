"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AuthGate from "@/components/AuthGate";
import Nav from "@/components/Nav";
import { supabase } from "@/lib/supabase";
import {
  disciplineLabel,
  formatDate,
  formatDateTime,
} from "@/lib/format";

type Subscription = {
  id: string;
  product_code: string;
  source: "trial" | "paid";
  status: string;
  current_period_end: string | null;
  max_devices: number;
};

type DeviceRow = {
  id: string;
  device_id: string;
  device_name: string | null;
  last_seen_at: string | null;
  status: string;
};

/** Trạng thái hiển thị của 1 sub: trial / paid / expired (suy ra). */
function subBadge(s: Subscription): { label: string; cls: string } {
  const expired =
    s.status !== "active" ||
    (s.current_period_end ? new Date(s.current_period_end).getTime() < Date.now() : true);
  if (expired) {
    return { label: "Hết hạn", cls: "bg-slate-100 text-slate-600 border-slate-200" };
  }
  if (s.source === "trial") {
    return { label: "Dùng thử", cls: "bg-amber-50 text-amber-700 border-amber-200" };
  }
  return { label: "Đã mua", cls: "bg-green-50 text-green-700 border-green-200" };
}

function DashboardInner() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: subData, error: subErr } = await supabase
      .from("subscriptions")
      .select("id, product_code, source, status, current_period_end, max_devices")
      .order("product_code", { ascending: true });

    const { data: devData, error: devErr } = await supabase
      .from("device_activations")
      .select("id, device_id, device_name, last_seen_at, status")
      .order("last_seen_at", { ascending: false });

    if (subErr || devErr) {
      setError("Không tải được dữ liệu. Anh/chị thử tải lại trang.");
    } else {
      setSubs((subData as Subscription[]) || []);
      setDevices(((devData as DeviceRow[]) || []).filter((d) => d.status !== "revoked"));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRevoke(deviceId: string) {
    setRevoking(deviceId);
    setError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setError("Phiên đăng nhập đã hết hạn. Anh/chị đăng nhập lại.");
      setRevoking(null);
      return;
    }
    try {
      const res = await fetch("/api/devices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ device_id: deviceId, action: "revoke" }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.message || "Không gỡ được thiết bị.");
      } else {
        setDevices((prev) => prev.filter((d) => d.device_id !== deviceId));
      }
    } catch {
      setError("Có lỗi mạng khi gỡ thiết bị.");
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold">Bảng điều khiển</h1>
            <p className="mt-1 text-sm text-muted">
              Quản lý gói bản quyền và thiết bị đã kích hoạt của anh/chị.
            </p>
          </div>
          <a
            href="#"
            className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Tải bản cài add-in
          </a>
        </div>

        {error && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Subscriptions */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Gói bản quyền theo bộ môn</h2>
          {loading ? (
            <p className="mt-4 text-sm text-muted">Đang tải...</p>
          ) : subs.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <p className="font-medium">Anh/chị chưa có gói nào</p>
              <p className="mt-1 text-sm text-muted">
                Đăng nhập add-in trong Revit để kích hoạt 30 ngày dùng thử, hoặc mua gói ngay.
              </p>
              <Link
                href="/buy"
                className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Mua gói
              </Link>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {subs.map((s) => {
                const badge = subBadge(s);
                return (
                  <div
                    key={s.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700">
                          {s.product_code}
                        </span>
                        <span className="font-semibold">
                          {disciplineLabel(s.product_code)}
                        </span>
                      </div>
                      <span
                        className={
                          "rounded-full border px-2.5 py-0.5 text-xs font-medium " + badge.cls
                        }
                      >
                        {badge.label}
                      </span>
                    </div>
                    <dl className="mt-4 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-muted">Hết hạn</dt>
                        <dd className="font-medium">{formatDate(s.current_period_end)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted">Số máy tối đa</dt>
                        <dd className="font-medium">{s.max_devices}</dd>
                      </div>
                    </dl>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Devices */}
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Thiết bị đã kích hoạt</h2>
            <button
              onClick={load}
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              Làm mới
            </button>
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-muted">Đang tải...</p>
          ) : devices.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <p className="font-medium">Chưa có thiết bị nào được kích hoạt</p>
              <p className="mt-1 text-sm text-muted">
                Mở Revit, đăng nhập add-in để kích hoạt máy đầu tiên.
              </p>
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Tên máy</th>
                    <th className="hidden px-4 py-3 font-medium sm:table-cell">
                      Hoạt động gần nhất
                    </th>
                    <th className="px-4 py-3 text-right font-medium">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {devices.map((d) => (
                    <tr key={d.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{d.device_name || "Máy không tên"}</div>
                        <div className="text-xs text-muted">{d.device_id}</div>
                      </td>
                      <td className="hidden px-4 py-3 text-muted sm:table-cell">
                        {formatDateTime(d.last_seen_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleRevoke(d.device_id)}
                          disabled={revoking === d.device_id}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                        >
                          {revoking === d.device_id ? "Đang gỡ..." : "Gỡ máy"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-muted">
            Gỡ máy để giải phóng chỗ khi vượt số thiết bị cho phép. Sau khi gỡ, anh/chị có thể
            kích hoạt máy khác.
          </p>
        </section>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGate>
      <DashboardInner />
    </AuthGate>
  );
}
