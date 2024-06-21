import { type Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { type AppType } from "next/app";
import { DM_Sans } from "next/font/google";
import {} from "next/font/google";
import localFont from "next/font/local";

import { api } from "~/utils/api";

import "~/styles/globals.css";

const DM_SANS = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const MagicRetro = localFont({
  src: "../../public/fonts/magic_retro/MagicRetro.ttf",
  variable: "--font-magicretro",
});

const MyApp: AppType<{ session: Session | null }> = ({
  Component,
  pageProps: { session, ...pageProps },
}) => {
  return (
    <SessionProvider session={session}>
      <main className={`font-sans ${DM_SANS.variable} ${MagicRetro.className}`}>
        <Component {...pageProps} />
      </main>
    </SessionProvider>
  );
};

export default api.withTRPC(MyApp);
