// The R2/CDN host for uploaded listing photos (BUILD-SPEC-PR5 §2), derived
// from the same env var `lib/media/url.ts` reads at render time — next/image
// needs remote hosts allow-listed at BUILD time, so this has to be computed
// here rather than passed in some other way. Unset (R2 not configured yet) →
// no extra pattern; the app still boots and serves normally.
const mediaHost = (() => {
  const base = process.env.NEXT_PUBLIC_MEDIA_BASE_URL;
  if (!base) return undefined;
  try {
    return new URL(base).hostname;
  } catch {
    return undefined;
  }
})();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standard Hostinger Node.js Web App: `next build` / `next start`.
  // NEVER use output: 'export' — this site is server-rendered.
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: {
    // Linting runs as its own CI step; never block production builds on it.
    ignoreDuringBuilds: true,
  },
  images: {
    // Seed assets are first-party local SVGs; allow next/image to serve them.
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: mediaHost ? [{ protocol: 'https', hostname: mediaHost }] : [],
  },
};

export default nextConfig;
