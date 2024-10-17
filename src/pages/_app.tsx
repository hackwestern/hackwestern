import { type Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { type AppType } from "next/app";
import { DM_Sans } from "next/font/google";
import localFont from "next/font/local";

import { api } from "~/utils/api";

import "~/styles/globals.css";
import { Toaster } from "~/components/ui/toaster";

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

const MyApp: AppType<{ session: Session | null }> = ({
  Component,
  pageProps: { session, ...pageProps },
}) => {
  return (
    <SessionProvider session={session}>
      <main
        className={`${MagicRetro.variable} ${DM_SANS.variable} font-DM_Sans`}
      >
        <Component {...pageProps} />
      </main>
      <Toaster />
    </SessionProvider>
  );
};

export default api.withTRPC(MyApp);
