import RegisterForm from "@/components/RegisterForm";

const modules = [
  {
    title: "Nền tảng AI Agent",
    desc: "Hiểu bản chất agent: LLM, tool-calling, memory, vòng lặp ra quyết định — không lý thuyết suông.",
  },
  {
    title: "Kết nối công cụ thật",
    desc: "Cho agent dùng API, Google Sheet, email, Telegram, web scraping để tự làm việc thay anh/chị.",
  },
  {
    title: "Tự động hoá quy trình",
    desc: "Dựng workflow đa bước: nhận yêu cầu → xử lý → báo cáo, chạy 24/7 không cần ngồi canh.",
  },
  {
    title: "Agent cho kinh doanh",
    desc: "Agent chăm sóc khách, chốt đơn, tổng hợp dữ liệu, viết content — áp ngay vào việc đang làm.",
  },
  {
    title: "Triển khai & vận hành",
    desc: "Đưa agent lên cloud chạy ổn định, kiểm soát chi phí token, xử lý lỗi và giám sát.",
  },
  {
    title: "Bộ template thực chiến",
    desc: "Nhận sẵn các agent mẫu có thể chỉnh sửa và dùng được ngay sau buổi học đầu tiên.",
  },
];

const pains = [
  "Làm thủ công lặp đi lặp lại hàng giờ mỗi ngày, hết thời gian cho việc quan trọng",
  "Thấy ai cũng nói về AI Agent nhưng không biết bắt đầu từ đâu, học cái gì trước",
  "Đã thử ChatGPT nhưng nó chỉ trả lời, không tự làm được việc thật",
  "Sợ phải biết code mới làm được agent",
];

const faqs = [
  {
    q: "Em chưa biết code có học được không?",
    a: "Được. Khoá thiết kế cho người không chuyên: anh/chị học theo từng bước, dùng template có sẵn và công cụ no-code/low-code. Phần code (nếu có) đều được giải thích từ gốc.",
  },
  {
    q: "Học xong em làm được gì cụ thể?",
    a: "Anh/chị tự dựng được agent xử lý một quy trình thật trong công việc: ví dụ tự động trả lời khách, tổng hợp báo cáo, lọc lead, hoặc viết & đăng content theo lịch.",
  },
  {
    q: "Khoá học diễn ra như thế nào?",
    a: "Học online, có video bài giảng + tài liệu + bộ template thực chiến. Anh/chị học theo tiến độ của mình và áp dụng ngay vào case thật.",
  },
  {
    q: "Nếu không phù hợp thì sao?",
    a: "Anh/chị được hoàn tiền 100% trong vòng 7 ngày nếu thấy khoá học không đúng kỳ vọng — không cần lý do.",
  },
];

export default function Page() {
  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden bg-ink text-paper">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(600px circle at 20% 10%, rgba(99,102,241,0.35), transparent 45%), radial-gradient(500px circle at 90% 30%, rgba(16,185,129,0.25), transparent 45%)",
          }}
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-28">
          <span className="inline-block rounded-full border border-primary-bright/40 bg-primary/10 px-4 py-1 text-sm font-medium text-primary-bright">
            Khoá học thực chiến · Dành cho người bận rộn
          </span>
          <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
            Xây <span className="text-primary-bright">AI Agent</span> tự động hoá
            công việc &amp; kinh doanh của anh/chị
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-slate-300 md:text-xl">
            Từ con số 0 đến một &ldquo;nhân viên AI&rdquo; chạy 24/7 — tự xử lý
            việc lặp đi lặp lại, để anh/chị tập trung vào điều thật sự quan
            trọng. Không cần là dân lập trình.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
            <a
              href="#dang-ky"
              className="cursor-pointer rounded-xl bg-cta px-8 py-4 text-center text-lg font-semibold text-white shadow-lg shadow-cta/30 transition-colors duration-200 hover:bg-cta-dark"
            >
              Đăng ký ngay — 499.000đ
            </a>
            <span className="text-slate-400">
              <span className="text-slate-500 line-through">1.490.000đ</span>{" "}
              · Ưu đãi có hạn
            </span>
          </div>
        </div>
      </section>

      {/* Pain */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold md:text-4xl">
          Anh/chị có đang gặp những điều này?
        </h2>
        <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2">
          {pains.map((p) => (
            <div
              key={p}
              className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5"
            >
              <svg
                className="mt-0.5 h-6 w-6 flex-shrink-0 text-red-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <p className="text-muted">{p}</p>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-lg text-ink">
          AI Hermes Agent giúp anh/chị biến những việc đó thành quy trình tự
          động — agent làm thay, anh/chị chỉ kiểm soát kết quả.
        </p>
      </section>

      {/* Modules / nội dung khoá */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold md:text-4xl">
            Anh/chị sẽ học được gì
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-muted">
            6 phần học đi từ nền tảng đến triển khai thật — kết thúc là một agent
            chạy được cho chính công việc của anh/chị.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {modules.map((m, i) => (
              <div
                key={m.title}
                className="rounded-2xl border border-slate-200 bg-paper p-6 transition-colors duration-200 hover:border-primary"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 font-heading text-lg font-bold text-primary">
                  {i + 1}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-ink">
                  {m.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {m.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing + form */}
      <section id="dang-ky" className="bg-ink py-20 text-paper">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-3xl font-bold md:text-4xl">
            Sở hữu khoá học hôm nay
          </h2>
          <div className="mt-12 grid items-start gap-10 md:grid-cols-2">
            {/* Offer card */}
            <div className="rounded-3xl border border-primary-bright/30 bg-ink-soft p-8">
              <h3 className="text-xl font-semibold text-primary-bright">
                Trọn bộ AI Hermes Agent
              </h3>
              <div className="mt-4 flex items-end gap-3">
                <span className="text-5xl font-bold text-white">499.000đ</span>
                <span className="mb-1 text-lg text-slate-500 line-through">
                  1.490.000đ
                </span>
              </div>
              <p className="mt-1 text-sm text-cta">Tiết kiệm 66% — ưu đãi có hạn</p>
              <ul className="mt-6 space-y-3">
                {[
                  "Trọn bộ 6 phần học từ nền tảng đến triển khai",
                  "Bộ template agent thực chiến dùng được ngay",
                  "Tài liệu + ví dụ cho công việc & kinh doanh",
                  "Truy cập trọn đời, cập nhật miễn phí",
                  "Hoàn tiền 100% trong 7 ngày",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-3">
                    <svg
                      className="mt-0.5 h-5 w-5 flex-shrink-0 text-cta"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span className="text-slate-300">{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Form */}
            <div className="rounded-3xl bg-white p-8 text-ink">
              <h3 className="text-xl font-semibold">Đăng ký giữ chỗ</h3>
              <p className="mt-1 text-sm text-muted">
                Điền thông tin, đội ngũ sẽ hướng dẫn anh/chị thanh toán &amp;
                truy cập khoá học.
              </p>
              <div className="mt-6">
                <RegisterForm />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold md:text-4xl">
          Câu hỏi thường gặp
        </h2>
        <div className="mt-10 space-y-4">
          {faqs.map((f) => (
            <details
              key={f.q}
              className="group rounded-2xl border border-slate-200 bg-white p-5"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-ink">
                {f.q}
                <svg
                  className="h-5 w-5 text-primary transition-transform duration-200 group-open:rotate-180"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </summary>
              <p className="mt-3 leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-2xl font-bold md:text-3xl">
            Để AI làm việc thay — bắt đầu hôm nay
          </h2>
          <p className="mt-3 text-muted">
            Chỉ 499.000đ cho trọn bộ khoá học và template thực chiến.
          </p>
          <a
            href="#dang-ky"
            className="mt-8 inline-block cursor-pointer rounded-xl bg-cta px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-cta/30 transition-colors duration-200 hover:bg-cta-dark"
          >
            Đăng ký ngay
          </a>
        </div>
      </section>

      <footer className="bg-ink py-8 text-center text-sm text-slate-500">
        © 2026 AI Hermes Agent. Mọi quyền được bảo lưu.
      </footer>
    </main>
  );
}
