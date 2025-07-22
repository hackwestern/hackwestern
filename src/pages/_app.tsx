import { type Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { type AppType } from "next/app";
import { JetBrains_Mono, Figtree } from "next/font/google";
import localFont from "next/font/local";

import { api } from "~/utils/api";

import "~/styles/globals.css";
import { Toaster } from "sonner";
import { TooltipProvider } from "~/components/ui/tooltip";

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
        className={`${figtree.variable} font-figtree ${jetbrainsmono.variable} font-jetbrains-mono ${dico.variable} font-dico`}
      >
        <TooltipProvider>
          <Component {...pageProps} />
        </TooltipProvider>
      </main>
      <Toaster 
        visibleToasts={1}
        style={{ zIndex: 90 }}
      />
    </SessionProvider>
  );
};

export default api.withTRPC(MyApp);
