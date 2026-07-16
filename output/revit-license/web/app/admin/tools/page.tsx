"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AdminGate, { useAdmin } from "@/components/AdminGate";
import { disciplineLabel } from "@/lib/format";

type Tool = {
  command_id: string;
  product_code: string | null;
  runs: number;
  errors: number;
  error_rate: number;
};

function ToolsInner() {
  const { adminFetch } = useAdmin();
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    adminFetch("/api/admin/tools")
      .then((r) => r.json())
      .then((j) => {
        if (!active) return;
        if (!j.ok) setError(j.message || "Không tải được dữ liệu.");
        else setTools(j.tools || []);
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

  const top = tools.slice(0, 10).map((t) => ({
    name: t.command_id,
    runs: t.runs,
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold">Công cụ</h1>
      <p className="mt-1 text-sm text-muted">Tool được dùng nhiều nhất và tỷ lệ lỗi từng tool.</p>

      {tools.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-muted">
          Chưa có dữ liệu telemetry.
        </div>
      ) : (
        <>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Top 10 công cụ ưa thích</h2>
            <div className="mt-4 h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top} margin={{ top: 8, right: 16, bottom: 40, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    angle={-30}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 12, fill: "#64748b" }} allowDecimals={false} />
                  <Tooltip formatter={(v: number) => [v.toLocaleString("vi-VN"), "Lượt dùng"]} />
                  <Bar dataKey="runs" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Công cụ</th>
                  <th className="px-4 py-3 font-medium">Bộ môn</th>
                  <th className="px-4 py-3 text-right font-medium">Lượt dùng</th>
                  <th className="px-4 py-3 text-right font-medium">Lỗi</th>
                  <th className="px-4 py-3 text-right font-medium">Tỷ lệ lỗi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tools.map((t) => (
                  <tr key={t.command_id}>
                    <td className="px-4 py-3 font-medium">{t.command_id}</td>
                    <td className="px-4 py-3 text-muted">{disciplineLabel(t.product_code)}</td>
                    <td className="px-4 py-3 text-right">{t.runs.toLocaleString("vi-VN")}</td>
                    <td className="px-4 py-3 text-right">{t.errors.toLocaleString("vi-VN")}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={
                          "rounded-full px-2 py-0.5 text-xs font-medium " +
                          (t.error_rate >= 10
                            ? "bg-red-50 text-red-700"
                            : t.error_rate >= 3
                            ? "bg-amber-50 text-amber-700"
                            : "bg-green-50 text-green-700")
                        }
                      >
                        {t.error_rate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminToolsPage() {
  return (
    <AdminGate>
      <ToolsInner />
    </AdminGate>
  );
}
