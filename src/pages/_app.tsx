import { type Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { type AppType } from "next/app";
import { Figtree } from "next/font/google";
import localFont from "next/font/local";
import { api } from "~/utils/api";
import { SpeedInsights } from "@vercel/speed-insights/next";

import "~/styles/globals.css";
import { Toaster } from "sonner";
import { Toaster as CustomToaster } from "~/components/ui/toaster";
import { TooltipProvider } from "~/components/ui/tooltip";
import Head from "next/head";
import {
  DEFAULT_OG_IMAGE,
  DEFAULT_TITLE,
  DEFAULT_DESCRIPTION,
  SITE_NAME,
} from "~/components/seo";

const cossetteTexte = localFont({
  src: [
    {
      path: "../../public/shared/fonts/cossetteTexte/CossetteTexte-Bold.woff2",
      weight: "700",
    },
    {
      path: "../../public/shared/fonts/cossetteTexte/CossetteTexte-Regular.woff2",
      weight: "400",
    },
  ],
  variable: "--font-cossetteTexte",
  display: "swap",
});

const pix32 = localFont({
  src: "../../public/shared/fonts/pix32/Pix32.woff2",
  variable: "--font-pix32",
  display: "swap",
});

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  fallback: ["Inter", "sans-serif"],
});

const MyApp: AppType<{ session: Session | null }> = ({
  Component,
  pageProps: { session, ...pageProps },
}) => {
  return (
    <SessionProvider session={session}>
      {/* Site-wide default social tags. Pages that render <SEO/> override
          these via matching `key`s; pages without it (e.g. the home page)
          fall back to these, so every route has a link preview. */}
      <Head>
        <title>{DEFAULT_TITLE}</title>
        <meta
          name="description"
          content={DEFAULT_DESCRIPTION}
          key="description"
        />
        <meta property="og:type" content="website" key="og:type" />
        <meta property="og:site_name" content={SITE_NAME} key="og:site_name" />
        <meta property="og:title" content={DEFAULT_TITLE} key="og:title" />
        <meta
          property="og:description"
          content={DEFAULT_DESCRIPTION}
          key="og:description"
        />
        <meta property="og:image" content={DEFAULT_OG_IMAGE} key="og:image" />
        <meta property="og:image:width" content="1200" key="og:image:width" />
        <meta property="og:image:height" content="630" key="og:image:height" />
        <meta
          name="twitter:card"
          content="summary_large_image"
          key="twitter:card"
        />
        <meta
          name="twitter:title"
          content={DEFAULT_TITLE}
          key="twitter:title"
        />
        <meta
          name="twitter:description"
          content={DEFAULT_DESCRIPTION}
          key="twitter:description"
        />
        <meta
          name="twitter:image"
          content={DEFAULT_OG_IMAGE}
          key="twitter:image"
        />
      </Head>
      <SpeedInsights />
      <main
        className={`${figtree.variable} font-figtree ${cossetteTexte.variable} font-cossetteTexte ${pix32.variable} font-pix32`}
      >
        <TooltipProvider>
          <Component {...pageProps} />
        </TooltipProvider>
      </main>
      <Toaster visibleToasts={1} style={{ zIndex: 90 }} />
      <CustomToaster />
    </SessionProvider>
  );
};

export default api.withTRPC(MyApp);
