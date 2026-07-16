// app/api/affiliate/click/route.ts
//
// Public endpoint — nhận beacon đếm click link aff từ AffiliateTracker.
// Không auth, luôn trả 200. Click tracking không quan trọng tới mức báo lỗi.

import { recordClick } from "@/lib/affiliate";

export const dynamic = "force-dynamic";

type ClickBody = {
  code?: string;
  path?: string;
  referrer?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ClickBody;
    if (body.code) {
      await recordClick({
        affCode: body.code,
        path: body.path,
        referrer: body.referrer,
      });
    }
  } catch {
    // navigator.sendBeacon gửi body dạng Blob — nếu parse fail thì bỏ qua.
  }
  return Response.json({ ok: true });
}
