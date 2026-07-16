import { ok, err } from "@/lib/http";
import { getPublicKeyPem } from "@/lib/signing";

export const runtime = "nodejs";

/**
 * GET /api/public-key
 * Trả public key Ed25519 (PEM SPKI) + kid để add-in / dev verify token offline.
 * Công khai — chỉ chứa PUBLIC key, không lộ secret.
 */
export async function GET() {
  try {
    const { kid, publicKeyPem } = getPublicKeyPem();
    return ok({ kid, public_key_pem: publicKeyPem });
  } catch {
    return err("INTERNAL", "Chưa cấu hình khóa ký (ED25519_PRIVATE_KEY).");
  }
}
