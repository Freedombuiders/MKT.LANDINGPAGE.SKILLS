// app/thanks/page.tsx — trang cảm ơn sau khi thanh toán thành công.

export const dynamic = "force-dynamic";

export default async function ThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { orderId } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-6 text-paper">
      <div className="w-full max-w-md rounded-3xl bg-ink-soft p-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cta/15">
          <svg
            className="h-9 w-9 text-cta"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="mt-6 text-2xl font-bold">Thanh toán thành công!</h1>
        <p className="mt-3 text-slate-300">
          Cảm ơn anh/chị đã đăng ký khoá <b>AI Hermes Agent</b>. Đội ngũ sẽ gửi
          thông tin truy cập khoá học qua email trong thời gian sớm nhất.
        </p>
        {orderId && (
          <p className="mt-4 text-sm text-slate-500">
            Mã đơn hàng: <span className="font-mono text-primary-bright">{orderId}</span>
          </p>
        )}
        <a
          href="/"
          className="mt-8 inline-block cursor-pointer rounded-xl bg-cta px-6 py-3 font-semibold text-white transition-colors duration-200 hover:bg-cta-dark"
        >
          Về trang chủ
        </a>
      </div>
    </main>
  );
}
