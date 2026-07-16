"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AuthGate from "@/components/AuthGate";
import Nav from "@/components/Nav";
import { supabase } from "@/lib/supabase";
import { formatVnd } from "@/lib/format";

type Plan = {
  id: string;
  code: string;
  name: string;
  period: "month" | "year" | string;
  price_vnd: number;
  is_combo: boolean;
  is_active: boolean;
};

type OrderInfo = {
  order_id: string;
  amount: number;
  qr_url: string;
  bank_info: {
    account: string;
    bank_code: string;
    bank_name: string;
    content: string;
  };
};

type Group = { key: string; title: string; plans: Plan[] };

function groupPlans(plans: Plan[]): Group[] {
  const combo = plans.filter((p) => p.is_combo);
  const monthly = plans.filter((p) => !p.is_combo && p.period === "month");
  const yearly = plans.filter((p) => !p.is_combo && p.period === "year");
  const groups: Group[] = [
    { key: "month", title: "Theo tháng", plans: monthly },
    { key: "year", title: "Theo năm", plans: yearly },
    { key: "combo", title: "Combo trọn bộ", plans: combo },
  ];
  return groups.filter((g) => g.plans.length > 0);
}

function BuyInner() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [paid, setPaid] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from("plans")
      .select("id, code, name, period, price_vnd, is_combo, is_active")
      .eq("is_active", true)
      .order("price_vnd", { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setError("Không tải được danh sách gói. Anh/chị thử lại sau.");
        } else {
          setPlans((data as Plan[]) || []);
        }
        setLoadingPlans(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Poll trạng thái đơn mỗi 4s cho tới khi 'paid'.
  useEffect(() => {
    if (!order || paid) return;
    stopPolling();
    pollRef.current = setInterval(async () => {
      const { data } = await supabase
        .from("orders")
        .select("status")
        .eq("id", order.order_id)
        .maybeSingle();
      if (data?.status === "paid") {
        setPaid(true);
        stopPolling();
      }
    }, 4000);
    return stopPolling;
  }, [order, paid, stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  async function handleSelect(plan: Plan) {
    setError(null);
    setCreating(plan.id);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setError("Phiên đăng nhập đã hết hạn. Anh/chị đăng nhập lại.");
      setCreating(null);
      return;
    }
    try {
      const res = await fetch("/api/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan_id: plan.id }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.message || "Không tạo được đơn hàng.");
        setCreating(null);
        return;
      }
      setPaid(false);
      setOrder({
        order_id: json.order_id,
        amount: json.amount,
        qr_url: json.qr_url,
        bank_info: json.bank_info,
      });
    } catch {
      setError("Có lỗi mạng khi tạo đơn hàng.");
    } finally {
      setCreating(null);
    }
  }

  function resetOrder() {
    stopPolling();
    setOrder(null);
    setPaid(false);
  }

  const groups = groupPlans(plans);

  return (
    <div className="min-h-screen bg-slate-50">
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-bold">Mua gói bản quyền</h1>
        <p className="mt-1 text-sm text-muted">
          Chọn gói phù hợp. Sau khi chọn, anh/chị quét mã VietQR để thanh toán — gói kích hoạt tự động.
        </p>

        {error && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Order panel */}
        {order && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            {paid ? (
              <div className="text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-2xl text-green-600">
                  ✓
                </span>
                <h2 className="mt-4 text-xl font-bold">Đã thanh toán!</h2>
                <p className="mt-2 text-muted">
                  Cảm ơn anh/chị. Mở Revit và đăng nhập add-in để kích hoạt gói vừa mua.
                </p>
                <button
                  onClick={resetOrder}
                  className="mt-5 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-ink hover:bg-slate-50"
                >
                  Mua thêm gói khác
                </button>
              </div>
            ) : (
              <div className="grid items-center gap-6 md:grid-cols-2">
                <div className="flex flex-col items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={order.qr_url}
                    alt="Mã VietQR thanh toán"
                    className="h-64 w-64 rounded-xl border border-slate-200 bg-white object-contain p-2"
                  />
                  <p className="mt-3 flex items-center gap-2 text-sm text-muted">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                    Đang chờ thanh toán...
                  </p>
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Quét mã để chuyển khoản</h2>
                  <p className="mt-1 text-sm text-muted">
                    Dùng app ngân hàng quét mã, hoặc chuyển khoản thủ công đúng thông tin dưới đây.
                    Nội dung chuyển khoản phải đúng mã đơn.
                  </p>
                  <dl className="mt-4 space-y-2 text-sm">
                    <Row label="Mã đơn" value={order.order_id} mono />
                    <Row label="Số tiền" value={formatVnd(order.amount)} />
                    <Row label="Ngân hàng" value={order.bank_info.bank_name || order.bank_info.bank_code} />
                    <Row label="Số tài khoản" value={order.bank_info.account} mono />
                    <Row label="Nội dung CK" value={order.bank_info.content} mono />
                  </dl>
                  <button
                    onClick={resetOrder}
                    className="mt-5 text-sm font-medium text-muted hover:text-ink hover:underline"
                  >
                    Huỷ và chọn gói khác
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Plan selector */}
        {!order && (
          <div className="mt-6 space-y-8">
            {loadingPlans ? (
              <p className="text-sm text-muted">Đang tải danh sách gói...</p>
            ) : groups.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <p className="font-medium">Chưa có gói nào để bán</p>
                <p className="mt-1 text-sm text-muted">Anh/chị vui lòng quay lại sau.</p>
              </div>
            ) : (
              groups.map((g) => (
                <section key={g.key}>
                  <h2 className="text-lg font-semibold">{g.title}</h2>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {g.plans.map((p) => (
                      <div
                        key={p.id}
                        className={
                          "flex flex-col rounded-2xl border bg-white p-5 shadow-sm " +
                          (p.is_combo ? "border-brand-600 ring-1 ring-brand-600" : "border-slate-200")
                        }
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold">{p.name}</h3>
                          {p.is_combo && (
                            <span className="rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                              Combo
                            </span>
                          )}
                        </div>
                        <div className="mt-3 text-2xl font-extrabold">{formatVnd(p.price_vnd)}</div>
                        <p className="mt-1 text-xs text-muted">
                          {p.period === "year" ? "Thời hạn 1 năm" : "Thời hạn 1 tháng"}
                          {p.is_combo ? " · trọn 3 bộ môn" : ""}
                        </p>
                        <button
                          onClick={() => handleSelect(p)}
                          disabled={creating === p.id}
                          className={
                            "mt-5 rounded-xl px-4 py-2.5 text-center text-sm font-semibold " +
                            (p.is_combo
                              ? "bg-brand-600 text-white hover:bg-brand-700"
                              : "border border-slate-200 text-ink hover:bg-slate-50") +
                            " disabled:opacity-60"
                          }
                        >
                          {creating === p.id ? "Đang tạo đơn..." : "Mua gói này"}
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className={"font-medium " + (mono ? "font-mono" : "")}>{value}</dd>
    </div>
  );
}

export default function BuyPage() {
  return (
    <AuthGate>
      <BuyInner />
    </AuthGate>
  );
}
