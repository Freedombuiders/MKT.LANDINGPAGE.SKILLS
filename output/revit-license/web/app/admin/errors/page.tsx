"use client";

import { Fragment, useEffect, useState } from "react";
import AdminGate, { useAdmin } from "@/components/AdminGate";
import { formatDateTime } from "@/lib/format";

type ErrRow = {
  error_code: string;
  error_message: string;
  count: number;
  sample_stack: string | null;
  last_at: string | null;
};

function ErrorsInner() {
  const { adminFetch } = useAdmin();
  const [rows, setRows] = useState<ErrRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    adminFetch("/api/admin/errors")
      .then((r) => r.json())
      .then((j) => {
        if (!active) return;
        if (!j.ok) setError(j.message || "Không tải được dữ liệu.");
        else setRows(j.errors || []);
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

  return (
    <div>
      <h1 className="text-2xl font-bold">Top lỗi</h1>
      <p className="mt-1 text-sm text-muted">
        Các lỗi xuất hiện nhiều nhất. Bấm một dòng để xem stack trace mẫu.
      </p>

      {rows.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-muted">
          Chưa ghi nhận lỗi nào.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Mã lỗi</th>
                <th className="px-4 py-3 font-medium">Nội dung</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Gần nhất</th>
                <th className="px-4 py-3 text-right font-medium">Số lần</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <Fragment key={i}>
                  <tr
                    onClick={() => setOpenIdx(openIdx === i ? null : i)}
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-mono text-xs">{r.error_code}</td>
                    <td className="px-4 py-3">{r.error_message}</td>
                    <td className="hidden px-4 py-3 text-muted md:table-cell">
                      {formatDateTime(r.last_at)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {r.count.toLocaleString("vi-VN")}
                    </td>
                  </tr>
                  {openIdx === i && (
                    <tr>
                      <td colSpan={4} className="bg-slate-50 px-4 py-3">
                        <p className="mb-2 text-xs font-medium text-muted">Stack trace mẫu</p>
                        <pre className="max-h-72 overflow-auto rounded-lg bg-ink p-3 text-xs leading-relaxed text-slate-100">
                          {r.sample_stack || "(không có stack trace)"}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminErrorsPage() {
  return (
    <AdminGate>
      <ErrorsInner />
    </AdminGate>
  );
}
