import { type Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { type AppType } from "next/app";
import Head from "next/head";
import { Figtree } from "next/font/google";
import localFont from "next/font/local";
import { api } from "~/utils/api";
import { SpeedInsights } from "@vercel/speed-insights/next";

import "~/styles/globals.css";
import { Toaster } from "sonner";
import { Toaster as CustomToaster } from "~/components/ui/toaster";
import { TooltipProvider } from "~/components/ui/tooltip";

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
      <Head>
        {/* viewport-fit=cover lets content bleed into the safe areas / under
            the mobile browser chrome. Without it, Safari (esp. iOS 26) draws a
            solid white bar in the gap between the content and the toolbar. */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
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
