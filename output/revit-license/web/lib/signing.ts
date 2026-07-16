import {
  createPrivateKey,
  createPublicKey,
  sign as nodeSign,
  verify as nodeVerify,
  randomUUID,
  KeyObject,
} from "crypto";

/**
 * Ký entitlement token bằng Ed25519 (EdDSA) dùng Node 'crypto'.
 *
 * Token có dạng JWT compact: base64url(header).base64url(payload).base64url(signature)
 *   header  = { alg: "EdDSA", kid }
 *   payload = { sub, device, disciplines, plan, iat, exp, grace_until, jti }
 *
 * Add-in C# chỉ cần PUBLIC KEY (cùng kid) để verify offline — không giữ private key.
 *
 * Env:
 *   ED25519_PRIVATE_KEY      PEM PKCS#8 (cho phép xuống dòng thật hoặc escape '\n')
 *   ED25519_PUBLIC_KEY_ID    kid (vd 'k1') — add-in chọn đúng public key khi xoay khóa
 *   ED25519_PUBLIC_KEY       (tuỳ chọn) PEM SPKI public key — nếu không có sẽ tự suy ra từ private key
 *   ENTITLEMENT_TTL_SECONDS  exp = iat + TTL  (mặc định 86400 = 24h)
 *   ENTITLEMENT_GRACE_SECONDS grace_until = iat + GRACE (mặc định 604800 = 7 ngày)
 */

export type EntitlementPayload = {
  sub: string;
  device: string;
  disciplines: string[];
  plan: string;
  iat: number;
  exp: number;
  grace_until: number;
  jti: string;
};

type EntitlementHeader = {
  alg: "EdDSA";
  kid: string;
};

// ---------------------------------------------------------------------------
// base64url helpers
// ---------------------------------------------------------------------------
function b64urlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}

// ---------------------------------------------------------------------------
// Key loading (cache trong module scope cho serverless warm instance)
// ---------------------------------------------------------------------------
let _privateKey: KeyObject | null = null;
let _publicKey: KeyObject | null = null;

function normalizePem(raw: string): string {
  // Cho phép env lưu PEM dạng 1 dòng với '\n' đã escape.
  return raw.includes("-----BEGIN") && raw.includes("\\n")
    ? raw.replace(/\\n/g, "\n")
    : raw;
}

function getPrivateKey(): KeyObject {
  if (_privateKey) return _privateKey;
  const raw = process.env.ED25519_PRIVATE_KEY;
  if (!raw) {
    throw new Error("Thiếu ED25519_PRIVATE_KEY trong env (PEM PKCS#8).");
  }
  _privateKey = createPrivateKey({ key: normalizePem(raw), format: "pem" });
  return _privateKey;
}

function getPublicKey(): KeyObject {
  if (_publicKey) return _publicKey;
  const rawPub = process.env.ED25519_PUBLIC_KEY;
  if (rawPub && rawPub.trim()) {
    _publicKey = createPublicKey({ key: normalizePem(rawPub), format: "pem" });
  } else {
    // Suy ra public key trực tiếp từ private key.
    _publicKey = createPublicKey(getPrivateKey());
  }
  return _publicKey;
}

function getKid(): string {
  return process.env.ED25519_PUBLIC_KEY_ID || "k1";
}

function ttlSeconds(): number {
  const v = parseInt(process.env.ENTITLEMENT_TTL_SECONDS || "", 10);
  return Number.isFinite(v) && v > 0 ? v : 86400;
}

function graceSeconds(): number {
  const v = parseInt(process.env.ENTITLEMENT_GRACE_SECONDS || "", 10);
  return Number.isFinite(v) && v > 0 ? v : 604800;
}

// ---------------------------------------------------------------------------
// Sign
// ---------------------------------------------------------------------------
export function signEntitlement(input: {
  sub: string;
  device: string;
  disciplines: string[];
  plan: string;
}): { token: string; kid: string; exp: number; grace_until: number } {
  const kid = getKid();
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + ttlSeconds();
  const grace_until = iat + graceSeconds();

  const header: EntitlementHeader = { alg: "EdDSA", kid };
  const payload: EntitlementPayload = {
    sub: input.sub,
    device: input.device,
    disciplines: input.disciplines,
    plan: input.plan,
    iat,
    exp,
    grace_until,
    jti: randomUUID(),
  };

  const signingInput =
    b64urlEncode(JSON.stringify(header)) +
    "." +
    b64urlEncode(JSON.stringify(payload));

  // Ed25519: thuật toán phải là null (Node tự dùng EdDSA theo key).
  const signature = nodeSign(null, Buffer.from(signingInput, "utf8"), getPrivateKey());
  const token = signingInput + "." + b64urlEncode(signature);

  return { token, kid, exp, grace_until };
}

// ---------------------------------------------------------------------------
// Verify (chỉ structure + chữ ký; KHÔNG enforce exp ở đây)
// ---------------------------------------------------------------------------
export function verifyEntitlement(token: string): EntitlementPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [h, p, s] = parts;

    const header = JSON.parse(b64urlDecode(h).toString("utf8")) as EntitlementHeader;
    if (!header || header.alg !== "EdDSA") return null;

    const signingInput = h + "." + p;
    const signature = b64urlDecode(s);
    const valid = nodeVerify(
      null,
      Buffer.from(signingInput, "utf8"),
      getPublicKey(),
      signature
    );
    if (!valid) return null;

    const payload = JSON.parse(b64urlDecode(p).toString("utf8")) as EntitlementPayload;
    if (
      !payload ||
      typeof payload.sub !== "string" ||
      typeof payload.device !== "string" ||
      !Array.isArray(payload.disciplines)
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public key PEM (để add-in / dev tải verify key)
// ---------------------------------------------------------------------------
export function getPublicKeyPem(): { kid: string; publicKeyPem: string } {
  const publicKeyPem = getPublicKey()
    .export({ type: "spki", format: "pem" })
    .toString();
  return { kid: getKid(), publicKeyPem };
}
