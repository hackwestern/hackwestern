/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
await import("./src/env.js");

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,

  // The internal-tools warning runs in the browser, so inline the hackathon
  // window at build time.
  env: {
    NEXT_PUBLIC_HACK_START: process.env.HACK_START ?? "",
    NEXT_PUBLIC_HACK_END: process.env.HACK_END ?? "",
  },
  // Dev only: let phones on the team's private Tailscale network load the
  // dev server through `tailscale serve` (Next blocks unknown dev origins).
  allowedDevOrigins: ["*.ts.net", "100.84.66.106"],
  experimental: {
    reactCompiler: true,
  },

  // The Apple Wallet route reads its pass images from disk at request time.
  outputFileTracingIncludes: {
    "/api/wallet/apple": ["./src/server/wallet/apple/**/*"],
  },

  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000,
  },

  /**
   * If you are using `appDir` then you must comment the below `i18n` config out.
   *
   * @see https://github.com/vercel/next.js/issues/41980
   */
  i18n: {
    locales: ["en"],
    defaultLocale: "en",
  },

  async redirects() {
    return [
      // sponsors.pdf moved to public/shared/sponsors in #628; old link is in circulation
      {
        source: "/sponsors/sponsors.pdf",
        destination: "/shared/sponsors/sponsors.pdf",
        permanent: true,
      },
    ];
  },
};

export default config;
