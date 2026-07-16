import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function checkAdmin(req: Request): boolean {
  const expected = process.env.ADMIN_PASSWORD || "123456";
  return req.headers.get("x-admin-pass") === expected;
}

/**
 * GET /api/admin/campaigns
 * Liệt kê chiến dịch email + nhật ký gửi gần đây.
 */
export async function GET(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ ok: false, message: "Không có quyền." }, { status: 401 });
  }

  const db = supabaseAdmin();
  try {
    const { data: campaigns } = await db
      .from("email_campaigns")
      .select("id, name, subject, body_kind, audience, status, created_at, sent_at")
      .order("created_at", { ascending: false })
      .limit(50);

    const { data: logs } = await db
      .from("email_logs")
      .select("id, campaign_id, type, to_email, status, error, sent_at")
      .order("sent_at", { ascending: false })
      .limit(200);

    return NextResponse.json({
      ok: true,
      campaigns: campaigns || [],
      logs: logs || [],
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: "Lỗi tải chiến dịch.", detail: String(e) },
      { status: 500 }
    );
  }
}

type PostBody = {
  name?: string;
  subject?: string;
  body_html?: string;
  body_kind?: "text" | "html";
  audience?: string;
};

const AUDIENCES = ["all", "trial", "paid", "expired", "expiring_7d"];

/**
 * POST /api/admin/campaigns
 * Tạo bản nháp chiến dịch (status='draft'). Việc gửi do /api/send-campaign (module email) xử lý.
 */
export async function POST(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ ok: false, message: "Không có quyền." }, { status: 401 });
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ ok: false, message: "Body không hợp lệ." }, { status: 400 });
  }

  const name = (body.name || "").trim();
  const subject = (body.subject || "").trim();
  const bodyHtml = body.body_html || "";
  const bodyKind = body.body_kind === "html" ? "html" : "text";
  const audience = AUDIENCES.includes(body.audience || "") ? body.audience! : "all";

  if (!name || !subject || !bodyHtml.trim()) {
    return NextResponse.json(
      { ok: false, message: "Cần nhập tên, tiêu đề và nội dung chiến dịch." },
      { status: 400 }
    );
  }

  const db = supabaseAdmin();
  try {
    const { data, error } = await db
      .from("email_campaigns")
      .insert({
        name,
        subject,
        body_html: bodyHtml,
        body_kind: bodyKind,
        audience,
        status: "draft",
        created_at: new Date().toISOString(),
      })
      .select("id, name, subject, body_kind, audience, status, created_at")
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, message: "Không tạo được chiến dịch." },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, campaign: data });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: "Lỗi tạo chiến dịch.", detail: String(e) },
      { status: 500 }
    );
  }
}
