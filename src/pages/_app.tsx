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

const cossetteTexte = localFont({
  src: [
    {
      path: "../../public/shared/fonts/cossetteTexte/CossetteTexte-Bold.ttf",
      weight: "700",
    },
    {
      path: "../../public/shared/fonts/cossetteTexte/CossetteTexte-Regular.ttf",
      weight: "400",
    },
  ],
  variable: "--font-cossetteTexte",
  display: "swap",
});

const pix32 = localFont({
  src: "../../public/shared/fonts/pix32/Pix32.ttf",
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
