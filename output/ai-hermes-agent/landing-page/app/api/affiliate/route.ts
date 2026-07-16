// app/api/affiliate/route.ts
//
// Portal data endpoint cho đối tác. POST {code, email} → verify cặp khớp →
// trả dashboard (link, click, đơn giới thiệu, hoa hồng theo trạng thái).
//
// "Đăng nhập" = cặp aff_code + email. aff_code công khai trên link nên email
// đóng vai lớp khoá cơ bản — đủ cho quy mô landing page, không cần session.

import { getAffiliatePortalData, verifyAffiliateLogin } from "@/lib/affiliate";

export const dynamic = "force-dynamic";

type LoginBody = {
  code?: string;
  email?: string;
};

export async function POST(request: Request) {
  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const code = (body.code ?? "").trim();
  const email = (body.email ?? "").trim();
  if (!code || !email) {
    return Response.json({ error: "missing_credentials" }, { status: 400 });
  }

  const affiliate = await verifyAffiliateLogin(code, email);
  if (!affiliate) {
    return Response.json({ error: "invalid_credentials" }, { status: 401 });
  }

  try {
    const data = await getAffiliatePortalData(affiliate);
    return Response.json(data);
  } catch (err) {
    console.error("[/api/affiliate]", err);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
