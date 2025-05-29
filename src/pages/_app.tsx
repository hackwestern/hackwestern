import { type Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { type AppType } from "next/app";
import { DM_Sans, JetBrains_Mono, Figtree } from "next/font/google";
import localFont from "next/font/local";

import { api } from "~/utils/api";

import "~/styles/globals.css";
import { Toaster } from "~/components/ui/toaster";
import { TooltipProvider } from "~/components/ui/tooltip";

const DM_SANS = DM_Sans({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-dmsans",
  fallback: ["Inter", "sans-serif"],
});

const MagicRetro = localFont({
  src: "../../public/fonts/magic_retro/MagicRetro.ttf",
  variable: "--font-magicretro",
  display: "swap",
});

const dico = localFont({
  src: "../../public/fonts/dico/Dico.ttf",
  variable: "--font-dico",
  display: "swap",
});

const figtree = Figtree({
  weight: ["500"],
  subsets: ["latin"],
  variable: "--font-figtree",
  fallback: ["Inter", "sans-serif"],
});

const jetbrainsmono = JetBrains_Mono({
  weight: ["500"],
  subsets: ["latin"],
  variable: "--font-jetbrainsmono",
  fallback: ["monospace"],
});

const MyApp: AppType<{ session: Session | null }> = ({
  Component,
  pageProps: { session, ...pageProps },
}) => {
  return (
    <SessionProvider session={session}>
      <main
        className={`${MagicRetro.variable} ${DM_SANS.variable} font-DM_Sans ${figtree.variable} font-Figtree ${jetbrainsmono.variable} font-JetBrains_Mono ${dico.variable} font-Dico`}
      >
        <TooltipProvider>
          <Component {...pageProps} />
        </TooltipProvider>
      </main>
      <Toaster />
    </SessionProvider>
  );
};

export default api.withTRPC(MyApp);
