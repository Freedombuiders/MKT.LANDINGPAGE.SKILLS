import Image from "next/image";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Gift,
  GraduationCap,
  HeartHandshake,
  Laptop,
  MessageCircle,
  Mic2,
  ShieldCheck,
  Users,
  Video,
} from "lucide-react";
import { LeadForm } from "@/components/lead-form";
import { ParentFeedback } from "@/components/parent-feedback";
import { ClassroomVisuals } from "@/components/classroom-visuals";
import { PracticeAppShowcase } from "@/components/practice-app-showcase";
import { SiteEffects } from "@/components/site-effects";
import { InstructorProfile } from "@/components/instructor-profile";

const outcomes = [
  { icon: Mic2, title: "Phát âm chuẩn hơn", text: "Bé được giáo viên nghe và sửa phát âm trực tiếp trong mỗi buổi học." },
  { icon: MessageCircle, title: "Tự tin mở lời", text: "Mỗi bé có tối thiểu 2 lượt thực hành nói trong một nhóm nhỏ an toàn." },
  { icon: GraduationCap, title: "Học để dùng được", text: "Từ vựng và ngữ pháp ở trường được đưa vào các tình huống giao tiếp thực tế." },
];

const steps = [
  { title: "Kiểm tra đầu vào", text: "15 phút để hiểu trình độ hiện tại và xếp bé vào nhóm phù hợp lứa tuổi." },
  { title: "Ghép nhóm tối đa 6 bé", text: "Các bé có trình độ tương đồng, đủ bạn để tương tác nhưng không ai bị bỏ quên." },
  { title: "Học live 10 buổi qua Zoom", text: "Mỗi buổi 60–75 phút, hai buổi mỗi tuần, tập trung vào một chủ đề giao tiếp." },
  { title: "Luyện nói và sửa ngay tại chỗ", text: "Giáo viên gọi từng bé thực hành, sửa phát âm và giao bài luyện ngắn giữa các buổi." },
];

const faqs = [
  { question: "Bé nhà em học yếu tiếng Anh, có theo kịp lớp không?", answer: "Có. Trước khi xếp lớp, bé được kiểm tra trình độ đầu vào để vào đúng nhóm theo năng lực và lứa tuổi." },
  { question: "Nếu bé bận không học được một buổi thì sao?", answer: "Anh/chị chỉ cần báo trước. Giáo viên sẽ hỗ trợ phương án học bù hoặc gửi lại nội dung ghi hình để bé xem lại." },
  { question: "Phần mềm học trọn đời có mất phí về sau không?", answer: "Không. Đây là license sử dụng trọn đời để bé luyện nghe, nói và từ vựng tại nhà, không thu phí gia hạn định kỳ." },
  { question: "Học phí có thể chia thành hai lần thanh toán không?", answer: "Anh/chị vui lòng thanh toán theo số tiền hiện trên trang VietQR. Nếu cần chia đợt, hãy trao đổi với đội ngũ trước khi tạo đơn." },
];

function CtaButton({ label, className = "" }: { label: string; className?: string }) {
  return (
    <a href="#dang-ky" className={`cta-shine inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-orange-cta px-6 py-3.5 font-bold text-white shadow-[0_12px_28px_rgba(249,115,22,0.28)] transition-[transform,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:bg-orange-dark hover:shadow-[0_16px_34px_rgba(249,115,22,0.34)] active:translate-y-0 ${className}`}>
      {label}<ArrowRight aria-hidden="true" className="size-5" />
    </a>
  );
}

function SectionHeading({ eyebrow, title, description, align = "center" }: { eyebrow: string; title: string; description?: string; align?: "center" | "left" }) {
  return (
    <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-2xl"}>
      <p className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-sky-deep">{eyebrow}</p>
      <h2 className="text-balance text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl lg:text-[2.75rem]">{title}</h2>
      {description ? <p className="mt-4 text-pretty text-base leading-7 text-slate-600 sm:text-lg">{description}</p> : null}
    </div>
  );
}

export function SalesPage({ paymentAmount }: { paymentAmount: number }) {
  const paymentAmountLabel = new Intl.NumberFormat("vi-VN").format(paymentAmount);
  const isTestPayment = paymentAmount === 3_000;

  return (
    <main>
      <SiteEffects />
      <a href="#noi-dung-chinh" className="sr-only z-50 rounded bg-white px-4 py-3 font-semibold text-sky-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Đi tới nội dung chính</a>

      <header className="fixed left-4 right-4 top-4 z-50 mx-auto max-w-7xl">
        <nav aria-label="Điều hướng chính" className="flex min-h-16 items-center justify-between rounded-2xl border border-sky-100 bg-white/95 px-4 shadow-lg shadow-sky-950/5 backdrop-blur-md sm:px-6">
          <a href="#" className="flex cursor-pointer items-center gap-2.5 text-sky-ink">
            <span className="grid size-10 place-items-center rounded-xl bg-sky-brand text-white"><MessageCircle aria-hidden="true" className="size-5" /></span>
            <span className="font-heading text-lg font-semibold leading-none sm:text-xl">English Zoom Kids</span>
          </a>
          <div className="hidden items-center gap-7 text-sm font-semibold text-slate-600 lg:flex">
            <a className="cursor-pointer transition-colors hover:text-sky-deep" href="#khac-biet">Điểm khác biệt</a>
            <a className="cursor-pointer transition-colors hover:text-sky-deep" href="#lo-trinh">Lộ trình</a>
            <a className="cursor-pointer transition-colors hover:text-sky-deep" href="#hoc-phi">Học phí</a>
          </div>
          <CtaButton label="Đăng ký & thanh toán" className="hidden sm:inline-flex" />
          <a href="#dang-ky" aria-label="Đi đến biểu mẫu đăng ký" className="grid size-11 cursor-pointer place-items-center rounded-full bg-orange-cta text-white transition-colors hover:bg-orange-dark sm:hidden"><ArrowRight aria-hidden="true" className="size-5" /></a>
        </nav>
      </header>

      <section id="noi-dung-chinh" className="relative overflow-hidden bg-sky-wash pb-16 pt-32 sm:pb-24 sm:pt-36">
        <div className="hero-grid absolute inset-0" aria-hidden="true" />
        <div className="absolute -left-28 top-40 size-80 rounded-full bg-sky-200/40 blur-3xl" aria-hidden="true" />
        <div className="absolute -right-20 top-16 size-96 rounded-full bg-orange-100/60 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:gap-14">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-bold text-sky-ink shadow-sm"><BadgeCheck aria-hidden="true" className="size-4 text-sky-brand" />Nhóm nhỏ tối đa 6 bé · Học live qua Zoom</div>
            <h1 className="text-balance text-[2.7rem] font-semibold leading-[1.04] tracking-[-0.025em] text-slate-950 sm:text-6xl lg:text-[4.15rem]">Lớp càng đông, <span className="text-sky-deep">con càng im lặng.</span></h1>
            <p className="mt-6 max-w-2xl text-pretty text-lg leading-8 text-slate-700 sm:text-xl">Trong nhóm tối đa 6 bé, con có thời gian thực sự để mở lời, được sửa phát âm và xây phản xạ giao tiếp — ngay tại nhà, không cần đưa đón.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <CtaButton label="Đăng ký & thanh toán ngay" />
              <a href="#lo-trinh" className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full px-5 py-3 font-bold text-sky-ink transition-colors duration-200 hover:bg-white"><Video aria-hidden="true" className="size-5" />Xem cách lớp học vận hành</a>
            </div>
            <div className="mt-8 grid gap-3 text-sm text-slate-700 sm:grid-cols-3">
              {["10 buổi / khoảng 5 tuần", "Học thử 2 buổi", "Hoàn 100% nếu không hợp"].map((item) => <div key={item} className="flex items-start gap-2"><CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-600" /><span className="font-semibold">{item}</span></div>)}
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-2xl lg:max-w-none">
            <div className="soft-shadow relative aspect-[1.52/1] overflow-hidden rounded-[2rem] border-[7px] border-white bg-white">
              <Image src="/hero-zoom-class.webp" alt="Bé tự tin giơ tay phát biểu trong lớp tiếng Anh trực tuyến nhóm nhỏ" fill priority sizes="(max-width: 1024px) 100vw, 54vw" className="object-cover" />
            </div>
            <div className="float-slow card-shadow absolute -bottom-7 left-3 flex items-center gap-3 rounded-2xl border border-sky-100 bg-white px-4 py-3 sm:left-8 sm:px-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-dark"><Mic2 aria-hidden="true" className="size-5" /></span>
              <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Mỗi buổi học</p><p className="font-heading text-base font-semibold text-slate-950 sm:text-lg">Mỗi bé ≥ 2 lượt nói</p></div>
            </div>
            <div className="card-shadow absolute -right-2 -top-6 hidden items-center gap-3 rounded-2xl border border-sky-100 bg-white px-5 py-3 sm:flex lg:-right-6">
              <span className="grid size-11 place-items-center rounded-xl bg-sky-100 text-sky-deep"><Laptop aria-hidden="true" className="size-5" /></span>
              <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Học tại nhà</p><p className="font-heading text-lg font-semibold text-slate-950">Không cần đưa đón</p></div>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Thông tin khóa học" className="border-y border-sky-100 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-y divide-sky-100 px-5 sm:grid-cols-4 sm:divide-y-0 sm:px-8">
          {[{ value: "≤ 6 bé", label: "mỗi lớp" }, { value: "10 buổi", label: "học trực tiếp" }, { value: "60–75'", label: "mỗi buổi" }, { value: "14 ngày", label: "cam kết hoàn phí" }].map((stat) => <div key={stat.label} className="px-3 py-7 text-center sm:py-9"><p className="font-heading text-2xl font-semibold text-sky-deep sm:text-3xl">{stat.value}</p><p className="mt-1 text-sm font-medium text-slate-500">{stat.label}</p></div>)}
        </div>
      </section>

      <section id="khac-biet" className="bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SectionHeading eyebrow="Vấn đề không nằm ở sự cố gắng của con" title="Con khó tiến bộ khi cả buổi chỉ có cơ hội nói 1–2 câu" description="Một lớp đông có thể truyền đạt kiến thức, nhưng rất khó tạo đủ lượt luyện nói và phản hồi riêng cho từng bé." />
          <div className="mt-12 grid overflow-hidden rounded-[2rem] border border-sky-100 bg-slate-50 lg:grid-cols-2">
            <div className="p-7 sm:p-10"><p className="mb-6 inline-flex rounded-full bg-slate-200 px-3 py-1 text-sm font-bold text-slate-700">Trước đây</p><ul className="space-y-5">
              {["Học nhiều năm nhưng vẫn ngại nói một câu tiếng Anh tự nhiên", "Ngồi im trong lớp 20–30 bé, ít khi được gọi và sửa phát âm", "Mệt sau giờ học vì di chuyển, ba mẹ mất thêm thời gian chờ đón"].map((item) => <li key={item} className="flex gap-3 text-slate-600"><span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full bg-slate-400" /><span>{item}</span></li>)}
            </ul></div>
            <div className="bg-sky-deep p-7 text-white sm:p-10"><p className="mb-6 inline-flex rounded-full bg-white/15 px-3 py-1 text-sm font-bold text-sky-50">Mục tiêu sau 10 buổi</p><ul className="space-y-5">
              {["Nói được 10–15 câu giao tiếp cơ bản theo tình huống", "Được gọi thực hành và nhận phản hồi trực tiếp trong từng buổi", "Học ngay tại nhà, có ebook và phần mềm để luyện thêm chủ động"].map((item) => <li key={item} className="flex gap-3 text-sky-50"><Check aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-orange-300" /><span>{item}</span></li>)}
            </ul></div>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {outcomes.map(({ icon: Icon, title, text }) => <article key={title} className="card-shadow rounded-3xl border border-sky-100 bg-white p-7 transition-colors duration-200 hover:border-sky-300"><span className="grid size-12 place-items-center rounded-2xl bg-sky-wash text-sky-deep"><Icon aria-hidden="true" className="size-6" /></span><h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3><p className="mt-2 leading-7 text-slate-600">{text}</p></article>)}
          </div>
        </div>
      </section>

      <section id="lo-trinh" className="bg-sky-wash py-20 sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start"><SectionHeading align="left" eyebrow="Phương pháp lớp nhỏ tương tác trực tiếp" title="Một lộ trình đơn giản, để con có cơ hội nói thật" description="Không chạy theo số lượng học viên. Mỗi bước đều nhằm bảo đảm bé được học đúng trình độ và nhận phản hồi đủ thường xuyên." /><CtaButton label="Đăng ký khóa học" className="mt-7" /></div>
          <ol className="relative space-y-5 before:absolute before:bottom-10 before:left-7 before:top-10 before:w-px before:bg-sky-200">
            {steps.map((step, index) => <li key={step.title} className="card-shadow relative flex gap-5 rounded-3xl border border-sky-100 bg-white p-6 sm:p-8"><span className="relative z-10 grid size-14 shrink-0 place-items-center rounded-2xl bg-sky-deep font-heading text-xl font-semibold text-white">{String(index + 1).padStart(2, "0")}</span><div><h3 className="text-xl font-semibold text-slate-950 sm:text-2xl">{step.title}</h3><p className="mt-2 leading-7 text-slate-600">{step.text}</p></div></li>)}
          </ol>
        </div>
      </section>

      <ClassroomVisuals />

      <InstructorProfile />

      <section className="bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SectionHeading eyebrow="Bé có phù hợp không?" title="Thiết kế cho hai giai đoạn quan trọng của việc học tiếng Anh" />
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <article className="rounded-[2rem] border border-sky-100 bg-sky-wash p-7 sm:p-9"><span className="grid size-12 place-items-center rounded-2xl bg-white text-sky-deep shadow-sm"><BookOpen aria-hidden="true" className="size-6" /></span><h3 className="mt-6 text-2xl font-semibold text-slate-950">Bé Tiểu học · Lớp 1–5</h3><p className="mt-3 leading-7 text-slate-600">Xây nền tảng phát âm và phản xạ nghe nói từ sớm qua trò chơi, tình huống và tương tác trực tiếp.</p></article>
            <article className="rounded-[2rem] border border-orange-100 bg-orange-50 p-7 sm:p-9"><span className="grid size-12 place-items-center rounded-2xl bg-white text-orange-dark shadow-sm"><GraduationCap aria-hidden="true" className="size-6" /></span><h3 className="mt-6 text-2xl font-semibold text-slate-950">Bé THCS · Lớp 6–9</h3><p className="mt-3 leading-7 text-slate-600">Củng cố nền tảng đã học ở trường và luyện phản xạ giao tiếp trong một nhóm nhỏ không sợ bị chê cười.</p></article>
          </div>
          <p className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-center text-sm leading-6 text-slate-600">Chương trình không dành cho bé dưới 6 tuổi, nhu cầu luyện thi IELTS/TOEFL/Cambridge chuyên sâu hoặc lớp 1-kèm-1 riêng hoàn toàn.</p>
        </div>
      </section>

      <PracticeAppShowcase />

      <ParentFeedback />

      <section id="hoc-phi" className="bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <SectionHeading eyebrow="Một lựa chọn duy nhất, không rối gói" title="Trọn lộ trình 10 buổi cùng toàn bộ quà tặng" description="Anh/chị biết rõ bé nhận gì, học trong bao lâu và được bảo vệ bởi chính sách học thử." />
          <div className="soft-shadow relative mx-auto mt-12 max-w-4xl overflow-hidden rounded-[2rem] border-2 border-sky-brand bg-white">
            <div className="bg-sky-deep px-6 py-3 text-center text-sm font-bold uppercase tracking-[0.12em] text-white">Trọn gói được đề xuất</div>
            <div className="grid gap-9 p-7 sm:p-10 lg:grid-cols-[1.15fr_0.85fr] lg:p-12">
              <div><p className="font-heading text-2xl font-semibold text-slate-950 sm:text-3xl">English Zoom Kids · 10 buổi</p><ul className="mt-7 space-y-4">
                {["10 buổi học live qua Zoom, 60–75 phút/buổi", "Nhóm tối đa 6 bé, xếp theo trình độ tương đồng", "Mỗi bé được gọi thực hành và sửa phát âm trực tiếp", "Trọn bộ ebook theo từng buổi học", "Phần mềm học tiếng Anh trọn đời"].map((item) => <li key={item} className="flex gap-3 text-slate-700"><CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-emerald-600" /><span>{item}</span></li>)}
              </ul></div>
              <div className="rounded-3xl bg-sky-wash p-6 text-center sm:p-8"><p className="text-sm font-semibold text-slate-500">Tổng giá trị</p><p className="mt-1 text-xl font-bold text-slate-500 line-through">7.800.000đ</p><p className="mt-4 text-sm font-bold uppercase tracking-wider text-sky-deep">Giá thanh toán hiện tại</p><p className="font-heading text-5xl font-semibold tracking-tight text-slate-950">{paymentAmountLabel}đ</p><p className="mt-2 text-sm font-semibold text-emerald-700">{isTestPayment ? "Giá thật đang dùng để kiểm thử thanh toán" : "Thanh toán một lần qua VietQR"}</p><CtaButton label="Giữ một suất cho bé" className="mt-6 w-full px-4" /><p className="mt-3 text-xs leading-5 text-slate-500">Hệ thống xác nhận tự động ngay khi tiền vào tài khoản</p></div>
            </div>
          </div>
          <div className="mx-auto mt-8 flex max-w-3xl flex-col items-center gap-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-7 text-center sm:flex-row sm:text-left"><span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white text-emerald-700 shadow-sm"><ShieldCheck aria-hidden="true" className="size-7" /></span><div><h3 className="text-xl font-semibold text-emerald-950">Học thử 2 buổi, hoàn 100% nếu không phù hợp</h3><p className="mt-1 leading-7 text-emerald-800">Trong 14 ngày đầu, nếu bé không hứng thú hoặc không phù hợp, anh/chị được hoàn lại toàn bộ học phí, không hỏi khó.</p></div></div>
        </div>
      </section>

      <section className="bg-slate-50 py-20 sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.75fr_1.25fr]">
          <div><SectionHeading align="left" eyebrow="Câu hỏi thường gặp" title="Những điều phụ huynh thường muốn biết" /><div className="mt-7 flex items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-orange-950"><CalendarDays aria-hidden="true" className="size-5 shrink-0 text-orange-dark" /><p className="text-sm font-semibold">Lớp mở theo đợt để bảo đảm mỗi nhóm không vượt quá 6 bé.</p></div></div>
          <div className="space-y-3">{faqs.map((faq, index) => <details key={faq.question} className="group rounded-2xl border border-slate-200 bg-white p-5 open:border-sky-300 sm:p-6" open={index === 0}><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-bold text-slate-950"><span>{faq.question}</span><ChevronDown aria-hidden="true" className="size-5 shrink-0 text-sky-deep transition-transform duration-200 group-open:rotate-180" /></summary><p className="mt-3 max-w-3xl border-t border-slate-100 pt-4 leading-7 text-slate-600">{faq.answer}</p></details>)}</div>
        </div>
      </section>

      <section id="dang-ky" className="relative overflow-hidden bg-sky-wash py-20 sm:py-28">
        <div className="absolute -left-28 bottom-0 size-80 rounded-full bg-sky-200/60 blur-3xl" aria-hidden="true" /><div className="absolute -right-28 top-0 size-80 rounded-full bg-orange-100/70 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div><p className="text-sm font-bold uppercase tracking-[0.16em] text-sky-deep">Đăng ký và thanh toán ngay</p><h2 className="mt-3 text-balance text-4xl font-semibold leading-tight text-slate-950 sm:text-5xl">Giữ suất cho bé bằng VietQR</h2><p className="mt-5 text-lg leading-8 text-slate-600">Điền đúng ba thông tin, hệ thống tạo mã đơn và chuyển anh/chị sang trang thanh toán VietinBank. Khi tiền vào, đơn được xác nhận tự động.</p><div className="mt-8 space-y-4">
            {[{ icon: Clock3, text: "Tạo mã VietQR ngay sau khi đăng ký" }, { icon: Users, text: "Giữ thông tin để xếp nhóm phù hợp" }, { icon: HeartHandshake, text: "Tự động xác nhận khi thanh toán thành công" }].map(({ icon: Icon, text }) => <div key={text} className="flex items-center gap-3 font-semibold text-slate-700"><span className="grid size-10 place-items-center rounded-xl bg-white text-sky-deep shadow-sm"><Icon aria-hidden="true" className="size-5" /></span><span>{text}</span></div>)}
          </div></div>
          <div className="soft-shadow rounded-[2rem] border border-sky-100 bg-white p-6 sm:p-9"><div className="flex items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl bg-orange-100 text-orange-dark"><Gift aria-hidden="true" className="size-6" /></span><div><p className="font-heading text-2xl font-semibold text-slate-950">Đăng ký khóa học</p><p className="text-sm text-slate-500">Thanh toán hiện tại: {paymentAmountLabel}đ</p></div></div><LeadForm paymentAmount={paymentAmount} /></div>
        </div>
      </section>

      <footer className="bg-slate-950 pb-28 pt-12 text-slate-300 sm:pb-12"><div className="mx-auto flex max-w-7xl flex-col gap-7 px-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-sky-brand text-white"><MessageCircle aria-hidden="true" className="size-5" /></span><div><p className="font-heading text-xl font-semibold text-white">English Zoom Kids</p><p className="text-sm text-slate-400">Con tự tin nói, ba mẹ không cần đưa đón.</p></div></div><p className="max-w-xl text-sm leading-6 text-slate-400">Kết quả học tập phụ thuộc vào trình độ đầu vào, mức độ tham gia và việc luyện tập của từng bé. Chương trình đặt mục tiêu hỗ trợ, không cam kết mọi học viên đạt kết quả giống nhau.</p></div></footer>
      <div className="fixed bottom-3 left-3 right-3 z-40 sm:hidden"><CtaButton label="Đăng ký & thanh toán" className="w-full border border-orange-300" /></div>
    </main>
  );
}
