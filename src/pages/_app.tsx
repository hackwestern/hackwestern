import { type Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { type AppType } from "next/app";
import { JetBrains_Mono, Figtree } from "next/font/google";
import localFont from "next/font/local";

import { api } from "~/utils/api";

import "~/styles/globals.css";
import { Toaster } from "~/components/ui/toaster";
import { TooltipProvider } from "~/components/ui/tooltip";

const dico = localFont({
  src: "../../public/fonts/dico/Dico.ttf",
  variable: "--font-dico",
  display: "swap",
});

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  fallback: ["Inter", "sans-serif"],
});

const jetbrainsmono = JetBrains_Mono({
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
        className={`${figtree.variable} font-figtree ${jetbrainsmono.variable} font-jetbrains-mono ${dico.variable} font-dico`}
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
