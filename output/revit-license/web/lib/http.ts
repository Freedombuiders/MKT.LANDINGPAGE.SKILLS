import { NextResponse } from "next/server";

/**
 * Mã lỗi chuẩn trả về cho add-in / web (xem module 02 plan).
 */
export type ApiErrorCode =
  | "UNAUTHENTICATED" // 401
  | "DEVICE_LIMIT" // 403
  | "REVOKED" // 403
  | "TRIAL_USED" // 409
  | "NO_ENTITLEMENT" // 200 allowed=false
  | "BAD_REQUEST" // 400
  | "NOT_FOUND" // 404
  | "INTERNAL"; // 500

const STATUS: Record<ApiErrorCode, number> = {
  UNAUTHENTICATED: 401,
  DEVICE_LIMIT: 403,
  REVOKED: 403,
  TRIAL_USED: 409,
  NO_ENTITLEMENT: 200,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  INTERNAL: 500,
};

export function ok<T extends Record<string, unknown>>(data: T, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status });
}

export function err(code: ApiErrorCode, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { ok: false, code, message, ...(extra || {}) },
    { status: STATUS[code] }
  );
}

export function unauthenticated() {
  return err("UNAUTHENTICATED", "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.");
}

/** Đọc JSON body an toàn, trả null nếu lỗi parse. */
export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
