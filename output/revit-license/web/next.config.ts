import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Add-in desktop client gọi thẳng các route /api/* nên không cần CORS.
  // Mọi route license/payment/telemetry dùng Node runtime (Ed25519) khai trong từng route.
};

export default nextConfig;
