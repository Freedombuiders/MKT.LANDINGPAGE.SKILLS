import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "vietqr.app",
        pathname: "/img**",
      },
    ],
  },
};

export default nextConfig;
