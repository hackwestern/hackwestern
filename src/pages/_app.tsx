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
import {
  SocialMeta,
  DEFAULT_OG_IMAGE,
  DEFAULT_TITLE,
  DEFAULT_DESCRIPTION,
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
      <SocialMeta
        title={DEFAULT_TITLE}
        description={DEFAULT_DESCRIPTION}
        image={DEFAULT_OG_IMAGE}
      />
      <SpeedInsights />
      <main
        className={`${figtree.variable} font-secondary ${cossetteTexte.variable} font-cossetteTexte ${pix32.variable} font-pix32`}
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
