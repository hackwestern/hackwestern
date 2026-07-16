/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
await import("./src/env.js");

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,
  experimental: {
    reactCompiler: true,
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
      {
        source: "/login",
        destination: "/",
        permanent: false,
      }
    ];
  },
};

export default config;
