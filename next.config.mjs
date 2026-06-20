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
    // Remote patterns only matter once the CMS serves uploaded images.
    remotePatterns: [
      { protocol: 'https', hostname: 'panel.negocio.com.py' },
    ],
  },
};

export default nextConfig;
