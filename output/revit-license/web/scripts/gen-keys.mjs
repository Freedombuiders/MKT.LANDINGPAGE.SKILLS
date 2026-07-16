#!/usr/bin/env node
/**
 * gen-keys.mjs — Sinh cặp khóa Ed25519 cho hệ thống License Revit Add-in.
 *
 * Cách chạy:   node scripts/gen-keys.mjs
 *
 * Không cần cài thêm package — chỉ dùng module 'crypto' của Node.
 *
 * Script in ra:
 *   1) ED25519_PRIVATE_KEY  — PEM PKCS#8 ép về 1 dòng với '\n' (paste thẳng vào Vercel env).
 *   2) Public key PEM (SPKI) — nhúng vào add-in C# để verify token offline.
 *   3) ED25519_PUBLIC_KEY_ID=k1 — kid mặc định.
 *
 * BẢO MẬT: private key chỉ đặt trong Vercel env (server). KHÔNG commit, KHÔNG đưa vào add-in.
 */

import { generateKeyPairSync } from "crypto";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");

const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();

// Ép private PEM về 1 dòng (escape newline) cho Vercel env single-line.
const privateOneLine = privatePem.trimEnd().replace(/\n/g, "\\n");

const line = "=".repeat(72);

console.log(line);
console.log("ED25519 KEYPAIR — Revit License System");
console.log(line);
console.log("");
console.log("[1] Dán vào Vercel env (Settings > Environment Variables):");
console.log("");
console.log("ED25519_PUBLIC_KEY_ID=k1");
console.log(`ED25519_PRIVATE_KEY=${privateOneLine}`);
console.log("");
console.log(line);
console.log("[2] Nhúng PUBLIC KEY này vào add-in C# (verify token offline):");
console.log("    (cũng được expose qua GET /api/public-key)");
console.log("");
console.log(publicPem.trimEnd());
console.log("");
console.log(line);
console.log("LƯU Ý: KHÔNG commit private key. Chỉ đặt trong Vercel env (server).");
console.log("       Khi xoay khóa: tăng kid (k2, k3...) và cập nhật public key trong add-in.");
console.log(line);
