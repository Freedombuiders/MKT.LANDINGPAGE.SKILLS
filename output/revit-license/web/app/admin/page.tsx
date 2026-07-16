"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AdminGate, { useAdmin } from "@/components/AdminGate";
import { formatVnd } from "@/lib/format";

type Overview = {
  kpis: { total_users: number; active_subs: number; revenue: number; dau: number };
  usage_by_day: { day: string; runs: number }[];
};

function OverviewInner() {
  const { adminFetch } = useAdmin();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    adminFetch("/api/admin/overview")
      .then((r) => r.json())
      .then((j) => {
        if (!active) return;
        if (!j.ok) {
          setError(j.message || "Không tải được dữ liệu.");
        } else {
          setData({ kpis: j.kpis, usage_by_day: j.usage_by_day });
        }
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          setError("Lỗi mạng.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [adminFetch]);

  if (loading) return <p className="text-muted">Đang tải...</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return null;

  const k = data.kpis;
  const cards = [
    { label: "Tổng người dùng", value: k.total_users.toLocaleString("vi-VN") },
    { label: "Đang hiệu lực", value: k.active_subs.toLocaleString("vi-VN") },
    { label: "Doanh thu", value: formatVnd(k.revenue) },
    { label: "DAU hôm nay", value: k.dau.toLocaleString("vi-VN") },
  ];

  const chartData = data.usage_by_day.map((d) => ({
    day: d.day.slice(5), // MM-DD
    runs: d.runs,
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold">Tổng quan</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-muted">{c.label}</p>
            <p className="mt-2 text-2xl font-extrabold">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Lượt dùng công cụ theo ngày (14 ngày)</h2>
        <div className="mt-4 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 12, fill: "#64748b" }} allowDecimals={false} />
              <Tooltip
                formatter={(v: number) => [v.toLocaleString("vi-VN"), "Lượt dùng"]}
                labelFormatter={(l) => `Ngày ${l}`}
              />
              <Line
                type="monotone"
                dataKey="runs"
                stroke="#2563eb"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default function AdminOverviewPage() {
  return (
    <AdminGate>
      <OverviewInner />
    </AdminGate>
  );
}
