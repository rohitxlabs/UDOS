import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Enables next/navigation's forbidden(), which lib/auth/dal.ts uses to
    // answer a page request the caller has no permission for with a real
    // 403 (rendered by app/forbidden.tsx) instead of a crashed route.
    authInterrupts: true,
  },
};

export default nextConfig;
