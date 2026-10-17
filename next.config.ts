import type { NextConfig } from "next";

function apiRemotePatterns() {
  const patterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [
    { protocol: "https", hostname: "cdn.shopify.com", pathname: "/**" },
    { protocol: "https", hostname: "eu2.contabostorage.com", pathname: "/**" },
    { protocol: "https", hostname: "sin1.contabostorage.com", pathname: "/**" },
    { protocol: "https", hostname: "usc1.contabostorage.com", pathname: "/**" },
    {
      protocol: "http",
      hostname: "localhost",
      port: "3003",
      pathname: "/uploads/**",
    },
    {
      protocol: "http",
      hostname: "127.0.0.1",
      port: "3003",
      pathname: "/uploads/**",
    },
    {
      protocol: "http",
      hostname: "localhost",
      port: "4003",
      pathname: "/uploads/**",
    },
    {
      protocol: "http",
      hostname: "127.0.0.1",
      port: "4003",
      pathname: "/uploads/**",
    },
  ];

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl) {
    try {
      const u = new URL(apiUrl);
      patterns.push({
        protocol: u.protocol.replace(":", "") as "http" | "https",
        hostname: u.hostname,
        ...(u.port ? { port: u.port } : {}),
        pathname: "/uploads/**",
      });
    } catch {
      /* ignore invalid URL */
    }
  }

  const extraHost = process.env.NEXT_PUBLIC_API_HOST;
  if (extraHost) {
    patterns.push({
      protocol: "https",
      hostname: extraHost,
      pathname: "/uploads/**",
    });
  }

  return patterns;
}

const nextConfig: NextConfig = {
  // Tailwind is atomic/compact — inlining removes the CSS request waterfall
  // that PSI flags as render-blocking (~1s on mobile). Production / ISR only.
  experimental: {
    inlineCss: true,
  },
  // Allow opening the app via LAN IP in `next dev` (phone / other PCs).
  // Without this, Next.js 403-blocks `/_next/*` JS when Origin is e.g. 192.168.1.83
  // → React never loads → login, cart, and all client buttons break.
  allowedDevOrigins: [
    "192.168.1.67",
    "192.168.1.67:3000",
    "http://192.168.1.67:3000",
    "192.168.1.83",
    "192.168.1.83:3000",
    "http://192.168.1.83:3000",
    "192.168.1.108",
    "192.168.1.108:3000",
    "http://192.168.1.108:3000",
    "192.168.1.149",
    "192.168.1.149:3000",
    "http://192.168.1.149:3000",
    "192.168.*.*",
    "10.*.*.*",
    "172.*.*.*",
    "*.local",
  ],
  async rewrites() {
    const rewrites: { source: string; destination: string }[] = [
      { source: "/favicon.ico", destination: "/icon" },
      {
        source: "/llms/products/:slug.txt",
        destination: "/llms/products/:slug",
      },
      {
        source: "/llms/collections/:slug.txt",
        destination: "/llms/collections/:slug",
      },
    ];

    // Local upload files live on the API. The storefront asks for them as /uploads/...
    const apiOrigin = new URL(
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003/api/v1",
    ).origin;
    rewrites.push({
      source: "/uploads/:path*",
      destination: `${apiOrigin}/uploads/:path*`,
    });

    // Dev/LAN: proxy API through the web origin so the phone never calls localhost:3003
    if (process.env.NODE_ENV !== "production") {
      const apiBase = (
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003/api/v1"
      ).replace(/\/$/, "");
      rewrites.push({
        source: "/api/v1/:path*",
        destination: `${apiBase}/:path*`,
      });
    }

    return rewrites;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
      {
        // Search should never be indexed even if a crawler ignores robots.txt
        source: "/search",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/account/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/cart",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/checkout",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/feeds/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/products/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=120, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/collections/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=120, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=120, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/_next/image",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          {
            key: "Cache-Control",
            value:
              process.env.NODE_ENV === "production"
                ? "public, max-age=31536000, immutable"
                : "no-store",
          },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value:
              process.env.NODE_ENV === "production"
                ? "public, max-age=31536000, immutable"
                : "no-store",
          },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        source: "/_next/data/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    // Keep optimized images warm for returning visitors (PSI cache audit).
    minimumCacheTTL: 31536000,
    // Prefer mobile-relevant widths; cuts unused srcset candidates.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [64, 96, 128, 256, 384],
    qualities: [70, 75, 90],
    // Serve images as inline (not attachment) so Googlebot-Image / GSC
    // can process /_next/image URLs instead of treating them as downloads.
    contentDispositionType: "inline",
    // Next.js 16 blocks private IPs by default — needed for local uploads
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
    remotePatterns: apiRemotePatterns(),
  },
};

export default nextConfig;
