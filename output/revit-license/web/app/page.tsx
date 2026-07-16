import Link from "next/link";

/* ---------- Icons (inline SVG, 24x24, stroke) ---------- */
type IconProps = { className?: string };

function IconArc({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 21h18" />
      <path d="M5 21V8l7-5 7 5v13" />
      <path d="M9 21v-6h6v6" />
      <path d="M9 11h.01M15 11h.01" />
    </svg>
  );
}
function IconStr({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 4h16v16H4z" />
      <path d="M4 4l16 16M20 4L4 20" />
      <path d="M4 12h16M12 4v16" />
    </svg>
  );
}
function IconMep({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7h6l2 4 2-8 2 8 2-4h3" />
      <path d="M3 17h18" />
      <circle cx="7" cy="17" r="1.4" />
      <circle cx="17" cy="17" r="1.4" />
    </svg>
  );
}
function IconCheck({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
function IconShield({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
function IconBolt({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
    </svg>
  );
}
function IconWifiOff({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 1l22 22" />
      <path d="M16.7 11.7A6 6 0 0 0 12 10M5 13a10 10 0 0 1 4-2.5M8.5 16.5a4 4 0 0 1 5 0" />
      <path d="M12 20h.01" />
    </svg>
  );
}
function IconDevices({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="14" height="10" rx="1.5" />
      <path d="M2 18h14" />
      <rect x="17" y="9" width="5" height="11" rx="1.2" />
    </svg>
  );
}
function IconChart({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3v18h18" />
      <path d="M7 14l3-4 3 3 4-6" />
    </svg>
  );
}
function IconBell({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

/* ---------- Data ---------- */
const disciplines = [
  {
    code: "ARC",
    name: "Kiến trúc",
    Icon: IconArc,
    desc: "Tự động ghi kích thước, dựng mặt bằng, đánh số phòng, bóc tách hoàn thiện — giảm hàng giờ thao tác tay.",
    tools: ["Auto Dimension", "Wall Dimension", "Room Tag hàng loạt"],
    accent: "from-sky-500/10 to-sky-500/0 text-brand-600",
  },
  {
    code: "STR",
    name: "Kết cấu",
    Icon: IconStr,
    desc: "Rải thép cột/dầm/sàn, thống kê khối lượng, kiểm tra cấu kiện theo tiêu chuẩn — chuẩn xác và nhất quán.",
    tools: ["Column Rebar", "Beam Rebar", "Thống kê thép"],
    accent: "from-indigo-500/10 to-indigo-500/0 text-indigo-600",
  },
  {
    code: "MEP",
    name: "Điện nước (MEP)",
    Icon: IconMep,
    desc: "Định tuyến ống/ga, đánh nhãn hệ thống, kiểm tra va chạm, xuất bảng thống kê thiết bị nhanh gọn.",
    tools: ["Pipe Route", "Đánh nhãn hệ thống", "Clash check"],
    accent: "from-cyan-500/10 to-cyan-500/0 text-cyan-700",
  },
];

const steps = [
  { n: "01", t: "Tải & cài add-in", d: "Cài bộ add-in cho Revit 2021–2024. Một lần, dùng cho cả 3 bộ môn." },
  { n: "02", t: "Đăng nhập trong Revit", d: "Mở Revit, đăng nhập ngay trong dialog add-in — không cần vào web." },
  { n: "03", t: "Trial 30 ngày tự động", d: "Tài khoản mới được kích hoạt dùng thử đủ 3 bộ môn trong 30 ngày." },
  { n: "04", t: "Mua khi cần", d: "Hết thử, gia hạn bằng VietQR. Quyền cập nhật tức thì, dùng tiếp ngay." },
];

const features = [
  { Icon: IconBolt, t: "Không lag Revit", d: "Kiểm tra quyền mỗi lệnh verify chữ ký cục bộ trong micro-giây — không gọi mạng, không khựng máy." },
  { Icon: IconWifiOff, t: "Chạy được offline", d: "Mất mạng vẫn làm việc trong thời gian ân hạn 7 ngày. Có mạng lại tự đồng bộ." },
  { Icon: IconShield, t: "Bản quyền an toàn", d: "Token ký bất đối xứng Ed25519, ràng buộc theo thiết bị. Thu hồi được khi hoàn tiền." },
  { Icon: IconDevices, t: "Quản lý thiết bị", d: "Mỗi giấy phép dùng 2 máy. Tự gỡ máy cũ trên web để giải phóng chỗ, kích hoạt máy mới." },
  { Icon: IconChart, t: "Thống kê sử dụng", d: "Biết tool nào dùng nhiều nhất, lệnh nào hay lỗi — dữ liệu thật để cải tiến công cụ." },
  { Icon: IconBell, t: "Nhắc gia hạn", d: "Email tự động nhắc trước 7/3/1 ngày khi giấy phép sắp hết hạn — không lo gián đoạn." },
];

const plans = [
  {
    code: "single",
    name: "Theo bộ môn",
    badge: null as string | null,
    priceMonth: "200.000đ",
    priceYear: "2.000.000đ",
    sub: "/ tháng cho 1 bộ môn",
    note: "Chọn riêng ARC, STR hoặc MEP. Mua năm tiết kiệm 2 tháng.",
    perks: ["1 bộ môn tuỳ chọn", "Dùng 2 thiết bị", "Cập nhật bản mới", "Hỗ trợ kỹ thuật qua email"],
    highlight: false,
  },
  {
    code: "combo",
    name: "Combo 3 bộ môn",
    badge: "Tiết kiệm nhất",
    priceMonth: "5.000.000đ",
    priceYear: "5.000.000đ",
    sub: "/ năm cho cả ARC + STR + MEP",
    note: "Trọn bộ công cụ cho team đa bộ môn. Rẻ hơn ~17% so với mua lẻ 3 gói năm.",
    perks: ["Cả 3 bộ môn ARC · STR · MEP", "Dùng 2 thiết bị", "Ưu tiên hỗ trợ", "Nhận tính năng mới sớm"],
    highlight: true,
  },
  {
    code: "trial",
    name: "Dùng thử",
    badge: "Miễn phí",
    priceMonth: "0đ",
    priceYear: "0đ",
    sub: "/ 30 ngày, đủ 3 bộ môn",
    note: "Tự kích hoạt khi đăng ký tài khoản mới ngay trong Revit. Không cần thẻ.",
    perks: ["Đủ 3 bộ môn 30 ngày", "Không cần thanh toán", "Trải nghiệm toàn bộ tool", "Chuyển sang gói trả phí bất cứ lúc nào"],
    highlight: false,
  },
];

const faqs = [
  { q: "Add-in hỗ trợ phiên bản Revit nào?", a: "Hỗ trợ Revit 2021, 2022, 2023 và 2024. Một lần cài dùng cho tất cả bộ môn anh/chị đã mua." },
  { q: "Dùng thử có cần nhập thẻ không?", a: "Không. Anh/chị chỉ cần đăng ký tài khoản ngay trong add-in, hệ thống tự kích hoạt 30 ngày dùng thử đủ 3 bộ môn." },
  { q: "Một giấy phép dùng được mấy máy?", a: "Mặc định 2 thiết bị mỗi giấy phép. Khi đổi máy, anh/chị vào bảng điều khiển web gỡ máy cũ để giải phóng chỗ rồi kích hoạt máy mới." },
  { q: "Mất mạng có dùng được không?", a: "Được. Add-in xác thực cục bộ nên vẫn chạy bình thường trong thời gian ân hạn 7 ngày khi offline; có mạng lại sẽ tự đồng bộ." },
  { q: "Thanh toán và gia hạn thế nào?", a: "Thanh toán bằng VietQR (chuyển khoản ngân hàng VN). Khi gia hạn, thời hạn được cộng dồn vào hạn hiện tại, không mất ngày còn lại." },
  { q: "Mua combo khi đang dùng thử thì sao?", a: "Số ngày trial còn lại được giữ nguyên và cộng thêm thời hạn gói mua — anh/chị không bị mất ngày nào." },
];

/* ---------- Small UI pieces ---------- */
function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight text-navy-900">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy-900 text-white">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 21h18M5 21V8l7-5 7 5v13" />
        </svg>
      </span>
      <span className="text-lg">RevitLicense</span>
    </Link>
  );
}

/* ---------- Page ---------- */
export default function Home() {
  return (
    <div className="min-h-screen bg-surface text-ink">
      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <div className="hidden items-center gap-8 text-sm font-medium text-navy-700 md:flex">
            <a href="#disciplines" className="transition-colors duration-200 hover:text-brand-600">Bộ môn</a>
            <a href="#how" className="transition-colors duration-200 hover:text-brand-600">Cách hoạt động</a>
            <a href="#pricing" className="transition-colors duration-200 hover:text-brand-600">Bảng giá</a>
            <a href="#faq" className="transition-colors duration-200 hover:text-brand-600">Hỏi đáp</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-navy-800 transition-colors duration-200 hover:bg-slate-100 sm:inline-block">
              Đăng nhập
            </Link>
            <Link href="/register" className="cursor-pointer rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-brand-700">
              Dùng thử miễn phí
            </Link>
          </div>
        </nav>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 left-1/2 h-96 w-[48rem] -translate-x-1/2 rounded-full bg-brand-200/40 blur-3xl" />
        </div>
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div className="animate-float-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              Trial 30 ngày · đủ 3 bộ môn · không cần thẻ
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-navy-900 sm:text-5xl">
              Bộ công cụ Revit cho <span className="text-brand-600">Kiến trúc · Kết cấu · Điện nước</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
              Tăng tốc dựng hình, rải thép, định tuyến MEP và bóc tách khối lượng ngay trong Revit.
              Mua theo từng bộ môn hoặc trọn combo — kích hoạt trong vài phút.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className="cursor-pointer rounded-xl bg-brand-600 px-6 py-3.5 text-center text-base font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-brand-700">
                Bắt đầu dùng thử 30 ngày
              </Link>
              <Link href="/buy" className="cursor-pointer rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-center text-base font-semibold text-navy-800 transition-colors duration-200 hover:bg-slate-50">
                Xem bảng giá
              </Link>
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-6">
              {[
                { k: "3", v: "bộ môn" },
                { k: "30", v: "ngày dùng thử" },
                { k: "2021–24", v: "Revit hỗ trợ" },
              ].map((s) => (
                <div key={s.v}>
                  <dt className="text-2xl font-extrabold text-navy-900">{s.k}</dt>
                  <dd className="text-sm text-muted">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Product mockup: Revit ribbon */}
          <div className="animate-float-up lg:justify-self-end">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-300/30">
              <div className="flex items-center gap-1.5 rounded-t-2xl border-b border-slate-200 bg-slate-50 px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-red-400" />
                <span className="h-3 w-3 rounded-full bg-amber-400" />
                <span className="h-3 w-3 rounded-full bg-green-400" />
                <span className="ml-3 text-xs font-medium text-slate-500">Autodesk Revit — Ribbon</span>
              </div>
              <div className="space-y-4 p-5">
                {disciplines.map((d) => (
                  <div key={d.code} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
                    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gradient-to-b ${d.accent}`}>
                      <d.Icon className="h-6 w-6" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-navy-900 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">{d.code}</span>
                        <span className="truncate text-sm font-semibold text-navy-900">{d.name}</span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted">{d.tools.join(" · ")}</p>
                    </div>
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-[11px] font-semibold text-green-700">
                      <IconCheck className="h-3 w-3" /> Active
                    </span>
                  </div>
                ))}
                <div className="rounded-lg bg-slate-50 px-4 py-3 text-center text-xs text-slate-500">
                  Quyền kiểm tra cục bộ · không gọi mạng mỗi lệnh
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-4 py-5 text-sm font-medium text-slate-500 sm:px-6">
          <span>Tương thích Revit 2021 · 2022 · 2023 · 2024</span>
          <span className="hidden h-4 w-px bg-slate-200 sm:block" />
          <span>Thanh toán VietQR</span>
          <span className="hidden h-4 w-px bg-slate-200 sm:block" />
          <span>Kích hoạt tức thì</span>
          <span className="hidden h-4 w-px bg-slate-200 sm:block" />
          <span>Hỗ trợ tiếng Việt</span>
        </div>
      </section>

      {/* DISCIPLINES */}
      <section id="disciplines" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-navy-900 sm:text-4xl">Ba bộ môn, một bộ add-in</h2>
          <p className="mt-4 text-lg text-muted">Mua riêng từng bộ môn anh/chị cần, hoặc trọn combo cho team đa ngành.</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {disciplines.map((d) => (
            <div key={d.code} className="group rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition-colors duration-200 hover:border-brand-300">
              <span className={`grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-b ${d.accent}`}>
                <d.Icon className="h-7 w-7" />
              </span>
              <div className="mt-5 flex items-center gap-2">
                <span className="rounded bg-navy-900 px-2 py-0.5 text-xs font-bold tracking-wide text-white">{d.code}</span>
                <h3 className="text-xl font-bold text-navy-900">{d.name}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted">{d.desc}</p>
              <ul className="mt-5 space-y-2">
                {d.tools.map((t) => (
                  <li key={t} className="flex items-center gap-2 text-sm text-navy-800">
                    <IconCheck className="h-4 w-4 text-brand-600" /> {t}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-navy-900 sm:text-4xl">Bắt đầu trong 4 bước</h2>
            <p className="mt-4 text-lg text-muted">Từ lúc cài đến lúc chạy lệnh đầu tiên chỉ mất vài phút.</p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <div key={s.n} className="relative rounded-2xl border border-slate-200 bg-surface p-6">
                <span className="text-3xl font-extrabold text-brand-200">{s.n}</span>
                <h3 className="mt-3 text-base font-bold text-navy-900">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-navy-900 sm:text-4xl">Thiết kế cho dân kỹ thuật</h2>
          <p className="mt-4 text-lg text-muted">Nhanh, ổn định, an toàn bản quyền — không làm phiền lúc anh/chị đang dựng mô hình.</p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.t} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <f.Icon className="h-6 w-6" />
              </span>
              <h3 className="mt-4 text-base font-bold text-navy-900">{f.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-navy-900 sm:text-4xl">Bảng giá minh bạch</h2>
            <p className="mt-4 text-lg text-muted">Charm pricing theo VND. Gia hạn cộng dồn, không mất ngày còn lại.</p>
          </div>
          <div className="mt-12 grid items-stretch gap-6 lg:grid-cols-3">
            {plans.map((p) => (
              <div
                key={p.code}
                className={`relative flex flex-col rounded-2xl border p-7 ${
                  p.highlight
                    ? "border-brand-500 bg-navy-900 text-white shadow-xl"
                    : "border-slate-200 bg-white shadow-sm"
                }`}
              >
                {p.badge && (
                  <span className={`absolute -top-3 left-7 rounded-full px-3 py-1 text-xs font-bold ${p.highlight ? "bg-brand-500 text-white" : "bg-navy-900 text-white"}`}>
                    {p.badge}
                  </span>
                )}
                <h3 className={`text-lg font-bold ${p.highlight ? "text-white" : "text-navy-900"}`}>{p.name}</h3>
                <div className="mt-4 flex items-end gap-1">
                  <span className={`text-3xl font-extrabold ${p.highlight ? "text-white" : "text-navy-900"}`}>
                    {p.code === "single" ? p.priceMonth : p.priceYear}
                  </span>
                </div>
                <p className={`mt-1 text-sm ${p.highlight ? "text-brand-100" : "text-muted"}`}>{p.sub}</p>
                {p.code === "single" && (
                  <p className="mt-1 text-xs text-muted">hoặc {p.priceYear} / năm (tiết kiệm 2 tháng)</p>
                )}
                <p className={`mt-4 text-sm leading-relaxed ${p.highlight ? "text-slate-200" : "text-muted"}`}>{p.note}</p>
                <ul className="mt-6 flex-1 space-y-3">
                  {p.perks.map((perk) => (
                    <li key={perk} className={`flex items-start gap-2 text-sm ${p.highlight ? "text-slate-100" : "text-navy-800"}`}>
                      <IconCheck className={`mt-0.5 h-4 w-4 shrink-0 ${p.highlight ? "text-brand-300" : "text-brand-600"}`} />
                      {perk}
                    </li>
                  ))}
                </ul>
                <Link
                  href={p.code === "trial" ? "/register" : "/buy"}
                  className={`mt-7 cursor-pointer rounded-xl px-5 py-3 text-center text-sm font-semibold transition-colors duration-200 ${
                    p.highlight
                      ? "bg-brand-500 text-white hover:bg-brand-400"
                      : "bg-brand-600 text-white hover:bg-brand-700"
                  }`}
                >
                  {p.code === "trial" ? "Dùng thử miễn phí" : "Chọn gói này"}
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-muted">Cần báo giá cho team / công ty? Liên hệ để có chính sách riêng.</p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-navy-900 sm:text-4xl">Câu hỏi thường gặp</h2>
        </div>
        <div className="mt-10 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
          {faqs.map((f) => (
            <details key={f.q} className="group px-6 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-navy-900">
                {f.q}
                <svg className="h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-navy-900 px-6 py-14 text-center sm:px-12">
          <div className="pointer-events-none absolute inset-0 -z-0 opacity-40">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-500/30 blur-3xl" />
            <div className="absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-brand-400/20 blur-3xl" />
          </div>
          <div className="relative">
            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Sẵn sàng tăng tốc công việc Revit?</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-slate-300">
              Đăng ký tài khoản và nhận ngay 30 ngày dùng thử đủ 3 bộ môn. Không cần thẻ, không ràng buộc.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/register" className="cursor-pointer rounded-xl bg-brand-500 px-6 py-3.5 text-base font-semibold text-white transition-colors duration-200 hover:bg-brand-400">
                Bắt đầu miễn phí
              </Link>
              <Link href="/buy" className="cursor-pointer rounded-xl border border-white/20 px-6 py-3.5 text-base font-semibold text-white transition-colors duration-200 hover:bg-white/10">
                Xem bảng giá
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <Logo />
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted">
            <a href="#disciplines" className="transition-colors duration-200 hover:text-brand-600">Bộ môn</a>
            <a href="#pricing" className="transition-colors duration-200 hover:text-brand-600">Bảng giá</a>
            <a href="#faq" className="transition-colors duration-200 hover:text-brand-600">Hỏi đáp</a>
            <Link href="/login" className="transition-colors duration-200 hover:text-brand-600">Đăng nhập</Link>
          </div>
          <p className="text-xs text-slate-400">© 2026 RevitLicense. Bản quyền add-in Revit.</p>
        </div>
      </footer>
    </div>
  );
}
